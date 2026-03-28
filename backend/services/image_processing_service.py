import base64
import io

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, distance_transform_edt
from sklearn.cluster import KMeans

_N_COLORS = 14
_BACKGROUND_DELTA_THRESHOLD = 25.0
_MIN_STRONG_DELTA = 40.0
_MIN_ALPHA = 0.55
_SEED_ALPHA = 0.72
_RANDOM_STATE = 7
_ALIASED_COSINE_THRESHOLD = 0.97
_ALIASED_MAX_STRENGTH_RATIO = 0.65
_LAYER_SIMILARITY_THRESHOLD = 0.65
_LAYER_PROXIMITY_RADIUS = 1


def _merge_similar_colors(colors: np.ndarray, min_distance: float = 18.0) -> np.ndarray:
    kept: list[np.ndarray] = []
    for color in colors:
        if not kept:
            kept.append(color)
            continue
        distances = [np.linalg.norm(color.astype(np.float32) - other.astype(np.float32)) for other in kept]
        if min(distances) >= min_distance:
            kept.append(color)
    return np.asarray(kept, dtype=np.uint8)


def _remove_aliased_palette_colors(colors: np.ndarray) -> np.ndarray:
    deltas = 255.0 - colors.astype(np.float32)
    strengths = np.linalg.norm(deltas, axis=1)
    with np.errstate(divide="ignore", invalid="ignore"):
        normalized = deltas / strengths[:, None]

    cosine_sim = normalized @ normalized.T
    keep = np.ones(len(colors), dtype=bool)

    for i in range(len(colors)):
        if not keep[i]:
            continue
        for j in range(i + 1, len(colors)):
            if not keep[j]:
                continue
            if cosine_sim[i, j] < _ALIASED_COSINE_THRESHOLD:
                continue
            ratio = min(strengths[i], strengths[j]) / max(strengths[i], strengths[j])
            if ratio > _ALIASED_MAX_STRENGTH_RATIO:
                continue
            if strengths[i] >= strengths[j]:
                keep[j] = False
            else:
                keep[i] = False
                break

    return colors[keep]


def _discover_palette(pixels: np.ndarray) -> np.ndarray:
    flat_pixels = pixels.reshape(-1, 3).astype(np.float32)
    delta_from_white = 255.0 - flat_pixels
    delta_strength = np.linalg.norm(delta_from_white, axis=1)

    strong_pixels = delta_from_white[delta_strength > _MIN_STRONG_DELTA]
    if len(strong_pixels) < _N_COLORS:
        raise ValueError("Not enough colored pixels to infer the palette.")

    normalized = strong_pixels / np.linalg.norm(strong_pixels, axis=1, keepdims=True)
    model = KMeans(n_clusters=_N_COLORS, n_init=20, random_state=_RANDOM_STATE)
    labels = model.fit_predict(normalized)

    palette = []
    for cluster_index in range(_N_COLORS):
        cluster = strong_pixels[labels == cluster_index]
        representative_delta = np.percentile(cluster, 98, axis=0)
        representative_color = np.clip(255.0 - representative_delta, 0, 255).round().astype(np.uint8)
        palette.append(representative_color)

    palette = np.asarray(palette, dtype=np.uint8)
    palette = palette[np.argsort(np.sum(255 - palette, axis=1))]
    palette = _merge_similar_colors(palette)
    palette = _remove_aliased_palette_colors(palette)
    return palette


def _classify_pixels(pixels: np.ndarray, palette: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    flat_pixels = pixels.reshape(-1, 3).astype(np.float32)
    delta_from_white = 255.0 - flat_pixels
    delta_strength = np.linalg.norm(delta_from_white, axis=1)

    palette_delta = 255.0 - palette.astype(np.float32)
    denom = np.sum(palette_delta * palette_delta, axis=1)

    alpha = (delta_from_white @ palette_delta.T) / denom
    alpha = np.clip(alpha, 0.0, 1.0)

    reconstructions = 255.0 - alpha[:, :, None] * palette_delta[None, :, :]
    reconstruction_error = np.linalg.norm(flat_pixels[:, None, :] - reconstructions, axis=2)
    best_match = reconstruction_error.argmin(axis=1)
    best_alpha = alpha[np.arange(len(flat_pixels)), best_match]

    foreground_mask = (delta_strength >= _BACKGROUND_DELTA_THRESHOLD) & (best_alpha >= _MIN_ALPHA)
    return best_match, best_alpha, foreground_mask


def _hard_dealias(pixels: np.ndarray, palette: np.ndarray) -> np.ndarray:
    height, width = pixels.shape[:2]
    best_match, best_alpha, foreground_mask = _classify_pixels(pixels, palette)

    seed_mask = foreground_mask & (best_alpha >= _SEED_ALPHA)
    labels = np.full(height * width, -1, dtype=np.int32)
    labels[seed_mask] = best_match[seed_mask]

    foreground_2d = foreground_mask.reshape(height, width)
    seed_2d = seed_mask.reshape(height, width)
    labels_2d = labels.reshape(height, width)

    if seed_2d.any():
        _, nearest_seed_indices = distance_transform_edt(~seed_2d, return_indices=True)
        nearest_rows, nearest_cols = nearest_seed_indices
        propagated_labels = labels_2d[nearest_rows, nearest_cols]
        final_labels = np.where(foreground_2d, propagated_labels, -1)
    else:
        final_labels = np.where(foreground_2d, best_match.reshape(height, width), -1)

    result = np.full((height, width, 3), 255, dtype=np.uint8)
    colored_mask = final_labels >= 0
    result[colored_mask] = palette[final_labels[colored_mask]]
    return result


def _layer_to_mask(layer: np.ndarray) -> np.ndarray:
    return layer[..., 3] > 0


def _mask_similarity(mask_a: np.ndarray, mask_b: np.ndarray, proximity_radius: int = 1) -> float:
    area_a = mask_a.sum()
    area_b = mask_b.sum()
    if area_a == 0 or area_b == 0:
        return 0.0

    overlap = np.logical_and(mask_a, mask_b).sum()
    union = np.logical_or(mask_a, mask_b).sum()
    iou = overlap / max(union, 1)
    containment = overlap / max(min(area_a, area_b), 1)

    if proximity_radius > 0:
        structure = np.ones((2 * proximity_radius + 1, 2 * proximity_radius + 1), dtype=bool)
        a_near_b = np.logical_and(mask_a, binary_dilation(mask_b, structure=structure)).sum() / area_a
        b_near_a = np.logical_and(mask_b, binary_dilation(mask_a, structure=structure)).sum() / area_b
        proximity = max(a_near_b, b_near_a)
    else:
        proximity = 0.0

    return max(iou, containment, proximity)


def _merge_similar_layers(layers: list[np.ndarray], similarity_threshold: float, proximity_radius: int) -> list[np.ndarray]:
    if not layers:
        return []

    masks = [_layer_to_mask(layer) for layer in layers]
    n = len(masks)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for i in range(n):
        for j in range(i + 1, n):
            score = _mask_similarity(masks[i], masks[j], proximity_radius=proximity_radius)
            if score >= similarity_threshold:
                union(i, j)

    groups: dict[int, list[int]] = {}
    for idx in range(n):
        root = find(idx)
        groups.setdefault(root, []).append(idx)

    h, w = layers[0].shape[:2]
    merged_layers: list[np.ndarray] = []
    for members in groups.values():
        merged_mask = np.zeros((h, w), dtype=bool)
        for m in members:
            merged_mask |= masks[m]

        merged = np.zeros((h, w, 4), dtype=np.uint8)
        merged[merged_mask] = [0, 0, 0, 255]
        merged_layers.append(merged)

    return merged_layers


def split_sketch_by_color(img: Image.Image) -> list[str]:
    """Deconstruct a multi-colored sketch into spatially-synchronized color layers.

    Each layer contains only the pixels belonging to one palette color, rendered as
    black on a transparent background and returned as a base64-encoded PNG data URL.
    """
    pixels = np.asarray(img.convert("RGB"), dtype=np.uint8)
    palette = _discover_palette(pixels)
    dealiased = _hard_dealias(pixels, palette)

    h, w = dealiased.shape[:2]
    raw_layers: list[np.ndarray] = []

    for color in palette:
        mask = np.all(dealiased == color, axis=2)

        layer = np.zeros((h, w, 4), dtype=np.uint8)
        layer[mask] = [0, 0, 0, 255]
        raw_layers.append(layer)

    merged_layers = _merge_similar_layers(
        raw_layers,
        similarity_threshold=_LAYER_SIMILARITY_THRESHOLD,
        proximity_radius=_LAYER_PROXIMITY_RADIUS,
    )

    data_urls: list[str] = []

    for layer in merged_layers:
        layer_img = Image.fromarray(layer, mode="RGBA")
        buf = io.BytesIO()
        layer_img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        data_urls.append(f"data:image/png;base64,{b64}")

    return data_urls


if __name__ == "__main__":
    img = Image.open("services/image.png")
    layers = split_sketch_by_color(img)
    # save to disk for inspection
    for i, layer in enumerate(layers):
        header, b64data = layer.split(",", 1)
        img_data = base64.b64decode(b64data)
        with open(f"layer_{i}.png", "wb") as f:
            f.write(img_data)

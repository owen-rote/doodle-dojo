import base64
import io

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
from sklearn.cluster import KMeans

_N_COLORS = 14
_BACKGROUND_DELTA_THRESHOLD = 25.0
_MIN_STRONG_DELTA = 40.0
_MIN_ALPHA = 0.55
_SEED_ALPHA = 0.72
_RANDOM_STATE = 7
_ALIASED_COSINE_THRESHOLD = 0.97
_ALIASED_MAX_STRENGTH_RATIO = 0.65


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


def split_sketch_by_color(img: Image.Image) -> list[str]:
    """Deconstruct a multi-colored sketch into spatially-synchronized color layers.

    Each layer contains only the pixels belonging to one palette color, rendered as
    black on a transparent background and returned as a base64-encoded PNG data URL.
    """
    pixels = np.asarray(img.convert("RGB"), dtype=np.uint8)
    palette = _discover_palette(pixels)
    dealiased = _hard_dealias(pixels, palette)

    h, w = dealiased.shape[:2]
    data_urls: list[str] = []

    for color in palette:
        mask = np.all(dealiased == color, axis=2)

        layer = np.zeros((h, w, 4), dtype=np.uint8)
        layer[mask] = [0, 0, 0, 255]

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
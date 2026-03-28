import base64
import colorsys
import io

import numpy as np
from PIL import Image

_WHITE_DISTANCE_THRESHOLD = 28.0
_MIN_SATURATION = 0.10
_HUE_TOLERANCE = 0.045
_SATURATION_TOLERANCE = 0.24
_VALUE_TOLERANCE = 0.34
_GRAY_VALUE_TOLERANCE = 0.14
_GRAY_SATURATION_TOLERANCE = 0.10
_MIN_PIXELS_PER_GROUP = 20
_MAX_STROKE_GROUPS = 20
_DISPLAY_PALETTE = np.asarray(
    [
        [255, 0, 0],
        [0, 200, 0],
        [0, 110, 255],
        [255, 140, 0],
        [180, 0, 255],
        [0, 220, 220],
        [255, 0, 170],
        [200, 220, 0],
        [255, 255, 0],
        [0, 255, 120],
        [255, 80, 80],
        [80, 80, 255],
        [255, 0, 255],
        [0, 255, 255],
        [255, 180, 0],
        [120, 255, 0],
        [255, 0, 90],
        [120, 0, 255],
        [0, 170, 255],
        [255, 60, 0],
    ],
    dtype=np.uint8,
)


def _distance_from_white(colors: np.ndarray) -> np.ndarray:
    return np.linalg.norm(255.0 - colors.astype(np.float32), axis=1)


def _rgb_to_hsv(colors: np.ndarray) -> np.ndarray:
    normalized = colors.astype(np.float32) / 255.0
    return np.asarray([colorsys.rgb_to_hsv(*pixel) for pixel in normalized], dtype=np.float32)


def _hue_distance(a: float, b: float) -> float:
    raw = abs(a - b)
    return min(raw, 1.0 - raw)


def _is_background(color: np.ndarray) -> bool:
    return float(_distance_from_white(color.reshape(1, 3))[0]) < _WHITE_DISTANCE_THRESHOLD


def _group_shades(unique_colors: np.ndarray, counts: np.ndarray) -> list[dict]:
    hsv_colors = _rgb_to_hsv(unique_colors)
    color_strength = _distance_from_white(unique_colors)
    groups: list[dict] = []

    for color_index in np.argsort(counts)[::-1]:
        color = unique_colors[color_index]
        if _is_background(color):
            continue

        hue, saturation, value = hsv_colors[color_index]
        best_group = None
        best_score = None

        for group in groups:
            base_hue, base_saturation, base_value = group["anchor_hsv"]
            if min(float(saturation), float(base_saturation)) < _MIN_SATURATION:
                hue_match = True
                sat_match = abs(float(saturation) - float(base_saturation)) <= _GRAY_SATURATION_TOLERANCE
                value_match = abs(float(value) - float(base_value)) <= _GRAY_VALUE_TOLERANCE
            else:
                hue_match = _hue_distance(float(hue), float(base_hue)) <= _HUE_TOLERANCE
                sat_match = abs(float(saturation) - float(base_saturation)) <= _SATURATION_TOLERANCE
                value_match = abs(float(value) - float(base_value)) <= _VALUE_TOLERANCE

            if not (hue_match and sat_match and value_match):
                continue

            score = _hue_distance(float(hue), float(base_hue))
            score += abs(float(saturation) - float(base_saturation))
            score += abs(float(value) - float(base_value))
            if best_score is None or score < best_score:
                best_score = score
                best_group = group

        if best_group is None:
            groups.append({"anchor_hsv": hsv_colors[color_index], "members": [color_index]})
        else:
            best_group["members"].append(color_index)

    grouped_colors: list[dict] = []
    for group in groups:
        member_indexes = np.asarray(group["members"], dtype=np.int32)
        total_pixels = int(counts[member_indexes].sum())
        if total_pixels < _MIN_PIXELS_PER_GROUP:
            continue

        strongest_member = member_indexes[np.argmax(color_strength[member_indexes])]
        grouped_colors.append(
            {
                "member_indexes": member_indexes,
                "canonical_color": unique_colors[strongest_member],
                "anchor_hsv": np.average(hsv_colors[member_indexes], axis=0, weights=counts[member_indexes]),
                "total_pixels": total_pixels,
            }
        )

    grouped_colors.sort(key=lambda group: group["total_pixels"], reverse=True)
    return grouped_colors


def _group_distance(left: dict, right: dict) -> float:
    left_h, left_s, left_v = left["anchor_hsv"]
    right_h, right_s, right_v = right["anchor_hsv"]
    return (
        (_hue_distance(float(left_h), float(right_h)) * 2.0)
        + abs(float(left_s) - float(right_s))
        + abs(float(left_v) - float(right_v))
    )


def _merge_groups_to_max(
    groups: list[dict],
    unique_colors: np.ndarray,
    counts: np.ndarray,
) -> list[dict]:
    if len(groups) <= _MAX_STROKE_GROUPS:
        return groups

    color_strength = _distance_from_white(unique_colors)
    merged_groups = [
        {
            "member_indexes": np.asarray(group["member_indexes"], dtype=np.int32),
            "canonical_color": np.asarray(group["canonical_color"], dtype=np.uint8),
            "anchor_hsv": np.asarray(group["anchor_hsv"], dtype=np.float32),
            "total_pixels": int(group["total_pixels"]),
        }
        for group in groups
    ]

    while len(merged_groups) > _MAX_STROKE_GROUPS:
        smallest_index = min(range(len(merged_groups)), key=lambda index: merged_groups[index]["total_pixels"])
        smallest_group = merged_groups[smallest_index]

        candidate_indexes = [index for index in range(len(merged_groups)) if index != smallest_index]
        merge_into_index = min(candidate_indexes, key=lambda index: _group_distance(smallest_group, merged_groups[index]))
        target_group = merged_groups[merge_into_index]

        combined_members = np.concatenate([target_group["member_indexes"], smallest_group["member_indexes"]])
        strongest_member = combined_members[np.argmax(color_strength[combined_members])]
        combined_weights = counts[combined_members]

        target_group["member_indexes"] = combined_members
        target_group["canonical_color"] = unique_colors[strongest_member]
        target_group["anchor_hsv"] = np.average(
            _rgb_to_hsv(unique_colors[combined_members]),
            axis=0,
            weights=combined_weights,
        )
        target_group["total_pixels"] = int(combined_weights.sum())

        del merged_groups[smallest_index]

    merged_groups.sort(key=lambda group: group["total_pixels"], reverse=True)
    return merged_groups


def _apply_display_palette(groups: list[dict]) -> list[dict]:
    recolored_groups: list[dict] = []
    for index, group in enumerate(groups):
        recolored_group = dict(group)
        recolored_group["display_color"] = _DISPLAY_PALETTE[index % len(_DISPLAY_PALETTE)]
        recolored_groups.append(recolored_group)
    return recolored_groups


def split_sketch_by_color(img: Image.Image) -> list[str]:
    """Return one transparent PNG data URL per perceived stroke color.

    Lighter or darker pixels from the same stroke color are grouped together so
    anti-aliased edges do not become separate stroke layers.
    """
    rgba = np.asarray(img.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]

    visible_mask = alpha > 0
    flat_rgb = rgb.reshape(-1, 3)
    flat_visible = visible_mask.reshape(-1)
    visible_pixels = flat_rgb[flat_visible]

    if len(visible_pixels) == 0:
        return []

    unique_colors, counts = np.unique(visible_pixels, axis=0, return_counts=True)
    color_groups = _group_shades(unique_colors, counts)
    color_groups = _merge_groups_to_max(color_groups, unique_colors, counts)
    color_groups = _apply_display_palette(color_groups)
    if not color_groups:
        return []

    color_to_group: dict[tuple[int, int, int], int] = {}
    for group_index, group in enumerate(color_groups):
        for member_index in group["member_indexes"]:
            key = tuple(int(channel) for channel in unique_colors[member_index])
            color_to_group[key] = group_index

    height, width = rgb.shape[:2]
    flat_group_indexes = np.full(len(flat_rgb), -1, dtype=np.int32)
    for pixel_index, is_visible in enumerate(flat_visible):
        if not is_visible:
            continue
        color_key = tuple(int(channel) for channel in flat_rgb[pixel_index])
        flat_group_indexes[pixel_index] = color_to_group.get(color_key, -1)

    layer_urls: list[str] = []
    for group_index, group in enumerate(color_groups):
        mask = flat_group_indexes.reshape(height, width) == group_index
        if not mask.any():
            continue

        layer = np.zeros((height, width, 4), dtype=np.uint8)
        display_color = np.asarray(group["display_color"], dtype=np.uint8)
        layer[mask, :3] = display_color
        layer[mask, 3] = 255

        buffer = io.BytesIO()
        Image.fromarray(layer, mode="RGBA").save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        layer_urls.append(f"data:image/png;base64,{encoded}")

    return layer_urls

"""
Stroke extraction pipeline — mirrors backend/notebooks/stroke_extraction.ipynb.

Pipeline:
  1. Decode base64 image → OpenCV BGR array
  2. Auto-detect mode (lineart vs color) from saturation + white-pixel ratio
  3. Binarize: isolate dark strokes on a white background
  4. Skeletonize: reduce strokes to 1-pixel-wide skeleton
  5. Build pixel graph (8-connectivity) with NetworkX
  6. Walk strokes from endpoints / junctions, avoiding duplicate edges
  7. Sample guide dots at fixed arc-length intervals along each stroke
  8. Return structured JSON dict
"""

import base64
from typing import Any

import cv2
import networkx as nx
import numpy as np
from skimage.morphology import skeletonize

# ── Tunable parameters ────────────────────────────────────────────────────────
DOT_SPACING    = 15    # pixels between consecutive guide dots
MIN_STROKE_PX  = 10    # discard strokes shorter than this (in pixels)
THRESH_VALUE   = 200   # lineart-mode brightness cutoff (BINARY_INV)
DARK_THRESH    = 60    # color-mode HSV-Value cutoff (BINARY_INV)
MERGE_ENDPOINT_MAX_DIST = 2.5
MERGE_MIN_ALIGNMENT = 0.35
MERGE_ROUNDS = 4


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_data_url(data_url: str) -> str:
    """Return raw base64 string, stripping the optional data:…;base64, prefix."""
    if data_url.startswith("data:"):
        return data_url.split(",", 1)[1]
    return data_url


def _auto_detect_mode(bgr: np.ndarray) -> str:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    sat = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[:, :, 1].mean()
    _, bright = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
    white_ratio = np.count_nonzero(bright) / gray.size
    return "lineart" if (sat < 15 and white_ratio > 0.5) else "color"


def _binarize(bgr: np.ndarray, mode: str) -> np.ndarray:
    kernel = np.ones((2, 2), np.uint8)
    if mode == "lineart":
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        _, binary = cv2.threshold(blurred, THRESH_VALUE, 255, cv2.THRESH_BINARY_INV)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    else:
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        _, binary = cv2.threshold(hsv[:, :, 2], DARK_THRESH, 255, cv2.THRESH_BINARY_INV)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    return binary


def _sample_dots_by_arc_length(
    raw_pixels: list[tuple[int, int]], dot_spacing: int
) -> list[list[int]]:
    """Place guide dots every `dot_spacing` pixels along the stroke's arc length."""
    pts = np.array(raw_pixels, dtype=float)
    diffs = np.diff(pts, axis=0)
    seg_lens = np.hypot(diffs[:, 0], diffs[:, 1])
    cum_len = np.concatenate([[0], np.cumsum(seg_lens)])
    total_len = cum_len[-1]

    if total_len < dot_spacing:
        return [list(map(int, pts[0])), list(map(int, pts[-1]))]

    targets = list(np.arange(0, total_len, dot_spacing))
    if targets[-1] < total_len:
        targets.append(total_len)

    dots: list[list[int]] = []
    for t in targets:
        idx = min(np.searchsorted(cum_len, t, side="right") - 1, len(pts) - 2)
        seg_len = cum_len[idx + 1] - cum_len[idx]
        frac = (t - cum_len[idx]) / seg_len if seg_len > 0 else 0.0
        interp = pts[idx] + frac * (pts[idx + 1] - pts[idx])
        dots.append([int(round(interp[0])), int(round(interp[1]))])

    return dots


def _path_arc_length(path: list[tuple[int, int]]) -> float:
    if len(path) < 2:
        return 0.0
    return float(sum(
        np.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1])
        for i in range(len(path) - 1)
    ))


def _endpoint_tangent(path: list[tuple[int, int]], at_start: bool) -> np.ndarray | None:
    if len(path) < 2:
        return None
    if at_start:
        start = np.array(path[0], dtype=float)
        next_point = np.array(path[1], dtype=float)
        tangent = next_point - start
    else:
        prev_point = np.array(path[-2], dtype=float)
        end = np.array(path[-1], dtype=float)
        tangent = end - prev_point

    norm = np.linalg.norm(tangent)
    if norm == 0:
        return None
    return tangent / norm


def _best_merge_candidate(
    path_a: list[tuple[int, int]],
    path_b: list[tuple[int, int]],
) -> tuple[float, list[tuple[int, int]]] | None:
    orientation_pairs = [
        (path_a, path_b),
        (list(reversed(path_a)), path_b),
        (path_a, list(reversed(path_b))),
        (list(reversed(path_a)), list(reversed(path_b))),
    ]

    best_score: float | None = None
    best_path: list[tuple[int, int]] | None = None

    for oriented_a, oriented_b in orientation_pairs:
        join_a = np.array(oriented_a[-1], dtype=float)
        join_b = np.array(oriented_b[0], dtype=float)
        distance = float(np.linalg.norm(join_b - join_a))
        if distance > MERGE_ENDPOINT_MAX_DIST:
            continue

        tangent_a = _endpoint_tangent(oriented_a, at_start=False)
        tangent_b = _endpoint_tangent(oriented_b, at_start=True)
        if tangent_a is None or tangent_b is None:
            continue

        alignment = float(np.dot(tangent_a, tangent_b))
        if alignment < MERGE_MIN_ALIGNMENT:
            continue

        merged_path = oriented_a + oriented_b[1:]
        score = alignment - (distance / MERGE_ENDPOINT_MAX_DIST) * 0.25
        if best_score is None or score > best_score:
            best_score = score
            best_path = merged_path

    if best_score is None or best_path is None:
        return None

    return best_score, best_path


def _merge_touching_strokes_once(
    raw_strokes: list[list[tuple[int, int]]],
) -> list[list[tuple[int, int]]]:
    candidates: list[tuple[float, int, int, list[tuple[int, int]]]] = []

    for left_index in range(len(raw_strokes)):
        for right_index in range(left_index + 1, len(raw_strokes)):
            candidate = _best_merge_candidate(
                raw_strokes[left_index],
                raw_strokes[right_index],
            )
            if candidate is None:
                continue
            score, merged_path = candidate
            candidates.append((score, left_index, right_index, merged_path))

    candidates.sort(reverse=True, key=lambda item: item[0])

    used_indices: set[int] = set()
    merged_indices: set[int] = set()
    merged_paths: list[list[tuple[int, int]]] = []

    for _, left_index, right_index, merged_path in candidates:
        if left_index in used_indices or right_index in used_indices:
            continue
        used_indices.add(left_index)
        used_indices.add(right_index)
        merged_indices.add(left_index)
        merged_indices.add(right_index)
        merged_paths.append(merged_path)

    for index, raw_stroke in enumerate(raw_strokes):
        if index not in merged_indices:
            merged_paths.append(raw_stroke)

    return merged_paths


def _merge_touching_strokes(
    raw_strokes: list[list[tuple[int, int]]],
    rounds: int = MERGE_ROUNDS,
) -> list[list[tuple[int, int]]]:
    merged_strokes = raw_strokes
    for _ in range(rounds):
        next_strokes = _merge_touching_strokes_once(merged_strokes)
        if len(next_strokes) == len(merged_strokes):
            break
        merged_strokes = next_strokes
    return merged_strokes


# ── Public entry point ────────────────────────────────────────────────────────

def extract_strokes(image_base64: str) -> dict[str, Any]:
    """
    Run the full stroke-extraction pipeline on a base64-encoded image.

    Returns a JSON-serialisable dict with the structure:
    {
        "mode": "color" | "lineart",
        "image_width": int,
        "image_height": int,
        "dot_spacing": int,
        "stroke_count": int,
        "total_dots": int,
        "strokes": [
            { "stroke_id": int, "point_count": int, "stroke_len_px": int,
              "points": [[x, y], ...] },
            ...
        ]
    }
    """
    # 1. Decode
    raw_bytes = base64.b64decode(_strip_data_url(image_base64))
    nparr = np.frombuffer(raw_bytes, np.uint8)
    bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode image from base64 data.")

    h, w = bgr.shape[:2]

    # 2. Mode detection + binarisation
    mode = _auto_detect_mode(bgr)
    binary = _binarize(bgr, mode)

    # 3. Skeletonise
    skel = skeletonize(binary > 0)
    skel_uint8 = (skel * 255).astype(np.uint8)

    # 4. Build pixel graph (8-connectivity)
    ys, xs = np.where(skel_uint8 > 0)
    pixel_set: set[tuple[int, int]] = set(zip(xs.tolist(), ys.tolist()))

    G: nx.Graph = nx.Graph()
    G.add_nodes_from(pixel_set)
    for (x, y) in pixel_set:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nb = (x + dx, y + dy)
                if nb in pixel_set:
                    G.add_edge((x, y), nb)

    junctions: set[tuple[int, int]] = {n for n in G.nodes if G.degree(n) >= 3}
    endpoints: list[tuple[int, int]] = [n for n in G.nodes if G.degree(n) == 1]

    # 5. Walk strokes
    visited_edges: set[frozenset] = set()

    def walk_stroke(
        start: tuple[int, int], nxt: tuple[int, int]
    ) -> list[tuple[int, int]]:
        path = [start, nxt]
        visited_edges.add(frozenset([start, nxt]))
        cur, prev = nxt, start
        while True:
            nbs = [n for n in G.neighbors(cur) if n != prev]
            if not nbs or len(nbs) > 1 or cur in junctions:
                break
            nb = nbs[0]
            edge: frozenset = frozenset([cur, nb])
            if edge in visited_edges:
                break
            visited_edges.add(edge)
            path.append(nb)
            prev, cur = cur, nb
        return path

    raw_strokes: list[list[tuple[int, int]]] = []
    for start in endpoints + list(junctions):
        for nxt in G.neighbors(start):
            if frozenset([start, nxt]) not in visited_edges:
                raw_strokes.append(walk_stroke(start, nxt))

    raw_strokes = _merge_touching_strokes(raw_strokes)

    # 6. Filter + sample dots
    strokes_out: list[dict[str, Any]] = []
    total_dots = 0

    for stroke_id, path in enumerate(raw_strokes):
        arc_len = int(round(_path_arc_length(path)))
        if arc_len < MIN_STROKE_PX:
            continue
        dots = _sample_dots_by_arc_length(path, DOT_SPACING)
        strokes_out.append({
            "stroke_id": stroke_id,
            "point_count": len(dots),
            "stroke_len_px": arc_len,
            "points": dots,
        })
        total_dots += len(dots)

    return {
        "mode": mode,
        "image_width": w,
        "image_height": h,
        "dot_spacing": DOT_SPACING,
        "stroke_count": len(strokes_out),
        "total_dots": total_dots,
        "strokes": strokes_out,
    }

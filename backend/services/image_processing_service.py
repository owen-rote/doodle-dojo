import base64
import io
from dataclasses import dataclass
from pathlib import Path

import cv2
import networkx as nx
import numpy as np
from PIL import Image
from skimage.morphology import skeletonize

Pixel = tuple[int, int]

_IMAGE_MODE = "auto"
_LINEART_THRESHOLD = 200
_DARK_VALUE_THRESHOLD = 60
_WHITE_RATIO_THRESHOLD = 0.5
_SATURATION_THRESHOLD = 15.0
_DOT_SPACING = 15
_MIN_STROKE_PIXELS = 10
_MORPH_KERNEL = np.ones((2, 2), np.uint8)

_GUIDE_LINE_RGBA = (167, 139, 250, 110)
_GUIDE_DOT_RGBA = (124, 58, 237, 255)
_GUIDE_OUTLINE_RGBA = (76, 29, 149, 255)
_GUIDE_START_RGBA = (99, 102, 241, 255)

_DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "generated_strokes"


@dataclass(slots=True)
class StrokeGuide:
    stroke_id: int
    stroke_len_px: int
    points: list[Pixel]
    raw_pixels: list[Pixel]
    data_url: str
    saved_path: str | None = None


@dataclass(slots=True)
class StrokeExtractionResult:
    mode: str
    image_width: int
    image_height: int
    binary_mask: np.ndarray
    skeleton: np.ndarray
    strokes: list[StrokeGuide]

    @property
    def stroke_images(self) -> list[str]:
        return [stroke.data_url for stroke in self.strokes]

    @property
    def total_dots(self) -> int:
        return sum(len(stroke.points) for stroke in self.strokes)


def _point_sort_key(point: Pixel) -> tuple[int, int]:
    return (point[1], point[0])


def _stroke_sort_key(points: list[Pixel]) -> tuple[int, int, int, int]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return (min(ys), min(xs), max(ys) - min(ys), max(xs) - min(xs))


def _auto_detect_mode(bgr_pixels: np.ndarray) -> str:
    gray = cv2.cvtColor(bgr_pixels, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(bgr_pixels, cv2.COLOR_BGR2HSV)
    saturation_mean = float(hsv[:, :, 1].mean())
    white_ratio = float(np.count_nonzero(gray >= 240) / gray.size)
    if saturation_mean < _SATURATION_THRESHOLD and white_ratio > _WHITE_RATIO_THRESHOLD:
        return "lineart"
    return "color"


def _binarize_for_strokes(bgr_pixels: np.ndarray, mode: str = _IMAGE_MODE) -> tuple[str, np.ndarray]:
    resolved_mode = _auto_detect_mode(bgr_pixels) if mode == "auto" else mode
    gray = cv2.cvtColor(bgr_pixels, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(bgr_pixels, cv2.COLOR_BGR2HSV)

    if resolved_mode == "lineart":
        blur = cv2.GaussianBlur(gray, (3, 3), 0)
        _, binary = cv2.threshold(blur, _LINEART_THRESHOLD, 255, cv2.THRESH_BINARY_INV)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, _MORPH_KERNEL)
    else:
        _, binary = cv2.threshold(hsv[:, :, 2], _DARK_VALUE_THRESHOLD, 255, cv2.THRESH_BINARY_INV)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, _MORPH_KERNEL)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, _MORPH_KERNEL)

    return resolved_mode, binary


def _skeletonize_binary(binary: np.ndarray) -> np.ndarray:
    return skeletonize(binary > 0).astype(np.uint8) * 255


def _build_pixel_graph(skeleton: np.ndarray) -> nx.Graph:
    ys, xs = np.where(skeleton > 0)
    pixels = {(int(x), int(y)) for x, y in zip(xs.tolist(), ys.tolist(), strict=False)}

    graph = nx.Graph()
    graph.add_nodes_from(pixels)

    for x, y in pixels:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == dy == 0:
                    continue
                neighbor = (x + dx, y + dy)
                if neighbor in pixels:
                    graph.add_edge((x, y), neighbor)

    return graph


def _walk_stroke(
    graph: nx.Graph,
    start: Pixel,
    next_node: Pixel,
    junctions: set[Pixel],
    visited_edges: set[frozenset[Pixel]],
) -> list[Pixel]:
    path = [start, next_node]
    visited_edges.add(frozenset((start, next_node)))
    current = next_node
    previous = start

    while True:
        neighbors = sorted((neighbor for neighbor in graph.neighbors(current) if neighbor != previous), key=_point_sort_key)
        if not neighbors or len(neighbors) > 1 or current in junctions:
            break

        neighbor = neighbors[0]
        edge = frozenset((current, neighbor))
        if edge in visited_edges:
            break

        visited_edges.add(edge)
        path.append(neighbor)
        previous, current = current, neighbor

    return path


def _walk_remaining_cycle(graph: nx.Graph, start: Pixel, visited_edges: set[frozenset[Pixel]]) -> list[Pixel]:
    neighbors = sorted(graph.neighbors(start), key=_point_sort_key)
    if not neighbors:
        return [start]

    previous = start
    current = neighbors[0]
    path = [start, current]
    visited_edges.add(frozenset((start, current)))

    while True:
        next_candidates = sorted((neighbor for neighbor in graph.neighbors(current) if neighbor != previous), key=_point_sort_key)
        if not next_candidates:
            break

        next_node = next_candidates[0]
        edge = frozenset((current, next_node))
        if edge in visited_edges:
            break

        visited_edges.add(edge)
        path.append(next_node)
        previous, current = current, next_node

        if current == start:
            break

    return path


def _extract_raw_strokes(skeleton: np.ndarray, min_stroke_pixels: int = _MIN_STROKE_PIXELS) -> list[list[Pixel]]:
    graph = _build_pixel_graph(skeleton)
    if graph.number_of_nodes() == 0:
        return []

    endpoints = sorted((node for node in graph.nodes if graph.degree(node) == 1), key=_point_sort_key)
    junctions = {node for node in graph.nodes if graph.degree(node) >= 3}
    ordered_junctions = sorted(junctions, key=_point_sort_key)

    visited_edges: set[frozenset[Pixel]] = set()
    raw_strokes: list[list[Pixel]] = []

    for node in endpoints + ordered_junctions:
        for neighbor in sorted(graph.neighbors(node), key=_point_sort_key):
            edge = frozenset((node, neighbor))
            if edge in visited_edges:
                continue

            stroke = _walk_stroke(graph, node, neighbor, junctions, visited_edges)
            if len(stroke) >= min_stroke_pixels:
                raw_strokes.append(stroke)

    for component_nodes in nx.connected_components(graph):
        component_graph = graph.subgraph(component_nodes)

        while True:
            unvisited_edge = next(
                (
                    edge
                    for edge in sorted(component_graph.edges(), key=lambda edge: tuple(sorted(edge, key=_point_sort_key)))
                    if frozenset(edge) not in visited_edges
                ),
                None,
            )
            if unvisited_edge is None:
                break

            start, _ = sorted(unvisited_edge, key=_point_sort_key)
            stroke = _walk_remaining_cycle(component_graph, start, visited_edges)
            if len(stroke) >= min_stroke_pixels:
                raw_strokes.append(stroke)

    raw_strokes.sort(key=_stroke_sort_key)
    return raw_strokes


def _stroke_arc_length(raw_pixels: list[Pixel]) -> float:
    if len(raw_pixels) < 2:
        return 0.0
    points = np.asarray(raw_pixels, dtype=float)
    diffs = np.diff(points, axis=0)
    return float(np.hypot(diffs[:, 0], diffs[:, 1]).sum())


def _sample_dots_by_arc_length(raw_pixels: list[Pixel], dot_spacing: int) -> list[Pixel]:
    if not raw_pixels:
        return []
    if len(raw_pixels) == 1:
        return [raw_pixels[0]]

    points = np.asarray(raw_pixels, dtype=float)
    diffs = np.diff(points, axis=0)
    segment_lengths = np.hypot(diffs[:, 0], diffs[:, 1])
    cumulative_lengths = np.concatenate(([0.0], np.cumsum(segment_lengths)))
    total_length = float(cumulative_lengths[-1])
    is_closed = raw_pixels[0] == raw_pixels[-1]

    if total_length < dot_spacing:
        if is_closed:
            return [raw_pixels[0]]
        return [raw_pixels[0], raw_pixels[-1]]

    targets = list(np.arange(0.0, total_length, float(dot_spacing)))
    if not targets:
        targets = [0.0]
    if not is_closed and targets[-1] < total_length:
        targets.append(total_length)

    sampled_points: list[Pixel] = []
    for target in targets:
        index = min(np.searchsorted(cumulative_lengths, target, side="right") - 1, len(points) - 2)
        segment_length = cumulative_lengths[index + 1] - cumulative_lengths[index]
        fraction = (target - cumulative_lengths[index]) / segment_length if segment_length > 0 else 0.0
        interpolated = points[index] + fraction * (points[index + 1] - points[index])
        rounded = (int(round(interpolated[0])), int(round(interpolated[1])))
        if not sampled_points or sampled_points[-1] != rounded:
            sampled_points.append(rounded)

    if not is_closed and sampled_points[-1] != raw_pixels[-1]:
        sampled_points.append(raw_pixels[-1])

    return sampled_points


def _rgba_to_bgra(color: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    red, green, blue, alpha = color
    return (blue, green, red, alpha)


def _render_stroke_png(points: list[Pixel], image_size: tuple[int, int]) -> Image.Image:
    width, height = image_size
    canvas = np.zeros((height, width, 4), dtype=np.uint8)

    if not points:
        return Image.fromarray(canvas, mode="RGBA")

    scale = max(0.75, min(width, height) / 512.0)
    line_width = max(1, int(round(1.5 * scale)))
    dot_radius = max(3, int(round(4.0 * scale)))
    start_radius = max(dot_radius + 1, int(round(6.0 * scale)))

    line_color = _rgba_to_bgra(_GUIDE_LINE_RGBA)
    dot_color = _rgba_to_bgra(_GUIDE_DOT_RGBA)
    start_color = _rgba_to_bgra(_GUIDE_START_RGBA)
    outline_color = _rgba_to_bgra(_GUIDE_OUTLINE_RGBA)

    for left, right in zip(points, points[1:], strict=False):
        cv2.line(canvas, left, right, line_color, line_width, cv2.LINE_AA)

    for index, point in enumerate(points):
        radius = start_radius if index == 0 else dot_radius
        fill_color = start_color if index == 0 else dot_color
        cv2.circle(canvas, point, radius, fill_color, -1, cv2.LINE_AA)
        cv2.circle(canvas, point, radius, outline_color, 1, cv2.LINE_AA)

    rgba_canvas = cv2.cvtColor(canvas, cv2.COLOR_BGRA2RGBA)
    return Image.fromarray(rgba_canvas, mode="RGBA")


def _png_bytes_for_image(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _data_url_from_png_bytes(png_bytes: bytes) -> str:
    encoded = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _prepare_output_dir(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for existing_file in output_dir.glob("stroke_*.png"):
        existing_file.unlink()


def extract_stroke_guides(
    img: Image.Image,
    *,
    output_dir: Path | None = _DEFAULT_OUTPUT_DIR,
    dot_spacing: int = _DOT_SPACING,
) -> StrokeExtractionResult:
    rgb_pixels = np.asarray(img.convert("RGB"), dtype=np.uint8)
    bgr_pixels = cv2.cvtColor(rgb_pixels, cv2.COLOR_RGB2BGR)
    mode, binary_mask = _binarize_for_strokes(bgr_pixels)
    skeleton = _skeletonize_binary(binary_mask)
    raw_strokes = _extract_raw_strokes(skeleton)

    output_path = Path(output_dir) if output_dir is not None else None
    if output_path is not None:
        _prepare_output_dir(output_path)

    image_size = (rgb_pixels.shape[1], rgb_pixels.shape[0])
    guides: list[StrokeGuide] = []

    for stroke_id, raw_pixels in enumerate(raw_strokes):
        sampled_points = _sample_dots_by_arc_length(raw_pixels, dot_spacing)
        stroke_png = _render_stroke_png(sampled_points, image_size)
        png_bytes = _png_bytes_for_image(stroke_png)

        saved_path: str | None = None
        if output_path is not None:
            file_path = output_path / f"stroke_{stroke_id:03d}.png"
            file_path.write_bytes(png_bytes)
            saved_path = str(file_path)

        guides.append(
            StrokeGuide(
                stroke_id=stroke_id,
                stroke_len_px=int(round(_stroke_arc_length(raw_pixels))),
                points=sampled_points,
                raw_pixels=raw_pixels,
                data_url=_data_url_from_png_bytes(png_bytes),
                saved_path=saved_path,
            )
        )

    return StrokeExtractionResult(
        mode=mode,
        image_width=image_size[0],
        image_height=image_size[1],
        binary_mask=binary_mask,
        skeleton=skeleton,
        strokes=guides,
    )


def split_sketch_by_color(img: Image.Image) -> list[str]:
    """Legacy wrapper retained for callers that expect a list of data URLs."""
    return extract_stroke_guides(img).stroke_images


if __name__ == "__main__":
    input_path = Path(__file__).resolve().parent / "image.png"
    result = extract_stroke_guides(Image.open(input_path))
    print(f"Mode: {result.mode}")
    print(f"Stroke count: {len(result.strokes)}")
    print(f"Total dots: {result.total_dots}")

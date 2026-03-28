import argparse
import base64
import io
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

from image_processing_service import split_sketch_by_color


def decode_layer_data_url(data_url: str) -> np.ndarray:
    _, payload = data_url.split(",", 1)
    layer_bytes = base64.b64decode(payload)
    return np.asarray(Image.open(io.BytesIO(layer_bytes)).convert("RGBA"), dtype=np.uint8)


def get_stroke_variations(layer_urls: list[str], indexes: list[int]) -> dict[int, str]:
    return {index: layer_urls[index] for index in indexes if 0 <= index < len(layer_urls)}


def resolve_test_image(explicit_path: str | None) -> Path:
    if explicit_path:
        path = Path(explicit_path).expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")
        return path

    candidates = [
        Path(__file__).resolve().parent / "GENERATED.png",
        Path(__file__).resolve().parent / "image.png",
        Path(__file__).resolve().parent.parent / "GENERATED.png",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise FileNotFoundError("Could not find GENERATED.png or image.png in backend/services")


def save_grid(layers: dict[int, np.ndarray], output_path: Path, title: str) -> None:
    if not layers:
        return

    cols = min(4, len(layers))
    rows = int(np.ceil(len(layers) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(4 * cols, 4 * rows))
    axes = np.atleast_1d(axes).reshape(rows, cols)

    for plot_index, (layer_index, layer) in enumerate(layers.items()):
        row, col = divmod(plot_index, cols)
        visible = layer[layer[..., 3] > 0]
        colors = np.unique(visible[:, :3], axis=0) if len(visible) else np.empty((0, 3), dtype=np.uint8)
        color = tuple(int(channel) for channel in colors[0]) if len(colors) else None
        preview = np.full((layer.shape[0], layer.shape[1], 3), 24, dtype=np.uint8)
        alpha = layer[..., 3:4].astype(np.float32) / 255.0
        preview = (preview * (1.0 - alpha) + layer[..., :3] * alpha).astype(np.uint8)
        axes[row, col].imshow(preview)
        axes[row, col].set_title(f"Index {layer_index} | color={color}")
        axes[row, col].axis("off")

    for plot_index in range(len(layers), rows * cols):
        row, col = divmod(plot_index, cols)
        axes[row, col].axis("off")

    fig.suptitle(title, fontsize=14)
    plt.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def dilate_mask(mask: np.ndarray, iterations: int = 2) -> np.ndarray:
    expanded = mask.copy()
    for _ in range(iterations):
        padded = np.pad(expanded, 1, mode="constant", constant_values=False)
        neighbors = []
        for row_offset in range(3):
            for col_offset in range(3):
                neighbors.append(
                    padded[row_offset : row_offset + expanded.shape[0], col_offset : col_offset + expanded.shape[1]]
                )
        expanded = np.logical_or.reduce(neighbors)
    return expanded


def build_visible_preview(layer: np.ndarray, background_value: int = 24, dilation_iterations: int = 2) -> np.ndarray:
    mask = layer[..., 3] > 0
    thick_mask = dilate_mask(mask, iterations=dilation_iterations)
    preview = np.full((layer.shape[0], layer.shape[1], 4), 0, dtype=np.uint8)
    preview[..., :3] = background_value
    preview[..., 3] = 255

    visible_pixels = layer[mask][:, :3]
    if len(visible_pixels):
        color = np.unique(visible_pixels, axis=0)[0]
        preview[thick_mask, :3] = color

    return preview


def clear_old_outputs(output_dir: Path) -> None:
    patterns = [
        "all_layers.png",
        "selected_indexes.png",
        "layer_*.png",
        "layer_*_mask.png",
        "layer_*_visible.png",
    ]
    for pattern in patterns:
        for path in output_dir.glob(pattern):
            path.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test grouped color layers and index selection.")
    parser.add_argument("--image", help="Path to the input image. Defaults to GENERATED.png or image.png.")
    parser.add_argument(
        "--indexes",
        nargs="*",
        type=int,
        default=[0, 1, 2],
        help="Indexes to preview, matching the backend get_strokes route.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).resolve().parent / "test_output"),
        help="Directory for saved preview PNGs.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image_path = resolve_test_image(args.image)
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    clear_old_outputs(output_dir)

    img = Image.open(image_path)
    layer_urls = split_sketch_by_color(img)
    layer_rgba = [decode_layer_data_url(url) for url in layer_urls]

    print(f"Test image: {image_path}")
    print(f"Separated layers: {len(layer_rgba)}")
    print(f"Image size: {img.size[0]} x {img.size[1]}")
    print()

    print("All layer stats:")
    for index, layer in enumerate(layer_rgba):
        visible = layer[layer[..., 3] > 0]
        pixel_count = int(visible.shape[0])
        colors = np.unique(visible[:, :3], axis=0) if pixel_count else np.empty((0, 3), dtype=np.uint8)
        canonical_color = tuple(int(channel) for channel in colors[0]) if len(colors) else None
        print(
            f"index={index:>2}  pixels={pixel_count:>6}  "
            f"visible_colors={len(colors)}  color={canonical_color}"
        )

    stroke_variations = get_stroke_variations(layer_urls, args.indexes)
    print()
    print(f"Requested indexes: {args.indexes}")
    print(f"Returned indexes: {list(stroke_variations.keys())}")

    selected_layers = {index: decode_layer_data_url(data_url) for index, data_url in stroke_variations.items()}

    save_grid(
        {index: layer for index, layer in enumerate(layer_rgba)},
        output_dir / "all_layers.png",
        "All separated stroke layers",
    )
    if selected_layers:
        save_grid(selected_layers, output_dir / "selected_indexes.png", "Selected stroke indexes")

    for index, layer in enumerate(layer_rgba):
        Image.fromarray(layer, mode="RGBA").save(output_dir / f"layer_{index}.png")

        mask = np.zeros_like(layer)
        mask[layer[..., 3] > 0] = [255, 255, 255, 255]
        Image.fromarray(mask, mode="RGBA").save(output_dir / f"layer_{index}_mask.png")

        visible_preview = build_visible_preview(layer)
        Image.fromarray(visible_preview, mode="RGBA").save(output_dir / f"layer_{index}_visible.png")

    for index, layer in selected_layers.items():
        Image.fromarray(layer, mode="RGBA").save(output_dir / f"layer_{index}.png")

    print()
    print(f"Saved preview files to: {output_dir}")
    print(f"- {output_dir / 'all_layers.png'}")
    print("- all individual layer PNGs: layer_<index>.png")
    print("- all individual mask previews: layer_<index>_mask.png")
    print("- all thicker visible previews: layer_<index>_visible.png")
    if selected_layers:
        print(f"- {output_dir / 'selected_indexes.png'}")


if __name__ == "__main__":
    main()

/**
 * Single source of truth for scaling guide strokes from backend pixel coords
 * to canvas coords. Used by both DrawingCanvas (display) and useStrokeGuide (validation).
 */

export interface UniformLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
}

/**
 * Compute uniform (aspect-ratio-preserving) scale + centering offsets
 * to map from guide image space to canvas space.
 */
export function computeUniformLayout(
  canvasWidth: number,
  canvasHeight: number,
  guideImageWidth: number,
  guideImageHeight: number
): UniformLayout | null {
  if (!canvasWidth || !canvasHeight || !guideImageWidth || !guideImageHeight) return null;

  const scaleX = canvasWidth / guideImageWidth;
  const scaleY = canvasHeight / guideImageHeight;
  const scale = Math.min(scaleX, scaleY);
  const drawWidth = guideImageWidth * scale;
  const drawHeight = guideImageHeight * scale;
  const offsetX = (canvasWidth - drawWidth) / 2;
  const offsetY = (canvasHeight - drawHeight) / 2;

  return { scale, offsetX, offsetY, drawWidth, drawHeight };
}

/**
 * Scale an array of [x, y] point pairs from guide image pixel coords
 * to canvas coords, returning a flat [x, y, x, y, ...] array.
 */
export function scaleGuidePoints(
  points: number[][],
  layout: UniformLayout
): number[] {
  const { scale, offsetX, offsetY } = layout;
  const flat: number[] = [];
  for (const [x, y] of points) {
    flat.push(x * scale + offsetX, y * scale + offsetY);
  }
  return flat;
}

/**
 * Compute the total arc length of a polyline given as a flat [x, y, x, y, ...] array.
 */
export function polylineLength(flat: number[]): number {
  let len = 0;
  for (let i = 2; i < flat.length; i += 2) {
    const dx = flat[i] - flat[i - 2];
    const dy = flat[i + 1] - flat[i - 1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

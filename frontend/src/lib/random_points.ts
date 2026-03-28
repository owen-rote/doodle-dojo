/**
 * Random guide dots for the drawing canvas.
 * Rendered as overlay circles the user should connect with strokes.
 * Replace or remove this file when real guide strokes are ready.
 */

export interface GuidePoint {
  xRatio: number; // 0–1 (fraction of canvas width)
  yRatio: number; // 0–1 (fraction of canvas height)
}

/** Seeded LCG for deterministic positions across renders */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export const GUIDE_POINT_COUNT = 8;
export const GUIDE_POINT_RADIUS = 6; // px

/** Generates guide dot positions, keeping them away from the canvas edges */
export function generateGuidePoints(seed = 42, count = GUIDE_POINT_COUNT): GuidePoint[] {
  const rand = lcg(seed);
  return Array.from({ length: count }, () => ({
    xRatio: 0.1 + rand() * 0.8,
    yRatio: 0.1 + rand() * 0.8,
  }));
}

/** Stable export — same points every session */
export const GUIDE_POINTS: GuidePoint[] = generateGuidePoints(42);

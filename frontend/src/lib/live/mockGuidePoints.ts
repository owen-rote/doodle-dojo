/**
 * Deterministic pseudo-random guide dots in normalized [0,1] space.
 * Mapped to canvas size in the component.
 */
export function guidePointsNormalized(seed = 42): { x: number; y: number }[] {
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const points: { x: number; y: number }[] = [];
  let x = 0.15 + next() * 0.1;
  let y = 0.35 + next() * 0.1;
  const steps = 48;
  for (let i = 0; i < steps; i++) {
    points.push({ x, y });
    x += (next() - 0.45) * 0.04 + 0.012;
    y += (next() - 0.48) * 0.035 + 0.008;
    x = Math.min(0.88, Math.max(0.08, x));
    y = Math.min(0.82, Math.max(0.12, y));
  }
  return points;
}

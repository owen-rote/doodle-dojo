import { useCallback } from "react";
import { polylineLength } from "@/lib/guideScaling";
import type { ValidationResult } from "@/types";

// ─── Relative thresholds (fraction of guide stroke length) ───
const DEFAULT_PASS_RATIO = 0.12; // 12% deviation → pass
const DEFAULT_RETRY_RATIO = 0.20; // 20% deviation → retry
// anything above retry → fail

// Minimum pixel thresholds so very short strokes aren't impossibly strict
const MIN_PASS_PX = 30;
const MIN_RETRY_PX = 50;

export interface StrokeThresholds {
  pass: number; // pixels
  retry: number; // pixels
}

/**
 * Compute pixel thresholds for a guide stroke.
 * Uses per-stroke `tolerance` if provided, otherwise derives from stroke length.
 */
export function computeThresholds(
  scaledGuideFlat: number[],
  tolerance?: number
): StrokeThresholds {
  if (tolerance && tolerance > 0) {
    // Per-stroke tolerance from StrokeData: treat as pass threshold (pixels),
    // retry is 1.6× pass (same ratio as default 0.20/0.12 ≈ 1.67)
    return {
      pass: Math.max(MIN_PASS_PX, tolerance),
      retry: Math.max(MIN_RETRY_PX, tolerance * 1.6),
    };
  }

  const strokeLen = polylineLength(scaledGuideFlat);
  return {
    pass: Math.max(MIN_PASS_PX, strokeLen * DEFAULT_PASS_RATIO),
    retry: Math.max(MIN_RETRY_PX, strokeLen * DEFAULT_RETRY_RATIO),
  };
}

export function useStrokeValidation() {
  /** Euclidean distance between two points */
  const dist = useCallback(
    (ax: number, ay: number, bx: number, by: number): number =>
      Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2),
    []
  );

  /** Discrete Fréchet distance between two polylines (flat arrays [x,y,x,y,...]) */
  const frechetDistance = useCallback(
    (P: number[], Q: number[]): number => {
      const pLen = P.length / 2;
      const qLen = Q.length / 2;

      if (pLen === 0 || qLen === 0) return Infinity;

      const ca: number[][] = Array.from({ length: pLen }, () =>
        Array(qLen).fill(-1)
      );

      const d = (i: number, j: number): number =>
        dist(P[i * 2], P[i * 2 + 1], Q[j * 2], Q[j * 2 + 1]);

      const compute = (i: number, j: number): number => {
        if (ca[i][j] > -1) return ca[i][j];

        if (i === 0 && j === 0) {
          ca[i][j] = d(0, 0);
        } else if (i > 0 && j === 0) {
          ca[i][j] = Math.max(compute(i - 1, 0), d(i, 0));
        } else if (i === 0 && j > 0) {
          ca[i][j] = Math.max(compute(0, j - 1), d(0, j));
        } else {
          ca[i][j] = Math.max(
            Math.min(
              compute(i - 1, j),
              compute(i - 1, j - 1),
              compute(i, j - 1)
            ),
            d(i, j)
          );
        }

        return ca[i][j];
      };

      return compute(pLen - 1, qLen - 1);
    },
    [dist]
  );

  /** Validate a user stroke against a scaled guide stroke */
  const validateStroke = useCallback(
    (
      userStrokeFlat: number[],
      scaledGuideFlat: number[],
      tolerance?: number
    ): ValidationResult => {
      const thresholds = computeThresholds(scaledGuideFlat, tolerance);
      const distance = frechetDistance(userStrokeFlat, scaledGuideFlat);
      const accuracy = Math.max(
        0,
        Math.min(100, 100 - (distance / thresholds.pass) * 50)
      );

      if (distance <= thresholds.pass) {
        return {
          status: "pass",
          accuracy,
          message: "Great job! Moving to the next stroke.",
        };
      } else if (distance <= thresholds.retry) {
        return {
          status: "retry",
          accuracy,
          message: "Almost! Try again.",
        };
      } else {
        return {
          status: "fail",
          accuracy,
          message: "Follow the dotted line more closely.",
        };
      }
    },
    [frechetDistance]
  );

  return { validateStroke, frechetDistance };
}

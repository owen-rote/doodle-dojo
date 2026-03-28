import { useCallback } from "react";
import type { ValidationResult } from "@/types";

// ─── Pixel-based Fréchet distance thresholds (tweak these easily) ───
/** PASS: distance ≤ this → advance to next stroke */
export const PASS_THRESHOLD = 200;
/** RETRY: distance ≤ this → "Almost! Try again" */
export const RETRY_THRESHOLD = 350;
/** FAIL: distance > RETRY_THRESHOLD → show guidance */

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

      // DP table
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

  /** Validate a user stroke against a guide stroke */
  const validateStroke = useCallback(
    (
      userStroke: number[],
      guideStrokeNormalized: number[],
      tolerance: number,
      canvasSize: { width: number; height: number }
    ): ValidationResult => {
      // Scale guide from 0–1 to canvas coordinates (uniform scale with 10px padding)
      const PADDING = 10;
      const uniformScale = Math.min(
        canvasSize.width - PADDING * 2,
        canvasSize.height - PADDING * 2
      );
      const offsetX = (canvasSize.width - uniformScale) / 2;
      const offsetY = (canvasSize.height - uniformScale) / 2;
      const scaledGuide = guideStrokeNormalized.map((val, i) =>
        i % 2 === 0 ? val * uniformScale + offsetX : val * uniformScale + offsetY
      );

      const distance = frechetDistance(userStroke, scaledGuide);
      const accuracy = Math.max(
        0,
        Math.min(100, 100 - (distance / tolerance) * 50)
      );

      if (distance <= tolerance) {
        return {
          status: "pass",
          accuracy,
          message: "Great job! Moving to the next stroke.",
        };
      } else if (distance <= tolerance * 1.5) {
        return {
          status: "retry",
          accuracy,
          message: "Close! Try to follow the curve more closely.",
        };
      } else {
        return {
          status: "fail",
          accuracy,
          message: "Let's try that stroke again.",
        };
      }
    },
    [frechetDistance]
  );

  return { validateStroke, frechetDistance };
}

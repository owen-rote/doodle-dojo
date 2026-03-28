"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useStrokeValidation } from "./useStrokeValidation";
import { computeUniformLayout, scaleGuidePoints } from "@/lib/guideScaling";

export function useStrokeGuide() {
  const loadedRef = useRef(false);
  const { validateStroke } = useStrokeValidation();

  useEffect(() => {
    const strokes = useSessionStore.getState().guideStrokes;
    if (strokes.length > 0) loadedRef.current = true;

    return useSessionStore.subscribe((state) => {
      if (state.guideStrokes.length > 0) loadedRef.current = true;
    });
  }, []);

  useEffect(() => {
    let prev = useCanvasStore.getState().isDrawing;
    return useCanvasStore.subscribe((state) => {
      const wasDrawing = prev;
      prev = state.isDrawing;

      if (wasDrawing && !state.isDrawing && loadedRef.current) {
        const canvasState = useCanvasStore.getState();
        const sessionState = useSessionStore.getState();
        const {
          currentStrokeIndex,
          guideStrokes,
          guideImageWidth,
          guideImageHeight,
          strokePlan,
          markStrokeComplete,
          advanceToNextStroke,
          setValidationMessage,
        } = sessionState;

        if (currentStrokeIndex >= guideStrokes.length) return;

        const userStroke = canvasState.userStrokes[canvasState.userStrokes.length - 1];
        if (!userStroke) return;

        const { stage } = canvasState;
        if (!stage) return;

        // Use shared scaling (single source of truth)
        const layout = computeUniformLayout(
          stage.width(),
          stage.height(),
          guideImageWidth,
          guideImageHeight
        );
        if (!layout) return;

        const guideStroke = guideStrokes[currentStrokeIndex];
        const scaledGuideFlat = scaleGuidePoints(guideStroke.points, layout);

        // Read per-stroke tolerance from stroke plan if available
        const strokePlanData = strokePlan?.strokes?.[currentStrokeIndex];
        const tolerance = strokePlanData?.tolerance;

        const result = validateStroke(userStroke.points, scaledGuideFlat, tolerance);

        if (result.status === "pass") {
          markStrokeComplete(currentStrokeIndex);
          advanceToNextStroke();
        } else if (result.status === "retry") {
          const failedStrokeId = userStroke.id;
          setValidationMessage(result.message);
          setTimeout(() => {
            useCanvasStore.getState().removeStrokeById(failedStrokeId);
            useSessionStore.getState().setValidationMessage(null);
          }, 1200);
        } else {
          const failedStrokeId = userStroke.id;
          setValidationMessage(result.message);
          setTimeout(() => {
            useCanvasStore.getState().removeStrokeById(failedStrokeId);
            useSessionStore.getState().setValidationMessage(null);
          }, 1500);
        }
      }
    });
  }, [validateStroke]);
}

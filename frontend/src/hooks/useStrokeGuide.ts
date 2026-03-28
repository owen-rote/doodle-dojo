"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useStrokeValidation, PASS_THRESHOLD, RETRY_THRESHOLD } from "./useStrokeValidation";

export function useStrokeGuide() {
  const loadedRef = useRef(false);
  const { frechetDistance } = useStrokeValidation();

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
          markStrokeComplete,
          advanceToNextStroke,
          setValidationMessage,
        } = sessionState;

        if (currentStrokeIndex >= guideStrokes.length) return;

        const userStroke = canvasState.userStrokes[canvasState.userStrokes.length - 1];
        if (!userStroke) return;

        const { stage } = canvasState;
        if (!stage) return;

        const canvasWidth = stage.width();
        const canvasHeight = stage.height();

        // Uniform scaling (must match DrawingCanvas uniformLayout logic)
        const scaleX = canvasWidth / guideImageWidth;
        const scaleY = canvasHeight / guideImageHeight;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (canvasWidth - guideImageWidth * scale) / 2;
        const offsetY = (canvasHeight - guideImageHeight * scale) / 2;

        // Convert guide points to flat array in canvas coords
        const guideStroke = guideStrokes[currentStrokeIndex];
        const scaledGuideFlat: number[] = [];
        for (const [x, y] of guideStroke.points) {
          scaledGuideFlat.push(x * scale + offsetX, y * scale + offsetY);
        }

        // Compute Fréchet distance (pixels)
        const distance = frechetDistance(userStroke.points, scaledGuideFlat);

        if (distance <= PASS_THRESHOLD) {
          // PASS — keep user stroke, hide guide, advance to next
          markStrokeComplete(currentStrokeIndex);
          advanceToNextStroke();
        } else if (distance <= RETRY_THRESHOLD) {
          // RETRY — "Almost! Try again", clear user stroke, keep guide
          const failedStrokeId = userStroke.id;
          setValidationMessage("Almost! Try again");
          setTimeout(() => {
            useCanvasStore.getState().removeStrokeById(failedStrokeId);
            useSessionStore.getState().setValidationMessage(null);
          }, 1200);
        } else {
          // FAIL — show guidance, clear user stroke, keep guide
          const failedStrokeId = userStroke.id;
          setValidationMessage("Follow the dotted line more closely");
          setTimeout(() => {
            useCanvasStore.getState().removeStrokeById(failedStrokeId);
            useSessionStore.getState().setValidationMessage(null);
          }, 1500);
        }
      }
    });
  }, [frechetDistance]);
}

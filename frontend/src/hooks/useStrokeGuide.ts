"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";

export function useStrokeGuide() {
  const loadedRef = useRef(false);

  useEffect(() => {
    // Mark as loaded once strokes are available in the store
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
        const { currentStrokeIndex, guideStrokes, markStrokeComplete, advanceToNextStroke } =
          useSessionStore.getState();
        if (currentStrokeIndex < guideStrokes.length) {
          markStrokeComplete(currentStrokeIndex);
          advanceToNextStroke();
        }
      }
    });
  }, []);
}

"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";

const MAX_STROKES_TO_FETCH = 30;

async function fetchAllStrokes(): Promise<string[]> {
  const indexes = Array.from({ length: MAX_STROKES_TO_FETCH }, (_, i) => i);
  const res = await fetch("http://0.0.0.0:8000/api/get_strokes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ indexes }),
  });
  if (!res.ok) return [];
  const data = await res.json() as { stroke_variations?: Record<string, string> };
  const variations = data.stroke_variations ?? {};
  return Object.entries(variations)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, url]) => url);
}

export function useStrokeGuide() {
  const strokeImagesRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  const { setGuideImage, setTotalStrokes, markStrokeComplete } = useSessionStore.getState();

  const showStroke = (index: number) => {
    const images = strokeImagesRef.current;
    if (index < images.length) {
      setGuideImage(images[index]);
    } else {
      setGuideImage(null); // all strokes done
    }
  };

  const load = async () => {
    const images = await fetchAllStrokes();
    if (images.length === 0) {
      return;
    }
    strokeImagesRef.current = images;
    currentIndexRef.current = 0;
    loadedRef.current = true;
    setTotalStrokes(images.length);
    showStroke(0);
  };

  // Load all strokes on mount
  useEffect(() => {
    void load();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      setGuideImage(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance to next stroke when user finishes a stroke
  useEffect(() => {
    let prev = useCanvasStore.getState().isDrawing;
    return useCanvasStore.subscribe((state) => {
      const wasDrawing = prev;
      prev = state.isDrawing;
      if (wasDrawing && !state.isDrawing && loadedRef.current) {
        const completedIndex = currentIndexRef.current;
        markStrokeComplete(completedIndex);
        currentIndexRef.current += 1;
        showStroke(currentIndexRef.current);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

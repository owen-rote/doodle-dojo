import { create } from "zustand";
import type { StrokePlan } from "@/types";

export interface BackendStroke {
  stroke_id: number;
  point_count: number;
  stroke_len_px: number;
  points: number[][];
}

interface SessionState {
  sessionId: string | null;
  sessionTitle: string;
  mode: "image" | "text";
  referenceImageUrl: string | null;
  strokePlan: StrokePlan | null;
  currentStrokeIndex: number;
  completedStrokeIndices: number[];
  progress: number; // 0–100

  // Stroke guide data from backend
  guideStrokes: BackendStroke[];
  guideImageWidth: number;
  guideImageHeight: number;

  validationMessage: string | null;

  // Lyria music context
  lyriaPrompt: string | null;
  lyriaImageBase64: string | null;

  setSession: (data: Partial<SessionState>) => void;
  advanceToNextStroke: () => void;
  markStrokeComplete: (index: number) => void;
  resetSession: () => void;
  setValidationMessage: (msg: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  sessionTitle: "",
  mode: "text",
  referenceImageUrl: null,
  strokePlan: null,
  currentStrokeIndex: 0,
  completedStrokeIndices: [],
  progress: 0,
  guideStrokes: [],
  guideImageWidth: 0,
  guideImageHeight: 0,
  validationMessage: null,
  lyriaPrompt: null,
  lyriaImageBase64: null,

  setSession: (data) => set((state) => ({ ...state, ...data })),

  advanceToNextStroke: () =>
    set((state) => ({
      currentStrokeIndex: state.currentStrokeIndex + 1,
    })),

  markStrokeComplete: (index) =>
    set((state) => {
      const newCompleted = [...state.completedStrokeIndices, index];
      const total = state.guideStrokes.length || state.strokePlan?.total_strokes || 1;
      return {
        completedStrokeIndices: newCompleted,
        progress: Math.round((newCompleted.length / total) * 100),
      };
    }),

  resetSession: () =>
    set({
      currentStrokeIndex: 0,
      completedStrokeIndices: [],
      progress: 0,
      validationMessage: null,
    }),

  setValidationMessage: (msg) => set({ validationMessage: msg }),
}));

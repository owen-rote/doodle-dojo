import { create } from "zustand";
import type { StrokePlan } from "@/types";

interface SessionState {
  sessionId: string | null;
  sessionTitle: string;
  mode: "image" | "text";
  referenceImageUrl: string | null;
  strokePlan: StrokePlan | null;
  currentStrokeIndex: number;
  completedStrokeIndices: number[];
  progress: number; // 0–100

  setSession: (data: Partial<SessionState>) => void;
  advanceToNextStroke: () => void;
  markStrokeComplete: (index: number) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  sessionTitle: "",
  mode: "text",
  referenceImageUrl: null,
  strokePlan: null,
  currentStrokeIndex: 0,
  completedStrokeIndices: [],
  progress: 0,

  setSession: (data) => set((state) => ({ ...state, ...data })),

  advanceToNextStroke: () =>
    set((state) => ({
      currentStrokeIndex: Math.min(
        state.currentStrokeIndex + 1,
        (state.strokePlan?.total_strokes ?? 1) - 1
      ),
    })),

  markStrokeComplete: (index) =>
    set((state) => {
      const newCompleted = [...state.completedStrokeIndices, index];
      const total = state.strokePlan?.total_strokes ?? 1;
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
    }),
}));

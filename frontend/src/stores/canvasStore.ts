import { create } from "zustand";
import type Konva from "konva";
import type { DrawingTool, Stroke } from "@/types";

interface CanvasState {
  activeTool: DrawingTool;
  brushSize: number;
  brushColor: string;
  userStrokes: Stroke[];
  currentStroke: number[];
  isDrawing: boolean;
  strokeHistory: Stroke[][];
  /** Registered from Konva for Gemini Live frame capture */
  konvaStage: Konva.Stage | null;

  setTool: (tool: DrawingTool) => void;
  setBrushSize: (size: number) => void;
  startDrawing: (x: number, y: number) => void;
  addPoint: (x: number, y: number) => void;
  finishStroke: () => void;
  undo: () => void;
  clearCanvas: () => void;
  setKonvaStage: (stage: Konva.Stage | null) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  activeTool: "pen",
  brushSize: 3,
  brushColor: "#1F2937",
  userStrokes: [],
  currentStroke: [],
  isDrawing: false,
  strokeHistory: [],
  konvaStage: null,

  setTool: (tool) => set({ activeTool: tool }),
  setBrushSize: (size) => set({ brushSize: size }),

  startDrawing: (x, y) =>
    set({ currentStroke: [x, y], isDrawing: true }),

  addPoint: (x, y) =>
    set((state) => ({
      currentStroke: [...state.currentStroke, x, y],
    })),

  finishStroke: () => {
    const { currentStroke, activeTool, brushSize, brushColor, userStrokes } = get();
    if (currentStroke.length < 4) {
      set({ currentStroke: [], isDrawing: false });
      return;
    }
    const newStroke: Stroke = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      points: currentStroke,
      tool: activeTool,
      size: brushSize,
      color: activeTool === "eraser" ? "#FFFFFF" : brushColor,
    };
    set({
      userStrokes: [...userStrokes, newStroke],
      strokeHistory: [...get().strokeHistory, userStrokes],
      currentStroke: [],
      isDrawing: false,
    });
  },

  undo: () =>
    set((state) => {
      if (state.strokeHistory.length === 0) return state;
      const previous = state.strokeHistory[state.strokeHistory.length - 1];
      return {
        userStrokes: previous,
        strokeHistory: state.strokeHistory.slice(0, -1),
      };
    }),

  clearCanvas: () =>
    set({ userStrokes: [], currentStroke: [], strokeHistory: [] }),

  setKonvaStage: (konvaStage) => set({ konvaStage }),
}));

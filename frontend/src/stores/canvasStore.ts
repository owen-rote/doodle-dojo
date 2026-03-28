import { create } from "zustand";
import type Konva from "konva";
import type { DrawingTool, Stroke } from "@/types";

interface CanvasSnapshot {
  userStrokes: Stroke[];
  fillImageUrl: string | null;
}

interface CanvasState {
  activeTool: DrawingTool;
  brushSize: number;
  brushColor: string;
  fillColor: string;
  userStrokes: Stroke[];
  currentStroke: number[];
  isDrawing: boolean;
  fillImageUrl: string | null;
  history: CanvasSnapshot[];
  stage: Konva.Stage | null;

  setTool: (tool: DrawingTool) => void;
  setBrushSize: (size: number) => void;
  setFillColor: (color: string) => void;
  startDrawing: (x: number, y: number) => void;
  addPoint: (x: number, y: number) => void;
  finishStroke: () => void;
  setFillImageUrl: (url: string | null) => void;
  snapshotForUndo: () => void;
  undo: () => void;
  clearCanvas: () => void;
  setStage: (stage: Konva.Stage | null) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  activeTool: "pen",
  brushSize: 3,
  brushColor: "#1F2937",
  fillColor: "#1F2937",
  userStrokes: [],
  currentStroke: [],
  isDrawing: false,
  fillImageUrl: null,
  history: [],
  stage: null,

  setTool: (tool) => set({ activeTool: tool }),
  setBrushSize: (size) => set({ brushSize: size }),
  setFillColor: (color) => set({ fillColor: color }),

  startDrawing: (x, y) =>
    set({ currentStroke: [x, y], isDrawing: true }),

  addPoint: (x, y) =>
    set((state) => ({
      currentStroke: [...state.currentStroke, x, y],
    })),

  finishStroke: () => {
    const { currentStroke, activeTool, brushSize, fillColor, userStrokes, fillImageUrl, history } = get();
    if (currentStroke.length < 4) {
      set({ currentStroke: [], isDrawing: false });
      return;
    }
    const newStroke: Stroke = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      points: currentStroke,
      tool: activeTool,
      size: brushSize,
      color: activeTool === "eraser" ? "#FFFFFF" : activeTool === "pen" ? "#000000" : fillColor,
    };
    set({
      userStrokes: [...userStrokes, newStroke],
      history: [...history, { userStrokes, fillImageUrl }],
      currentStroke: [],
      isDrawing: false,
    });
  },

  setFillImageUrl: (url) => set({ fillImageUrl: url }),

  snapshotForUndo: () => {
    const { userStrokes, fillImageUrl, history } = get();
    set({ history: [...history, { userStrokes, fillImageUrl }] });
  },

  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1];
      return {
        userStrokes: previous.userStrokes,
        fillImageUrl: previous.fillImageUrl,
        history: state.history.slice(0, -1),
      };
    }),

  clearCanvas: () =>
    set({ userStrokes: [], currentStroke: [], fillImageUrl: null, history: [] }),

  setStage: (stage) => set({ stage }),
}));

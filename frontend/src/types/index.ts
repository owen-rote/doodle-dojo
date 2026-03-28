// --- Drawing Tools ---

export type DrawingTool = "pen" | "brush" | "eraser";

// --- Feedback ---

export type FeedbackType = "feedback" | "tip" | "success" | "error";

export interface FeedbackMessage {
  id: string;
  type: FeedbackType;
  text: string;
  timestamp: number;
}

// --- Strokes ---

export interface Stroke {
  id: string;
  points: number[];
  tool: DrawingTool;
  size: number;
  color: string;
}

export interface StrokeData {
  id: string;
  step: number;
  label: string;
  instruction: string;
  points: number[]; // Normalized 0–1
  tension: number;
  closed: boolean;
  tolerance: number;
  difficulty: string;
  tips: string;
  common_mistakes: string;
}

export interface StrokePlan {
  version: string;
  total_strokes: number;
  strokes: StrokeData[];
}

// --- Validation ---

export interface ValidationResult {
  status: "pass" | "fail" | "retry";
  accuracy: number; // 0–100
  message: string;
}

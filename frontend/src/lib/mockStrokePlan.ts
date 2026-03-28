import type { StrokePlan } from "@/types";
import rawStrokes from "./pikachuRawStrokes.json";

// Bounding box of the raw data (pre-computed from the coordinate file)
const RAW_MIN_X = 228;
const RAW_MAX_X = 5498;
const RAW_MIN_Y = 463;
const RAW_MAX_Y = 5720;
const RAW_W = RAW_MAX_X - RAW_MIN_X;
const RAW_H = RAW_MAX_Y - RAW_MIN_Y;

/** Normalize a flat [x,y,x,y,...] array from raw coords to 0–1 range */
function normalize(points: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push((points[i] - RAW_MIN_X) / RAW_W);
    out.push((points[i + 1] - RAW_MIN_Y) / RAW_H);
  }
  return out;
}

const strokeMeta = [
  { label: "Body outline", instruction: "Draw the full body outline of Pikachu starting from the bottom left, going up through the ears and back down", difficulty: "hard", tips: "Take it slow, follow the overall silhouette", common_mistakes: "Rushing through the curves" },
  { label: "Right eye", instruction: "Draw the right eye as a small circle", difficulty: "easy", tips: "Keep it round and small", common_mistakes: "Making it too large" },
  { label: "Left eye", instruction: "Draw the left eye as a small circle", difficulty: "easy", tips: "Match the size of the right eye", common_mistakes: "Uneven sizing" },
  { label: "Mouth line", instruction: "Draw the small curved mouth", difficulty: "easy", tips: "A gentle curve, like a tiny smile", common_mistakes: "Making it too wide" },
  { label: "Nose/smile", instruction: "Draw the nose and smile detail", difficulty: "medium", tips: "Light wavy line across the face", common_mistakes: "Too pronounced" },
  { label: "Left ear detail", instruction: "Draw the dark tip of the left ear", difficulty: "medium", tips: "Follow the ear shape from the outline", common_mistakes: "Extending beyond the ear" },
  { label: "Right ear detail", instruction: "Draw the dark tip of the right ear", difficulty: "medium", tips: "Mirror the left ear detail", common_mistakes: "Asymmetry with the left ear" },
];

export const mockStrokePlan: StrokePlan = {
  version: "1.0",
  total_strokes: rawStrokes.length,
  strokes: strokeMeta.map((meta, i) => ({
    id: `pikachu-stroke-${i}`,
    step: i + 1,
    label: meta.label,
    instruction: meta.instruction,
    points: normalize(rawStrokes[i]),
    tension: 0.5,
    closed: false,
    tolerance: i === 0 ? 80 : 40,
    difficulty: meta.difficulty,
    tips: meta.tips,
    common_mistakes: meta.common_mistakes,
  })),
};

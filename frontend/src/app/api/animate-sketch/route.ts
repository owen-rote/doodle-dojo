import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import type { GenerateVideosOperation, Video } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 300;

const VEO_MODEL = process.env.GEMINI_VEO_MODEL || "veo-3.1-generate-preview";
const API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 24;

const BASE_PROMPT = [
  "Animate the uploaded hand-drawn sketch.",
  "Use the image as the first frame of the video.",
  "Preserve the original subject, composition, clean line-art feel, and mostly white background.",
  "Keep the motion readable, polished, and visually consistent with the sketch itself.",
].join(" ");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(userPrompt?: string) {
  const creativeDirection = userPrompt?.trim()
    ? userPrompt.trim()
    : "Add gentle motion and a subtle camera move that brings the drawing to life.";

  return `${BASE_PROMPT}\n\nCreative direction: ${creativeDirection}`;
}

function extractOperationError(operation: GenerateVideosOperation) {
  const error = operation.error;
  if (!error) return null;

  if (typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }

  return JSON.stringify(error);
}

async function waitForVideo(
  ai: GoogleGenAI,
  operation: GenerateVideosOperation
) {
  let nextOperation = operation;

  for (
    let attempt = 0;
    attempt < MAX_POLL_ATTEMPTS && !nextOperation.done;
    attempt += 1
  ) {
    await sleep(POLL_INTERVAL_MS);
    nextOperation = await ai.operations.getVideosOperation({
      operation: nextOperation,
    });
  }

  return nextOperation;
}

async function resolveVideoBytes(video: Video, apiKey: string) {
  if (video.videoBytes) {
    return {
      videoBase64: video.videoBytes,
      mimeType: video.mimeType || "video/mp4",
    };
  }

  if (!video.uri) {
    throw new Error("Veo returned a video without bytes or a download URL.");
  }

  const response = await fetch(video.uri, {
    headers: {
      "x-goog-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to download the generated Veo video.");
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    videoBase64: Buffer.from(arrayBuffer).toString("base64"),
    mimeType: response.headers.get("content-type") || video.mimeType || "video/mp4",
  };
}

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    imageBase64?: string;
    imageMimeType?: string;
    prompt?: string;
    aspectRatio?: "16:9" | "9:16";
  };

  if (!body.imageBase64) {
    return NextResponse.json(
      { error: "Missing imageBase64" },
      { status: 400 }
    );
  }

  const aspectRatio =
    body.aspectRatio === "9:16" ? "9:16" : "16:9";

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const operation = await ai.models.generateVideos({
      model: VEO_MODEL,
      prompt: buildPrompt(body.prompt),
      image: {
        imageBytes: body.imageBase64,
        mimeType: body.imageMimeType || "image/png",
      },
      config: {
        aspectRatio,
        durationSeconds: 8,
        resolution: "720p",
        numberOfVideos: 1,
        negativePrompt:
          "extra text, watermark, photorealistic textures, dark background, duplicate subjects, cluttered scenery",
      },
    });

    const completedOperation = await waitForVideo(ai, operation);

    if (!completedOperation.done) {
      return NextResponse.json(
        { error: "Timed out while waiting for Veo to finish the animation." },
        { status: 504 }
      );
    }

    const operationError = extractOperationError(completedOperation);
    if (operationError) {
      return NextResponse.json(
        { error: operationError },
        { status: 502 }
      );
    }

    const generatedVideo =
      completedOperation.response?.generatedVideos?.[0]?.video;

    if (!generatedVideo) {
      return NextResponse.json(
        { error: "Veo completed without returning a video." },
        { status: 502 }
      );
    }

    const { videoBase64, mimeType } = await resolveVideoBytes(
      generatedVideo,
      API_KEY
    );

    return NextResponse.json({
      video: videoBase64,
      mimeType,
      model: VEO_MODEL,
    });
  } catch (error) {
    console.error("Animate sketch error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

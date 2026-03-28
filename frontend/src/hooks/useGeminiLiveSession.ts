"use client";

import { useEffect, useRef, useCallback } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import type { Session } from "@google/genai";
import { useCanvasStore } from "@/stores/canvasStore";
import { useCoachStore } from "@/stores/coachStore";

import { Pcm24Player } from "@/lib/pcm24Player";

const rawModel =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL ?? "gemini-2.5-flash-native-audio-latest";
const LIVE_MODEL = rawModel.startsWith("models/") ? rawModel : `models/${rawModel}`;

const LIVE_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
const LIVE_DEBUG = process.env.NEXT_PUBLIC_GEMINI_LIVE_DEBUG === "1";

// How often to push a canvas frame to the model (ms)
const FRAME_INTERVAL_MS = 1000;

const COACH_SYSTEM = `You are a live drawing coach. Each JPEG shows the student's canvas: purple guide dots (target path) and their black ink strokes.

Output style (critical):
- Reply in ONE short sentence, 8–12 words max. End with . ? or !
- Always finish the sentence — never cut off mid-thought.
- Be direct: one concrete observation or tip only. No preamble, no praise padding.
- Examples: "Nice — your stroke tracks the dots well." / "Drift right on the curve, aim lower." / "Clean hit on both dots, keep that pressure."

Content:
- Compare their ink to the purple dots: on-target, drifting, missing, wobbling.
- Talk to the student directly. No meta commentary.`;

async function debugListLiveModels(apiKey: string) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const json = await res.json() as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const liveModels = (json.models ?? []).filter((m) =>
      m.supportedGenerationMethods?.includes("bidiGenerateContent")
    );
    console.log(
      "[Gemini Live] key prefix:", apiKey.slice(0, 8) + "***",
      "| live models:", liveModels.map((m) => m.name)
    );
  } catch (e) {
    console.error("[Gemini Live] Failed to list models:", e);
  }
}

async function captureCanvas(): Promise<string | null> {
  const stage = useCanvasStore.getState().stage;
  if (!stage) return null;
  try {
    const dataUrl = stage.toDataURL({ mimeType: "image/jpeg", quality: 0.7 });
    return dataUrl.split(",")[1] ?? null;
  } catch {
    return null;
  }
}

export function useGeminiLiveSession() {
  const sessionRef = useRef<Session | null>(null);
  const playerRef = useRef<Pcm24Player | null>(null);
  const readyRef = useRef(false);
  const disposedRef = useRef(false);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captionBuffer = useRef("");

  // ── Periodic canvas frame push (turnComplete: false — no response triggered) ──
  const startFrameStream = useCallback(() => {
    if (frameTimerRef.current) return;
    frameTimerRef.current = setInterval(async () => {
      const session = sessionRef.current;
      if (!session || !readyRef.current || disposedRef.current) return;
      const jpeg = await captureCanvas();
      if (!jpeg || disposedRef.current) return;
      try {
        session.sendClientContent({
          turns: [{
            role: "user",
            parts: [{ inlineData: { data: jpeg, mimeType: "image/jpeg" } }],
          }],
          turnComplete: false, // build context, do NOT trigger a response
        });
        if (LIVE_DEBUG) console.log("[Gemini Live] Frame sent (no response expected)");
      } catch (e) {
        if (LIVE_DEBUG) console.warn("[Gemini Live] Frame send error:", e);
      }
    }, FRAME_INTERVAL_MS);
  }, []);

  const stopFrameStream = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
  }, []);

  // ── Stroke completion: request feedback (turnComplete: true — triggers response) ──
  const requestStrokeFeedback = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || !readyRef.current || disposedRef.current) return;

    const jpeg = await captureCanvas();
    if (!jpeg || disposedRef.current) return;

    session.sendClientContent({
      turns: [{
        role: "user",
        parts: [
          { inlineData: { data: jpeg, mimeType: "image/jpeg" } },
          { text: "Stroke complete — give me your coaching feedback." },
        ],
      }],
      turnComplete: true,
    });
  }, []);

  useEffect(() => {
    let prev = useCanvasStore.getState().isDrawing;
    return useCanvasStore.subscribe((state) => {
      if (prev && !state.isDrawing && readyRef.current && !disposedRef.current) {
        void requestStrokeFeedback();
      }
      prev = state.isDrawing;
    });
  }, [requestStrokeFeedback]);

  // ── Main WebSocket connection ──────────────────────────────────────────────
  useEffect(() => {
    disposedRef.current = false;
    playerRef.current = new Pcm24Player();

    const ai = new GoogleGenAI({ apiKey: LIVE_API_KEY });
    let localSession: Session | null = null;

    useCoachStore.getState().setLiveConnectionState("connecting");
    console.log("[Gemini Live] Connecting →", LIVE_MODEL, "| key:", LIVE_API_KEY.slice(0, 8) + "***");

    const connect = async () => {
      await debugListLiveModels(LIVE_API_KEY);
      try {
        localSession = await ai.live.connect({
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
            },
            systemInstruction: COACH_SYSTEM,
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              if (LIVE_DEBUG) console.log("[Gemini Live] WebSocket open");
            },

            onmessage: (msg) => {
              if (disposedRef.current) return;

              const { setLiveConnectionState, setLiveMessage, voiceEnabled } =
                useCoachStore.getState();

              if (msg.setupComplete) {
                readyRef.current = true;
                setLiveConnectionState("live");
                startFrameStream();
                if (LIVE_DEBUG) console.log("[Gemini Live] Setup complete — live! Frame stream started.");
              }

              if (msg.serverContent) {
                // Audio chunks
                if (voiceEnabled && msg.serverContent.modelTurn?.parts) {
                  const player = playerRef.current;
                  for (const part of msg.serverContent.modelTurn.parts) {
                    const p = part as { inlineData?: { data?: string; mimeType?: string } };
                    if (p.inlineData?.data && p.inlineData.mimeType?.startsWith("audio/")) {
                      if (player) {
                        void player.resume().then(
                          () => player.enqueueBase64Pcm(p.inlineData!.data!),
                          () => {}
                        );
                      }
                    }
                  }
                }

                // Text transcription chunks
                const chunk = msg.serverContent.outputTranscription?.text;
                if (chunk) {
                  captionBuffer.current += chunk;
                  if (LIVE_DEBUG) console.log("[Gemini Live] Transcription chunk:", chunk);
                  if (!voiceEnabled) setLiveMessage(captionBuffer.current.trim());
                }

                if (msg.serverContent.turnComplete) {
                  captionBuffer.current = "";
                  if (LIVE_DEBUG) console.log("[Gemini Live] Turn complete");
                }

                if (LIVE_DEBUG && msg.serverContent.interrupted) {
                  console.log("[Gemini Live] Interrupted");
                }
              }
            },

            onerror: (e) => {
              if (LIVE_DEBUG) console.error("[Gemini Live] Error", e);
              useCoachStore.getState().setLiveConnectionState("error");
            },

            onclose: (e) => {
              if (LIVE_DEBUG) console.log("[Gemini Live] Closed", e);
              readyRef.current = false;
              stopFrameStream();
              if (!disposedRef.current) {
                useCoachStore.getState().setLiveConnectionState("idle");
              }
            },
          },
        });

        sessionRef.current = localSession;
      } catch (e) {
        if (LIVE_DEBUG) console.error("[Gemini Live] Connect failed", e);
        if (!disposedRef.current) {
          useCoachStore.getState().setLiveConnectionState("error");
        }
      }
    };

    void connect();

    return () => {
      disposedRef.current = true;
      readyRef.current = false;
      stopFrameStream();
      sessionRef.current = null;
      localSession?.close();
      playerRef.current?.close();
      playerRef.current = null;
      useCoachStore.getState().setLiveConnectionState("idle");
    };
  }, [startFrameStream, stopFrameStream]);

  // ── Voice ON: unlock AudioContext ──────────────────────────────────────────
  const prepareVoicePlayback = useCallback(() => {
    void playerRef.current?.resume();
    const session = sessionRef.current;
    if (session && readyRef.current) {
      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: "Please give me audio feedback on my drawing." }] }],
        turnComplete: true,
      });
    }
  }, []);

  return { prepareVoicePlayback };
}

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

const RECONNECT_DELAY_MS = 2000;

const COACH_SYSTEM = `You are a strict drawing coach. The canvas has a faint dashed guide path and a darker ink stroke the student drew.

Evaluate BOTH of these — fail either one and the stroke is wrong:
1. COVERAGE: Does the ink stroke span the FULL length of the guide? If the guide is a large shape and the ink only covers a small portion, that is wrong — say so.
2. ACCURACY: Where the ink does exist, does it follow the guide closely without drifting?

Reply in ONE sentence, 6–10 words, always complete:
- Full coverage + accurate → short compliment. ("Perfect curve, you followed the full guide!")
- Partial coverage → call it out. ("You only drew part of the guide.")
- Inaccurate → say where it drifts. ("You drifted above the guide midway.")
Never mention colours. Judge shape and coverage only.`;

function captureCanvas(): string | null {
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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionBuffer = useRef("");

  // Stable ref to the connect function so onclose can call it
  const connectRef = useRef<() => Promise<void>>(async () => {});

  // ── Stroke feedback on pen-up ──────────────────────────────────────────────
  const requestStrokeFeedback = useCallback(() => {
    const session = sessionRef.current;
    if (!session || !readyRef.current || disposedRef.current) return;

    const jpeg = captureCanvas();
    if (!jpeg || disposedRef.current) return;

    try {
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
    } catch (e) {
      if (LIVE_DEBUG) console.warn("[Gemini Live] sendClientContent error:", e);
    }
  }, []);

  useEffect(() => {
    let prev = useCanvasStore.getState().isDrawing;
    return useCanvasStore.subscribe((state) => {
      if (prev && !state.isDrawing && readyRef.current && !disposedRef.current) {
        requestStrokeFeedback();
      }
      prev = state.isDrawing;
    });
  }, [requestStrokeFeedback]);

  // ── Main WebSocket connection ──────────────────────────────────────────────
  useEffect(() => {
    disposedRef.current = false;
    playerRef.current = new Pcm24Player();

    const ai = new GoogleGenAI({ apiKey: LIVE_API_KEY });

    const connect = async () => {
      if (disposedRef.current) return;

      useCoachStore.getState().setLiveConnectionState("connecting");
      if (LIVE_DEBUG) console.log("[Gemini Live] Connecting →", LIVE_MODEL);

      try {
        const session = await ai.live.connect({
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
                if (LIVE_DEBUG) console.log("[Gemini Live] Setup complete — live!");
              }

              if (msg.serverContent) {
                // Audio chunks → play when voice enabled
                if (voiceEnabled && msg.serverContent.modelTurn?.parts) {
                  const player = playerRef.current;
                  let hadAudio = false;
                  for (const part of msg.serverContent.modelTurn.parts) {
                    const p = part as { inlineData?: { data?: string; mimeType?: string } };
                    if (p.inlineData?.data && p.inlineData.mimeType?.startsWith("audio/")) {
                      hadAudio = true;
                      if (player) {
                        void player.resume().then(
                          () => player.enqueueBase64Pcm(p.inlineData!.data!),
                          () => {}
                        );
                      }
                    }
                  }
                  if (hadAudio) useCoachStore.getState().setPlaying(true);
                }

                // Text transcription → show when voice disabled
                const chunk = msg.serverContent.outputTranscription?.text;
                if (chunk) {
                  captionBuffer.current += chunk;
                  if (!voiceEnabled) setLiveMessage(captionBuffer.current.trim());
                }

                if (msg.serverContent.turnComplete) {
                  captionBuffer.current = "";
                  useCoachStore.getState().setPlaying(false);
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
              sessionRef.current = null;

              if (disposedRef.current) return;

              // Unexpected close — reconnect after a short delay
              useCoachStore.getState().setLiveConnectionState("connecting");
              reconnectTimerRef.current = setTimeout(() => {
                void connectRef.current();
              }, RECONNECT_DELAY_MS);
            },
          },
        });

        sessionRef.current = session;
      } catch (e) {
        if (LIVE_DEBUG) console.error("[Gemini Live] Connect failed", e);
        if (disposedRef.current) return;

        // Retry on connection failure
        useCoachStore.getState().setLiveConnectionState("error");
        reconnectTimerRef.current = setTimeout(() => {
          void connectRef.current();
        }, RECONNECT_DELAY_MS);
      }
    };

    connectRef.current = connect;
    void connect();

    return () => {
      disposedRef.current = true;
      readyRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      sessionRef.current?.close();
      sessionRef.current = null;
      playerRef.current?.close();
      playerRef.current = null;
      useCoachStore.getState().setLiveConnectionState("idle");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice ON: unlock AudioContext ──────────────────────────────────────────
  const prepareVoicePlayback = useCallback(() => {
    void playerRef.current?.resume();
  }, []);

  return { prepareVoicePlayback };
}

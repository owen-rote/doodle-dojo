"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCoachStore } from "@/stores/coachStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { captureDrawingForLiveApi } from "@/lib/live/captureStageForLive";
import { parseGeminiLiveServerMessage } from "@/lib/live/parseGeminiLiveMessage";
import { Pcm24Player } from "@/lib/live/pcm24Player";

const DEFAULT_WS =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

function normalizeLiveWsPath(raw: string | undefined): string {
  const fallback = DEFAULT_WS;
  const trimmed = raw?.trim().replace(/\s+/g, "");
  if (!trimmed) return fallback;

  let p = trimmed;

  const needsFix =
    /liveService/i.test(p) ||
    /v1b_live/i.test(p) ||
    /v1beta_live/i.test(p);

  if (needsFix) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[Gemini Live] Correcting WebSocket path: use v1beta.GenerativeService.BidiGenerateContent (not liveService)."
      );
    }
    p = p
      .replace(
        /v1b_liveService\.BidiGenerateContent/gi,
        "v1beta.GenerativeService.BidiGenerateContent"
      )
      .replace(
        /v1beta_liveService\.BidiGenerateContent/gi,
        "v1beta.GenerativeService.BidiGenerateContent"
      )
      .replace(
        /\.liveService\.BidiGenerateContent/gi,
        ".GenerativeService.BidiGenerateContent"
      )
      .replace(
        /_liveService\.BidiGenerateContent/gi,
        ".GenerativeService.BidiGenerateContent"
      );
  }

  if (!p.includes("GenerativeService.BidiGenerateContent")) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[Gemini Live] Unrecognized WebSocket path; using default URL.",
        p
      );
    }
    return fallback;
  }

  const pathOnly = p.split("?")[0];
  const validSuffix =
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
  if (
    pathOnly.includes("..") ||
    !pathOnly.toLowerCase().endsWith(validSuffix.toLowerCase())
  ) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[Gemini Live] WebSocket path must end with",
        validSuffix,
        "— using default URL. Got:",
        pathOnly
      );
    }
    return fallback;
  }

  return p;
}

const WS_PATH = normalizeLiveWsPath(
  process.env.NEXT_PUBLIC_GEMINI_LIVE_WS_PATH?.trim()
);

const LIVE_DEBUG =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_DEBUG === "1" ||
  process.env.NEXT_PUBLIC_GEMINI_LIVE_DEBUG === "true";



const LIVE_MODEL =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL?.trim() ||
  "gemini-2.5-flash-native-audio-preview-12-2025";

function liveVoiceName(): string {
  const v = process.env.NEXT_PUBLIC_GEMINI_LIVE_VOICE_NAME?.trim();
  return v || "Kore";
}

const COACH_SYSTEM = `You are a live drawing coach. Each JPEG matches the student's screen: white canvas, faint gray DOTS (target path), darker strokes (their ink).

Output style (critical):
- Every spoken reply must be exactly ONE complete sentence: name what you see (dots + ink), then a concrete tip. Minimum ~14 words, ending with . ? or !
- Never stop after fragments like "Okay, let's", "Your stroke", "That follows", "Follow the", or "That's a" — the same utterance must include the full observation and advice.
- Do not split one idea across multiple short responses; one model turn = one finished sentence the student could act on.

Content:
- Use only what you see in the latest frame. Compare their stroke to the dotted guide: where it tracks, where it drifts, gaps, wobble, thickness.
- An early frame may be Pikachu reference art; later frames are the practice canvas (dots + ink).
- Talk to the student directly (e.g. "Your ink stays close to the gray dots on the left but drifts above them on the curve."). No meta narration about yourself or the API.`;

/**
 * Build the BidiGenerateContent setup handshake.
 *
 * Always uses AUDIO modality — this model only supports audio output.
 * outputAudioTranscription (at setup root, NOT inside generationConfig) causes the
 * server to also emit text transcriptions of the audio, which we show in the UI.
 *
 * Voice toggle controls whether audio is played, not the WebSocket session modality:
 *   Voice OFF → audio arrives but is silenced; transcription shown as text feedback
 *   Voice ON  → audio played via Pcm24Player; transcription shown as caption
 */
function buildLiveHandshake(modelId: string) {
  return {
    setup: {
      model: `models/${modelId}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: liveVoiceName() },
          },
        },
      },
      systemInstruction: {
        parts: [{ text: COACH_SYSTEM }],
      },
      // outputAudioTranscription at setup root (NOT inside generationConfig).
      // Gives text transcription of audio output so the UI shows coach text
      // even when voice playback is off.
      outputAudioTranscription: {},
    },
  };
}

async function fetchUrlToJpegBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const data = canvas.toDataURL("image/jpeg", 0.85);
    const i = data.indexOf(",");
    return i === -1 ? null : data.slice(i + 1);
  } catch {
    return null;
  }
}

function sendVideoBurst(send: (o: unknown) => void, jpegB64: string) {
  send({
    realtimeInput: {
      video: { data: jpegB64, mimeType: "image/jpeg" },
    },
  });
}

type SendFn = (payload: unknown) => void;

export function useGeminiLiveSession(referenceImageUrl: string | null) {
  const konvaStage = useCanvasStore((s) => s.konvaStage);
  const stageRef = useRef(konvaStage);
  stageRef.current = konvaStage;

  const setLiveConnectionState = useCoachStore((s) => s.setLiveConnectionState);
  const setLiveError = useCoachStore((s) => s.setLiveError);
  const mergeLiveCaptionChunk = useCoachStore((s) => s.mergeLiveCaptionChunk);
  const clearLiveCaption = useCoachStore((s) => s.clearLiveCaption);
  const flushLiveCaptionToHistory = useCoachStore(
    (s) => s.flushLiveCaptionToHistory
  );
  const resetLiveServerMetrics = useCoachStore((s) => s.resetLiveServerMetrics);
  const bumpLiveServerEvents = useCoachStore((s) => s.bumpLiveServerEvents);

  const sendLiveRef = useRef<SendFn>(() => {});
  const readyRef = useRef(false);
  const disposedRef = useRef(true);

  const playerRef = useRef<Pcm24Player | null>(null);

  const sendChat = useCallback((text: string) => {
    if (!text.trim() || !readyRef.current) return;
    sendLiveRef.current({
      realtimeInput: { text: text.trim() },
    });
  }, []);

  /**
   * Called on the Voice ON button click (user gesture).
   * Unlocks the AudioContext AND sends a fresh prompt so the model speaks immediately.
   */
  const prepareVoicePlayback = useCallback(() => {
    void playerRef.current?.resume();
    // Ask the model to give audio feedback right now (the previous turn may have
    // been skipped because voice was off; this triggers a new response).
    if (readyRef.current) {
      sendLiveRef.current({
        realtimeInput: { text: "Please give me audio coaching feedback on my current drawing." },
      });
    }
  }, []);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      setLiveConnectionState("no_key");
      setLiveError(
        "Add NEXT_PUBLIC_GEMINI_API_KEY to .env.local for Gemini Live."
      );
      return;
    }

    if (/v1alpha/i.test(WS_PATH) && apiKey) {
      console.warn(
        "[Gemini Live] v1alpha WebSockets expect an ephemeral access_token, not ?key=. Using v1beta is required for API keys."
      );
    }

    disposedRef.current = false;
    readyRef.current = false;
    resetLiveServerMetrics();
    setLiveError(null);
    setLiveConnectionState("connecting");

    if (!playerRef.current) playerRef.current = new Pcm24Player();

    const url = `${WS_PATH}${WS_PATH.includes("?") ? "&" : "?"}key=${encodeURIComponent(apiKey)}`;
    if (LIVE_DEBUG) {
      console.debug("[Gemini Live] connecting →", url.replace(apiKey, "***"));
      console.debug("[Gemini Live] model:", LIVE_MODEL);
    }
    const ws = new WebSocket(url);

    let clientClosing = false;
    let alive = true;

    const send: SendFn = (payload) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };
    sendLiveRef.current = send;

    const sendCanvasFrame = async () => {
      if (!readyRef.current || disposedRef.current) return;
      const jpeg = await captureDrawingForLiveApi(stageRef.current);
      if (!jpeg || disposedRef.current) return;
      sendVideoBurst(send, jpeg);
    };

    /**
     * Called on every stroke completion. Sends the latest canvas frame as visual
     * context, then uses clientContent (queued, non-interrupting) to explicitly
     * request a coaching response. Without this explicit request the native audio
     * model often ignores repeated identical video frames.
     */
    const requestStrokeFeedback = async () => {
      if (!readyRef.current || disposedRef.current) return;
      const jpeg = await captureDrawingForLiveApi(stageRef.current);
      if (!jpeg || disposedRef.current) return;
      // Update the model's visual context with the latest canvas
      sendVideoBurst(send, jpeg);
      // Explicitly request a coaching response for this stroke
      send({
        clientContent: {
          turns: [{ role: "user", parts: [{ text: "stroke" }] }],
          turnComplete: true,
        },
      });
    };

    let prevIsDrawing = useCanvasStore.getState().isDrawing;
    const unsubStroke = useCanvasStore.subscribe((state) => {
      const d = state.isDrawing;
      if (prevIsDrawing && !d && readyRef.current && !disposedRef.current) {
        void requestStrokeFeedback();
      }
      prevIsDrawing = d;
    });

    ws.onopen = () => {
      if (disposedRef.current) return;
      try {
        const handshake = buildLiveHandshake(LIVE_MODEL);
        if (LIVE_DEBUG) console.debug("[Gemini Live] → setup", JSON.stringify(handshake, null, 2));
        ws.send(JSON.stringify(handshake));
      } catch (e) {
        setLiveError(
          e instanceof Error ? e.message : "Failed to send setup message"
        );
        setLiveConnectionState("error");
      }
    };

    ws.onerror = () => {
      if (disposedRef.current || clientClosing) return;
      setLiveConnectionState("error");
      setLiveError("WebSocket error connecting to Gemini Live.");
    };

    ws.onclose = (ev) => {
      readyRef.current = false;

      if (!alive || clientClosing || disposedRef.current) {
        setLiveConnectionState("idle");
        return;
      }

      setLiveConnectionState("error");
      let hint = "";
      if (ev.code === 1006) {
        hint =
          " (abnormal closure — often invalid API key, blocked network, or wrong endpoint)";
      } else if (ev.code === 1007) {
        hint = " — server rejected setup config. Check model name and API access.";
      }
      setLiveError(
        `WebSocket closed (${ev.code})${ev.reason ? `: ${ev.reason}` : ""}${hint}`
      );
    };

    ws.onmessage = async (event) => {
      if (disposedRef.current) return;

      let raw: string;
      if (event.data instanceof Blob) {
        raw = await event.data.text();
      } else {
        raw = String(event.data);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      if (LIVE_DEBUG && typeof console !== "undefined" && console.debug) {
        console.debug("[Gemini Live] ←", parsed);
      }

      const payloads = parseGeminiLiveServerMessage(parsed);
      if (payloads.length > 0) {
        bumpLiveServerEvents(payloads.length);
        if (LIVE_DEBUG) {
          console.log("[Gemini Live] events:", payloads.map((p) => p.kind).join(", "));
        }
      }
      for (const p of payloads) {
        if (p.kind === "setup_complete") {
          readyRef.current = true;
          setLiveConnectionState("live");
          setLiveError(null);

          void (async () => {
            if (referenceImageUrl) {
              const refB64 = await fetchUrlToJpegBase64(referenceImageUrl);
              if (refB64 && !disposedRef.current) {
                sendVideoBurst(send, refB64);
              }
            }

            if (!disposedRef.current) {
              // Send initial canvas state so the model has visual context.
              // Further frames are sent on each stroke completion via requestStrokeFeedback.
              await sendCanvasFrame();
            }
          })();
        }

        if (p.kind === "error") {
          setLiveError(p.message);
          setLiveConnectionState("error");
        }

        if (p.kind === "interrupted") {
          playerRef.current?.interrupt();
          clearLiveCaption();
        }

        // Audio chunks: play when voice is active
        if (p.kind === "audio_b64") {
          if (!useCoachStore.getState().voiceEnabled) continue;
          const player = playerRef.current;
          if (!player) continue;
          const data = p.data;
          void player.resume().then(
            () => { player.enqueueBase64Pcm(data); },
            () => { if (LIVE_DEBUG) console.warn("[Gemini Live] AudioContext resume failed — need a user gesture first"); }
          );
        }

        // Text parts: show in UI when in text mode (voice off)
        if (p.kind === "text" && p.text.trim()) {
          mergeLiveCaptionChunk(p.text);
        }

        if (p.kind === "output_transcription" && p.text) {
          mergeLiveCaptionChunk(p.text);
        }

        if (p.kind === "turn_complete") {
          flushLiveCaptionToHistory();
        }
      }
    };

    return () => {
      unsubStroke();
      alive = false;
      clientClosing = true;
      disposedRef.current = true;
      readyRef.current = false;
      sendLiveRef.current = () => {};
      ws.close(1000, "client disconnect");
      playerRef.current?.close();
      playerRef.current = null;
      setLiveConnectionState("idle");
      clearLiveCaption();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceImageUrl]);

  return { sendChat, prepareVoicePlayback };
}

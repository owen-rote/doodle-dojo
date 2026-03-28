"use client";

import { useEffect, useRef, useCallback } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { useSessionStore } from "@/stores/sessionStore";
import { useCoachStore } from "@/stores/coachStore";
import { LyriaPlayer } from "@/lib/lyriaPlayer";

// 30-second clip model — looped for continuous playback
const LYRIA_MODEL = "lyria-3-clip-preview";
const LIVE_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
const LYRIA_DEBUG = process.env.NEXT_PUBLIC_GEMINI_LIVE_DEBUG === "1";

export function useLyriaSession() {
  const playerRef = useRef<LyriaPlayer | null>(null);
  const disposedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True after audio is loaded and ready — used to retry blocked autoplay
  const loadedRef = useRef(false);

  // ── Voice activity → fade music in/out ──────────────────────────────────
  useEffect(() => {
    return useCoachStore.subscribe((state, prevState) => {
      const player = playerRef.current;
      if (!player || !loadedRef.current) return;

      // User toggled music off → pause
      if (!state.musicEnabled && prevState.musicEnabled) {
        if (resumeTimerRef.current) {
          clearTimeout(resumeTimerRef.current);
          resumeTimerRef.current = null;
        }
        player.fadeOut(0.3);
        setTimeout(() => playerRef.current?.pause(), 300);
        useCoachStore.getState().setMusicState("playing"); // keep "playing" so button stays active
        return;
      }

      // User toggled music on → resume
      if (state.musicEnabled && !prevState.musicEnabled) {
        if (!state.isPlaying) {
          player.unpause();
          player.fadeIn(0.8);
        }
        return;
      }

      // Voice started → fade out (only when music is enabled)
      if (state.isPlaying && !prevState.isPlaying && state.musicEnabled) {
        if (resumeTimerRef.current) {
          clearTimeout(resumeTimerRef.current);
          resumeTimerRef.current = null;
        }
        player.fadeOut(0.4);
        useCoachStore.getState().setMusicState("muted");
        return;
      }

      // Voice ended → fade back in (only when music is enabled)
      if (!state.isPlaying && prevState.isPlaying && state.musicEnabled) {
        resumeTimerRef.current = setTimeout(() => {
          if (!useCoachStore.getState().isPlaying && useCoachStore.getState().musicEnabled) {
            playerRef.current?.fadeIn(1.0);
            useCoachStore.getState().setMusicState("playing");
          }
        }, 600);
      }
    });
  }, []);

  // ── Generate and loop music ──────────────────────────────────────────────
  useEffect(() => {
    disposedRef.current = false;
    loadedRef.current = false;
    playerRef.current = new LyriaPlayer();

    const ai = new GoogleGenAI({ apiKey: LIVE_API_KEY });

    const generateMusic = async () => {
      if (disposedRef.current) return;
      useCoachStore.getState().setMusicState("connecting");

      const { lyriaPrompt, lyriaImageBase64 } = useSessionStore.getState();

      // Build prompt parts — prefer image context, fall back to text
      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
      if (lyriaImageBase64) {
        parts.push({ inlineData: { data: lyriaImageBase64, mimeType: "image/jpeg" } });
        parts.push({
          text: "Calm, ambient, instrumental background music for a creative drawing session. Gentle and encouraging.",
        });
      } else if (lyriaPrompt) {
        parts.push({
          text: `Calm ambient instrumental background music suited to drawing: ${lyriaPrompt}. Gentle, peaceful, encouraging.`,
        });
      } else {
        parts.push({
          text: "Calm, ambient, instrumental background music for a creative drawing session. Gentle and encouraging.",
        });
      }

      try {
        if (LYRIA_DEBUG) console.log("[Lyria] Generating music with", LYRIA_MODEL);

        const response = await ai.models.generateContent({
          model: LYRIA_MODEL,
          contents: [{ role: "user", parts }],
          config: { responseModalities: [Modality.AUDIO] },
        });

        if (disposedRef.current) return;

        // Extract the audio part from the response
        const candidate = response.candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
          const p = part as { inlineData?: { data?: string; mimeType?: string } };
          if (p.inlineData?.data && p.inlineData.mimeType?.startsWith("audio/")) {
            if (LYRIA_DEBUG) console.log("[Lyria] Audio received, loading player");
            playerRef.current?.load(p.inlineData.data, p.inlineData.mimeType);
            loadedRef.current = true;
            if (useCoachStore.getState().musicEnabled) {
              await playerRef.current?.play();
            }
            if (!disposedRef.current) {
              useCoachStore.getState().setMusicState("playing");
            }
            break;
          }
        }
      } catch (e) {
        if (LYRIA_DEBUG) console.error("[Lyria] generateContent failed:", e);
        if (!disposedRef.current) {
          useCoachStore.getState().setMusicState("idle");
        }
      }
    };

    void generateMusic();

    return () => {
      disposedRef.current = true;
      loadedRef.current = false;
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      playerRef.current?.close();
      playerRef.current = null;
      useCoachStore.getState().setMusicState("idle");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Call this from a user-gesture handler (e.g. voice toggle button).
   * Resumes music if it was blocked by the browser's autoplay policy.
   */
  const prepareMusicPlayback = useCallback(() => {
    if (loadedRef.current) {
      void playerRef.current?.resume();
    }
  }, []);

  return { prepareMusicPlayback };
}

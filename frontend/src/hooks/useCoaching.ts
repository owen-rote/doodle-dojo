import { useCallback, useRef } from "react";
import { useCoachStore } from "@/stores/coachStore";
import { useSessionStore } from "@/stores/sessionStore";

type CoachingEvent = "stroke_pass" | "stroke_fail" | "pause" | "help_request";

export function useCoaching() {
  const { addMessage, voiceEnabled } = useCoachStore();
  const failCountRef = useRef(0);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCoaching = useCallback(
    async (event: CoachingEvent, _context?: unknown) => {
      const { strokePlan, currentStrokeIndex } = useSessionStore.getState();
      const currentStroke = strokePlan?.strokes[currentStrokeIndex];

      try {
        const response = await fetch("/api/coaching", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event,
            strokeLabel: currentStroke?.label,
            instruction: currentStroke?.instruction,
            tips: currentStroke?.tips,
            common_mistakes: currentStroke?.common_mistakes,
            failCount: failCountRef.current,
          }),
        });

        if (!response.ok) throw new Error("Coaching API failed");

        const { text } = await response.json();

        const type =
          event === "stroke_pass" ? "success" as const :
          event === "pause" ? "tip" as const : "feedback" as const;

        addMessage(type, text);

        if (event === "stroke_pass") {
          failCountRef.current = 0;
        } else if (event === "stroke_fail") {
          failCountRef.current++;
        }

        // Voice playback if enabled
        if (voiceEnabled) {
          try {
            const ttsRes = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            });
            if (ttsRes.ok) {
              const blob = await ttsRes.blob();
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audio.onended = () => URL.revokeObjectURL(url);
              await audio.play();
            }
          } catch {
            // TTS is best-effort
          }
        }
      } catch {
        // Fallback: use local messages when API is unavailable
        const fallbacks: Record<CoachingEvent, string> = {
          stroke_pass: `Nice work on the ${currentStroke?.label ?? "stroke"}!`,
          stroke_fail: `Try again — ${currentStroke?.tips ?? "follow the guide closely"}.`,
          pause: `Tip: ${currentStroke?.tips ?? "Take your time and follow the dashed line."}`,
          help_request: currentStroke?.instruction ?? "Follow the dashed guide stroke.",
        };
        const type =
          event === "stroke_pass" ? "success" as const :
          event === "pause" ? "tip" as const : "feedback" as const;
        addMessage(type, fallbacks[event]);
      }
    },
    [addMessage, voiceEnabled]
  );

  const startPauseDetection = useCallback(() => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      triggerCoaching("pause");
    }, 2000);
  }, [triggerCoaching]);

  const stopPauseDetection = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  return { triggerCoaching, startPauseDetection, stopPauseDetection };
}

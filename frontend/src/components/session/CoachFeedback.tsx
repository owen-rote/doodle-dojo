"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { FeedbackMessage } from "@/types";
import type { LiveConnectionState } from "@/stores/coachStore";

interface CoachFeedbackProps {
  messages: FeedbackMessage[];
  liveCaption: string;
  liveConnectionState: LiveConnectionState;
  liveError: string | null;
  liveServerEventsCount: number;
  voiceEnabled: boolean;
}

const slideIn = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
  transition: { duration: 0.2, ease: "easeOut" as const },
};

function messageStyle(type: string) {
  switch (type) {
    case "tip":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "error":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
}

function liveStatusLabel(state: LiveConnectionState): string {
  switch (state) {
    case "live":
      return "Live";
    case "connecting":
      return "Connecting…";
    case "no_key":
      return "API key missing";
    case "error":
      return "Error";
    default:
      return "Offline";
  }
}

export default function CoachFeedback({
  messages,
  liveCaption,
  liveConnectionState,
  liveError,
  liveServerEventsCount,
  voiceEnabled,
}: CoachFeedbackProps) {
  const showEmptyHint =
    messages.length === 0 && !liveCaption.trim() && liveConnectionState === "idle";

  const showLiveWaiting =
    liveConnectionState === "live" &&
    !liveCaption.trim() &&
    messages.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5">
          <div
            className={`h-2 w-2 rounded-full ${
              liveConnectionState === "live"
                ? "animate-pulse bg-emerald-400"
                : liveConnectionState === "connecting"
                  ? "animate-pulse bg-amber-400"
                  : "bg-white/20"
            }`}
          />
          <span className="text-[13px] font-medium text-purple-300">
            AI Coach
          </span>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-white/35">
          {liveStatusLabel(liveConnectionState)}
        </span>
        {liveConnectionState === "live" && (
          <span
            className="text-[11px] text-white/30"
            title="Parsed payloads per WebSocket message (audio chunks, transcriptions, etc.). Turn Voice ON and tap the button once to unlock browser audio; on-screen text uses output transcription or TEXT parts."
          >
            · {liveServerEventsCount} evt
          </span>
        )}
      </div>

      {liveError && (
        <p className="mt-2 text-[12px] text-red-400/90">{liveError}</p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {liveCaption.trim() && (
            <motion.div
              key="live-caption"
              {...slideIn}
              className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-3 text-[13px] text-sky-100/95"
            >
              {liveCaption}
            </motion.div>
          )}
          {showLiveWaiting && (
            <motion.p
              key="live-wait"
              {...slideIn}
              className="text-[12px] leading-relaxed text-white/35"
            >
              {voiceEnabled
                ? "Voice mode active — start drawing to hear feedback."
                : "Session open — start drawing to see feedback here."}
            </motion.p>
          )}
          {showEmptyHint && (
            <motion.p
              key="empty"
              {...slideIn}
              className="text-[13px] text-white/30"
            >
              Draw over the guide stroke to begin
            </motion.p>
          )}
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              {...slideIn}
              className={`rounded-lg border p-3 text-[13px] ${messageStyle(msg.type)}`}
            >
              {msg.type === "tip" && <span className="font-medium">Tip: </span>}
              {msg.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCoachStore } from "@/stores/coachStore";
import { useSessionStore } from "@/stores/sessionStore";
import CoachFeedback from "./CoachFeedback";
import ChatInput from "./ChatInput";
import VoiceToggle from "./VoiceToggle";

interface ReferencePanelProps {
  onBeforeVoiceEnable?: () => void;
}

export default function ReferencePanel({ onBeforeVoiceEnable }: ReferencePanelProps) {
  const { messages, voiceEnabled, toggleVoice, liveConnectionState, liveMessage } =
    useCoachStore();
  const { referenceImageUrl } = useSessionStore();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/10 bg-[#0c0c14] p-4">
      {/* Reference Sketch */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="border-b border-white/10 px-3 py-2">
          <span className="text-[12px] font-medium uppercase tracking-wider text-white/40">
            Reference
          </span>
        </div>
        <div className="flex aspect-square items-center justify-center p-2">
          {referenceImageUrl ? (
            <img
              src={referenceImageUrl}
              alt="Reference sketch"
              className="h-full w-full cursor-pointer rounded-lg object-contain transition hover:opacity-80"
              onClick={() => setModalOpen(true)}
            />
          ) : (
            <span className="text-[14px] text-white/30">[Reference Sketch]</span>
          )}
        </div>
      </div>

      {/* Coach Feedback */}
      <CoachFeedback messages={messages} />

      {/* Chat Input */}
      <ChatInput onSend={(msg) => console.log("Chat:", msg)} />

      {/* Voice Toggle */}
      <VoiceToggle
        isEnabled={voiceEnabled}
        onToggle={toggleVoice}
        onBeforeVoiceEnable={onBeforeVoiceEnable}
      />

      {/* Live feedback text box — shown below voice toggle when voice is OFF */}
      {!voiceEnabled && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 min-h-[64px]">
          <div className="mb-1.5 flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                liveConnectionState === "live"
                  ? "animate-pulse bg-emerald-400"
                  : liveConnectionState === "connecting"
                    ? "animate-pulse bg-yellow-400"
                    : liveConnectionState === "error"
                      ? "bg-red-400"
                      : "bg-white/20"
              }`}
            />
            <span className="text-[11px] text-white/30">
              {liveConnectionState === "live"
                ? "Live"
                : liveConnectionState === "connecting"
                  ? "Connecting…"
                  : liveConnectionState === "error"
                    ? "Disconnected"
                    : "Offline"}
            </span>
          </div>
          <AnimatePresence mode="wait">
            {liveMessage ? (
              <motion.p
                key={liveMessage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[13px] leading-snug text-white/70"
              >
                {liveMessage}
              </motion.p>
            ) : (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[13px] text-white/25"
              >
                {liveConnectionState === "live"
                  ? "Draw to get feedback…"
                  : "Waiting for AI coach…"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Reference Image Modal */}
      {modalOpen && referenceImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative max-h-[85vh] max-w-[85vw] overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c14] p-2 shadow-2xl shadow-purple-500/10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={referenceImageUrl}
              alt="Reference sketch (full size)"
              className="max-h-[80vh] max-w-[80vw] rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </aside>
  );
}

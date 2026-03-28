"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { FeedbackMessage } from "@/types";

interface CoachFeedbackProps {
  messages: FeedbackMessage[];
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

export default function CoachFeedback({ messages }: CoachFeedbackProps) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5">
        <div className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
        <span className="text-[13px] font-medium text-purple-300">
          AI Coach
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 && (
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

"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { MusicMood } from "@/hooks/useBackgroundMusic";

interface MusicPlayerProps {
  isPlaying: boolean;
  mood: MusicMood | null;
  onToggle: () => void;
}

export default function MusicPlayer({ isPlaying, mood, onToggle }: MusicPlayerProps) {
  return (
    <AnimatePresence>
      {mood && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pointer-events-none absolute bottom-6 left-6 z-20"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-[#11111a]/90 px-4 py-2.5 shadow-lg backdrop-blur-xl">
            {/* Play/Pause button */}
            <button
              type="button"
              onClick={onToggle}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/20 text-purple-300 transition hover:bg-purple-500/30 hover:text-purple-200"
            >
              {isPlaying ? (
                // Pause icon
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                // Play icon
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11-7.36a1 1 0 0 0 0-1.72l-11-7.36A1 1 0 0 0 8 5.14Z" />
                </svg>
              )}
            </button>

            {/* Animated bars when playing */}
            <div className="flex h-5 items-end gap-[3px]">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-[3px] rounded-full bg-purple-400 transition-all duration-300 ${
                    isPlaying ? "animate-pulse" : ""
                  }`}
                  style={{
                    height: isPlaying ? `${8 + Math.sin(i * 1.5) * 8 + 4}px` : "4px",
                    animationDelay: `${i * 150}ms`,
                    opacity: isPlaying ? 0.8 : 0.3,
                  }}
                />
              ))}
            </div>

            {/* Mood label */}
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Vibe
              </span>
              <span className="text-xs font-medium text-white/70">
                {mood.mood}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { create } from "zustand";
import { coachTextForUi } from "@/lib/live/coachTextForUi";
import type { FeedbackMessage, FeedbackType } from "@/types";

export type LiveConnectionState =
  | "idle"
  | "no_key"
  | "connecting"
  | "live"
  | "error";

interface CoachState {
  messages: FeedbackMessage[];
  isLoading: boolean;
  voiceEnabled: boolean;
  isPlaying: boolean;

  liveConnectionState: LiveConnectionState;
  liveError: string | null;
  liveCaption: string;
  /** Parsed server events in the current Live session (for “are we receiving anything?”). */
  liveServerEventsCount: number;

  addMessage: (type: FeedbackType, text: string) => void;
  clearMessages: () => void;
  toggleVoice: () => void;
  setPlaying: (playing: boolean) => void;

  setLiveConnectionState: (s: LiveConnectionState) => void;
  setLiveError: (msg: string | null) => void;
  setLiveCaption: (text: string) => void;
  /** Merge one streaming TEXT / output_transcription chunk (cumulative or delta). */
  mergeLiveCaptionChunk: (rawChunk: string) => void;
  clearLiveCaption: () => void;
  flushLiveCaptionToHistory: () => void;
  resetLiveServerMetrics: () => void;
  bumpLiveServerEvents: (delta?: number) => void;
}

export const useCoachStore = create<CoachState>((set, get) => ({
  messages: [],
  isLoading: false,
  voiceEnabled: false,
  isPlaying: false,

  liveConnectionState: "idle",
  liveError: null,
  liveCaption: "",
  liveServerEventsCount: 0,

  addMessage: (type, text) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type,
          text,
          timestamp: Date.now(),
        },
      ].slice(-8),
    })),

  clearMessages: () => set({ messages: [] }),
  toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),
  setPlaying: (playing) => set({ isPlaying: playing }),

  setLiveConnectionState: (liveConnectionState) => set({ liveConnectionState }),
  setLiveError: (liveError) => set({ liveError }),
  setLiveCaption: (liveCaption) => set({ liveCaption }),
  mergeLiveCaptionChunk: (rawChunk) => {
    const filtered = coachTextForUi(rawChunk.trim());
    if (filtered == null || !filtered.trim()) return;
    const chunk = filtered.trim();
    set((state) => {
      const prev = state.liveCaption.trim();
      if (!prev) return { liveCaption: chunk };
      if (chunk.startsWith(prev)) return { liveCaption: chunk };
      if (prev.startsWith(chunk)) return {};
      if (prev.endsWith(chunk)) return {};
      const sep =
        /\s$/.test(prev) ||
        /^[.,!?;:'")\]}]/.test(chunk) ||
        chunk.startsWith(" ")
          ? ""
          : " ";
      return { liveCaption: prev + sep + chunk };
    });
  },
  clearLiveCaption: () => set({ liveCaption: "" }),

  flushLiveCaptionToHistory: () => {
    const cap = get().liveCaption.trim();
    if (!cap) return;
    const ui = coachTextForUi(cap);
    if (ui == null || !ui.trim()) {
      set({ liveCaption: "" });
      return;
    }
    const trimmed = ui.trim();
    const last = get().messages.at(-1);
    if (last?.text === trimmed) {
      set({ liveCaption: "" });
      return;
    }
    if (trimmed.length < 25 && !/[.!?]$/.test(trimmed)) {
      set({ liveCaption: "" });
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          type: "feedback" as const,
          text: trimmed,
          timestamp: Date.now(),
        },
      ].slice(-8),
      liveCaption: "",
    }));
  },

  resetLiveServerMetrics: () => set({ liveServerEventsCount: 0 }),
  bumpLiveServerEvents: (delta = 1) =>
    set((s) => ({ liveServerEventsCount: s.liveServerEventsCount + delta })),
}));

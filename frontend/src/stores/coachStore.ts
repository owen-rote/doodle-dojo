import { create } from "zustand";
import type { FeedbackMessage, FeedbackType } from "@/types";

interface CoachState {
  messages: FeedbackMessage[];
  isLoading: boolean;
  voiceEnabled: boolean;
  isPlaying: boolean;

  addMessage: (type: FeedbackType, text: string) => void;
  clearMessages: () => void;
  toggleVoice: () => void;
  setPlaying: (playing: boolean) => void;
}

export const useCoachStore = create<CoachState>((set) => ({
  messages: [],
  isLoading: false,
  voiceEnabled: false,
  isPlaying: false,

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
      ].slice(-5), // Keep only last 5 messages
    })),

  clearMessages: () => set({ messages: [] }),
  toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),
  setPlaying: (playing) => set({ isPlaying: playing }),
}));

import { create } from "zustand";
import type { FeedbackMessage, FeedbackType } from "@/types";

export type LiveConnectionState = "idle" | "connecting" | "live" | "error";
export type MusicState = "idle" | "connecting" | "playing" | "muted";

interface CoachState {
  messages: FeedbackMessage[];
  isLoading: boolean;
  voiceEnabled: boolean;
  isPlaying: boolean;
  liveConnectionState: LiveConnectionState;
  liveMessage: string;
  musicState: MusicState;
  musicEnabled: boolean;

  addMessage: (type: FeedbackType, text: string) => void;
  clearMessages: () => void;
  toggleVoice: () => void;
  setPlaying: (playing: boolean) => void;
  setLiveConnectionState: (state: LiveConnectionState) => void;
  setLiveMessage: (message: string) => void;
  setMusicState: (state: MusicState) => void;
  toggleMusic: () => void;
}

export const useCoachStore = create<CoachState>((set) => ({
  messages: [],
  isLoading: false,
  voiceEnabled: false,
  isPlaying: false,
  liveConnectionState: "idle",
  liveMessage: "",

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
      ].slice(-5),
    })),

  musicState: "idle",
  musicEnabled: true,

  clearMessages: () => set({ messages: [] }),
  toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setLiveConnectionState: (liveConnectionState) => set({ liveConnectionState }),
  setLiveMessage: (liveMessage) => set({ liveMessage }),
  setMusicState: (musicState) => set({ musicState }),
  toggleMusic: () => set((state) => ({ musicEnabled: !state.musicEnabled })),
}));

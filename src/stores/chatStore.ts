import { create } from "zustand";
import type { ChatMessage } from "../types";

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  currentChannel: string;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setChannel: (channel: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  currentChannel: "desktop",

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  setChannel: (channel) => set({ currentChannel: channel }),
}));

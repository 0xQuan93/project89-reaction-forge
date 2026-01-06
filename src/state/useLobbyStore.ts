import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

interface LobbyState {
  onlineCount: number;
  messages: ChatMessage[];
  isChatOpen: boolean;
  
  setOnlineCount: (count: number) => void;
  addMessage: (msg: ChatMessage) => void;
  toggleChat: () => void;
}

export const useLobbyStore = create<LobbyState>((set) => ({
  onlineCount: 0,
  messages: [],
  isChatOpen: false,

  setOnlineCount: (count) => set({ onlineCount: count }),
  addMessage: (msg) => set((state) => ({ 
    messages: [...state.messages.slice(-49), msg] // Keep last 50
  })),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
}));


import { create } from 'zustand';

interface AIState {
  isAIActive: boolean;
  isLoading: boolean;
  loadProgress: number; // 0-100
  currentThought: string | null; // Debug: what is the AI thinking?
  
  setAIActive: (active: boolean) => void;
  setLoading: (loading: boolean, progress?: number) => void;
  setThought: (thought: string | null) => void;
}

export const useAIStore = create<AIState>((set) => ({
  isAIActive: false,
  isLoading: false,
  loadProgress: 0,
  currentThought: null,

  setAIActive: (isAIActive) => set({ isAIActive }),
  setLoading: (isLoading, loadProgress = 0) => set({ isLoading, loadProgress }),
  setThought: (currentThought) => set({ currentThought }),
}));


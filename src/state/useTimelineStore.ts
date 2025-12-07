import { create } from 'zustand';
import type { TimelineKeyframe, TimelineSequence } from '../types/timeline';

// Simple UUID generator
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface TimelineState {
  sequence: TimelineSequence;
  currentTime: number;
  isPlaying: boolean;
  selectedKeyframeId: string | null;
  
  // Actions
  addKeyframe: (keyframe: Omit<TimelineKeyframe, 'id'>) => void;
  updateKeyframe: (id: string, updates: Partial<TimelineKeyframe>) => void;
  removeKeyframe: (id: string) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  selectKeyframe: (id: string | null) => void;
  clearTimeline: () => void;
  sortKeyframes: () => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  sequence: {
    duration: 2.0, // Default 2 seconds
    keyframes: [],
  },
  currentTime: 0,
  isPlaying: false,
  selectedKeyframeId: null,

  addKeyframe: (keyframeData) => {
    const newKeyframe: TimelineKeyframe = {
      ...keyframeData,
      id: uuidv4(),
    };
    
    set((state) => ({
      sequence: {
        ...state.sequence,
        keyframes: [...state.sequence.keyframes, newKeyframe].sort((a, b) => a.time - b.time),
      },
    }));
  },

  updateKeyframe: (id, updates) => {
    set((state) => ({
      sequence: {
        ...state.sequence,
        keyframes: state.sequence.keyframes
          .map((kf) => (kf.id === id ? { ...kf, ...updates } : kf))
          .sort((a, b) => a.time - b.time),
      },
    }));
  },

  removeKeyframe: (id) => {
    set((state) => ({
      sequence: {
        ...state.sequence,
        keyframes: state.sequence.keyframes.filter((kf) => kf.id !== id),
      },
      selectedKeyframeId: state.selectedKeyframeId === id ? null : state.selectedKeyframeId,
    }));
  },

  setDuration: (duration) => {
    set((state) => ({
      sequence: {
        ...state.sequence,
        duration: Math.max(0.1, duration),
      },
    }));
  },

  setCurrentTime: (time) => {
    const duration = get().sequence.duration;
    // Clamp time
    const clampedTime = Math.max(0, Math.min(time, duration));
    set({ currentTime: clampedTime });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  selectKeyframe: (id) => set({ selectedKeyframeId: id }),

  clearTimeline: () => set({
    sequence: { duration: 2.0, keyframes: [] },
    currentTime: 0,
    isPlaying: false,
    selectedKeyframeId: null
  }),

  sortKeyframes: () => {
    set((state) => ({
      sequence: {
        ...state.sequence,
        keyframes: [...state.sequence.keyframes].sort((a, b) => a.time - b.time),
      },
    }));
  },
}));


import { create } from 'zustand';
import type { DirectorScript, Shot } from '../types/director';

interface DirectorState {
  currentScript: DirectorScript | null;
  isPlaying: boolean;
  isGenerating: boolean;
  
  // Actions
  setScript: (script: DirectorScript | null) => void;
  setPlaying: (playing: boolean) => void;
  setGenerating: (generating: boolean) => void;
  updateShot: (shotId: string, updates: Partial<Shot>) => void;
  updateScriptTitle: (title: string) => void;
  addShot: (shot: Shot) => void;
  removeShot: (shotId: string) => void;
  duplicateShot: (shotId: string) => void;
  reorderShots: (startIndex: number, endIndex: number) => void;
}

export const useDirectorStore = create<DirectorState>((set) => ({
  currentScript: null,
  isPlaying: false,
  isGenerating: false,

  setScript: (script) => set({ currentScript: script }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setGenerating: (generating) => set({ isGenerating: generating }),

  updateScriptTitle: (title) => set((state) => {
    if (!state.currentScript) return state;
    return {
      currentScript: {
        ...state.currentScript,
        title
      }
    };
  }),

  updateShot: (shotId, updates) => set((state) => {
    if (!state.currentScript) return state;
    const newShots = state.currentScript.shots.map((shot) =>
      shot.id === shotId ? { ...shot, ...updates } : shot
    );
    return {
      currentScript: {
        ...state.currentScript,
        shots: newShots,
        totalDuration: newShots.reduce((acc, shot) => acc + shot.duration, 0)
      }
    };
  }),

  addShot: (shot) => set((state) => {
    if (!state.currentScript) {
        return {
            currentScript: {
                id: `script-${Date.now()}`,
                title: 'New Script',
                shots: [shot],
                totalDuration: shot.duration
            }
        };
    }
    const newShots = [...state.currentScript.shots, shot];
    return {
      currentScript: {
        ...state.currentScript,
        shots: newShots,
        totalDuration: newShots.reduce((acc, shot) => acc + shot.duration, 0)
      }
    };
  }),

  removeShot: (shotId) => set((state) => {
    if (!state.currentScript) return state;
    const newShots = state.currentScript.shots.filter((s) => s.id !== shotId);
    return {
      currentScript: {
        ...state.currentScript,
        shots: newShots,
        totalDuration: newShots.reduce((acc, shot) => acc + shot.duration, 0)
      }
    };
  }),

  duplicateShot: (shotId) => set((state) => {
    if (!state.currentScript) return state;
    const shotToDuplicate = state.currentScript.shots.find((s) => s.id === shotId);
    if (!shotToDuplicate) return state;
    
    const index = state.currentScript.shots.indexOf(shotToDuplicate);
    
    // Future-proof naming convention: "Name (2)", "Name (3)", etc.
    const baseName = shotToDuplicate.name.replace(/\s\(\d+\)$/, '').replace(/\s\(Copy\)$/, '');
    const existingCopies = state.currentScript.shots.filter(s => s.name.startsWith(baseName));
    const nextNumber = existingCopies.length + 1;
    const newName = `${baseName} (${nextNumber})`;

    const newShot = {
        ...shotToDuplicate,
        id: `shot-${Date.now()}`,
        name: newName
    };
    
    const newShots = [...state.currentScript.shots];
    newShots.splice(index + 1, 0, newShot);
    
    return {
      currentScript: {
        ...state.currentScript,
        shots: newShots,
        totalDuration: newShots.reduce((acc, shot) => acc + shot.duration, 0)
      }
    };
  }),

  reorderShots: (startIndex, endIndex) => set((state) => {
    if (!state.currentScript) return state;
    const newShots = Array.from(state.currentScript.shots);
    const [removed] = newShots.splice(startIndex, 1);
    newShots.splice(endIndex, 0, removed);
    return {
      currentScript: {
        ...state.currentScript,
        shots: newShots
      }
    };
  }),
}));

import { create } from 'zustand';
import { defaultPreset, findPresetById, pickPresetForName, randomPreset } from '../data/reactions';
import type { ReactionPreset, AnimationMode } from '../types/reactions';

interface ReactionState {
  nameInput: string;
  activePreset: ReactionPreset;
  isAvatarReady: boolean;
  animationMode: AnimationMode;
  setNameInput: (value: string) => void;
  setAvatarReady: (ready: boolean) => void;
  setAnimationMode: (mode: AnimationMode) => void;
  applyName: () => ReactionPreset;
  randomize: () => ReactionPreset;
  setPresetById: (id: string) => ReactionPreset | undefined;
}

export const useReactionStore = create<ReactionState>((set, get) => ({
  nameInput: '',
  activePreset: defaultPreset,
  isAvatarReady: false,
  animationMode: 'static',
  setNameInput: (value) => set({ nameInput: value }),
  setAvatarReady: (ready) => set({ isAvatarReady: ready }),
  setAnimationMode: (mode) => set({ animationMode: mode }),
  applyName: () => {
    const preset = pickPresetForName(get().nameInput);
    set({ activePreset: preset });
    return preset;
  },
  randomize: () => {
    const preset = randomPreset();
    set({ activePreset: preset });
    return preset;
  },
  setPresetById: (id) => {
    const preset = findPresetById(id);
    if (preset) set({ activePreset: preset });
    return preset;
  },
}));


import { create } from 'zustand';
import { defaultPreset, findPresetById, pickPresetForName, randomPreset } from '../data/reactions';
import type { ReactionPreset, AnimationMode } from '../types/reactions';

interface ReactionState {
  nameInput: string;
  activePreset: ReactionPreset;
  isAvatarReady: boolean;
  animationMode: AnimationMode;
  liveModeEnabled: boolean;
  liveControlsEnabled: boolean;
  setNameInput: (value: string) => void;
  setAvatarReady: (ready: boolean) => void;
  setAnimationMode: (mode: AnimationMode) => void;
  setLiveModeEnabled: (enabled: boolean) => void;
  setLiveControlsEnabled: (enabled: boolean) => void;
  applyName: () => ReactionPreset;
  randomize: () => ReactionPreset;
  setPresetById: (id: string) => ReactionPreset | undefined;
}

export const useReactionStore = create<ReactionState>((set, get) => ({
  nameInput: '',
  activePreset: defaultPreset,
  isAvatarReady: false,
  animationMode: 'loop',
  liveModeEnabled: false,
  liveControlsEnabled: true,
  setNameInput: (value) => set({ nameInput: value }),
  setAvatarReady: (ready) => set({ isAvatarReady: ready }),
  setAnimationMode: (mode) => set({ animationMode: mode }),
  setLiveModeEnabled: (enabled) => set({ liveModeEnabled: enabled }),
  setLiveControlsEnabled: (enabled) => set({ liveControlsEnabled: enabled }),
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

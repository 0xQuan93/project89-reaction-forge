import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type QualityLevel = 'high' | 'medium' | 'low';

interface SettingsState {
  quality: QualityLevel;
  shadows: boolean;
  showStats: boolean;
  setQuality: (quality: QualityLevel) => void;
  setShadows: (enabled: boolean) => void;
  setShowStats: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      quality: 'high',
      shadows: true,
      showStats: false,
      setQuality: (quality) => set({ quality }),
      setShadows: (shadows) => set({ shadows }),
      setShowStats: (showStats) => set({ showStats }),
    }),
    {
      name: 'reaction-forge-settings',
    }
  )
);


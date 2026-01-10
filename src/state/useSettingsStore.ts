import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type QualityLevel = 'high' | 'medium' | 'low';
export type Theme = 'dark' | 'light' | 'system';
export type Locale = 'en' | 'ja' | 'es' | 'fr' | 'ko';

interface SettingsState {
  quality: QualityLevel;
  shadows: boolean;
  showStats: boolean;
  theme: Theme;
  locale: Locale;
  textScale: number;
  autosaveEnabled: boolean;
  autosaveIntervalMinutes: number;
  autosaveMaxEntries: number;
  setQuality: (quality: QualityLevel) => void;
  setShadows: (enabled: boolean) => void;
  setShowStats: (enabled: boolean) => void;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  setTextScale: (scale: number) => void;
  setAutosaveEnabled: (enabled: boolean) => void;
  setAutosaveIntervalMinutes: (minutes: number) => void;
  setAutosaveMaxEntries: (maxEntries: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      quality: 'high',
      shadows: true,
      showStats: false,
      theme: 'dark',
      locale: 'en',
      textScale: 1,
      autosaveEnabled: true,
      autosaveIntervalMinutes: 5,
      autosaveMaxEntries: 20,
      setQuality: (quality) => set({ quality }),
      setShadows: (shadows) => set({ shadows }),
      setShowStats: (showStats) => set({ showStats }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setTextScale: (textScale) => set({ textScale }),
      setAutosaveEnabled: (autosaveEnabled) => set({ autosaveEnabled }),
      setAutosaveIntervalMinutes: (autosaveIntervalMinutes) => set({ autosaveIntervalMinutes }),
      setAutosaveMaxEntries: (autosaveMaxEntries) => set({ autosaveMaxEntries }),
    }),
    {
      name: 'reaction-forge-settings',
    }
  )
);

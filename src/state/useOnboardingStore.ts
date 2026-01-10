import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  selectedPersonaId: string;
  completedSteps: Record<string, string[]>;
  setPersona: (personaId: string) => void;
  toggleStep: (personaId: string, stepId: string) => void;
  resetPersona: (personaId: string) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      selectedPersonaId: 'vtuber',
      completedSteps: {},

      setPersona: (selectedPersonaId) => set({ selectedPersonaId }),

      toggleStep: (personaId, stepId) => {
        const { completedSteps } = get();
        const current = new Set(completedSteps[personaId] ?? []);
        if (current.has(stepId)) {
          current.delete(stepId);
        } else {
          current.add(stepId);
        }
        set({
          completedSteps: {
            ...completedSteps,
            [personaId]: Array.from(current),
          },
        });
      },

      resetPersona: (personaId) => {
        const { completedSteps } = get();
        const next = { ...completedSteps };
        delete next[personaId];
        set({ completedSteps: next });
      },
    }),
    {
      name: 'poselab-onboarding',
      partialize: (state) => ({
        selectedPersonaId: state.selectedPersonaId,
        completedSteps: state.completedSteps,
      }),
    }
  )
);

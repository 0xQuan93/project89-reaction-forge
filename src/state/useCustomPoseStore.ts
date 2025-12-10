import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VRMPose } from '@pixiv/three-vrm';

export interface CustomPose {
  id: string;
  name: string;
  description: string;
  poseData: {
    vrmPose: VRMPose;
  };
  createdAt: number;
}

interface CustomPoseState {
  // apiKey is no longer persisted in the store as it should come from .env
  customPoses: CustomPose[];
  addCustomPose: (pose: Omit<CustomPose, 'id' | 'createdAt'>) => void;
  removeCustomPose: (id: string) => void;
  updateCustomPose: (id: string, updates: Partial<CustomPose>) => void;
  importPoses: (poses: CustomPose[]) => void;
}

export const useCustomPoseStore = create<CustomPoseState>()(
  persist(
    (set) => ({
      customPoses: [],
      addCustomPose: (pose) => set((state) => ({
        customPoses: [
          ...state.customPoses,
          {
            ...pose,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
          },
        ],
      })),
      removeCustomPose: (id) => set((state) => ({
        customPoses: state.customPoses.filter((p) => p.id !== id),
      })),
      updateCustomPose: (id, updates) => set((state) => ({
        customPoses: state.customPoses.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      })),
      importPoses: (newPoses) => set((state) => {
        // Avoid duplicates by ID, but generate new IDs if they clash or are missing
        const imported = newPoses.map(p => ({
            ...p,
            id: p.id || crypto.randomUUID(),
            createdAt: p.createdAt || Date.now()
        }));
        
        // Filter out any that exactly match existing IDs to prevent React key issues, 
        // though typically we might want to overwrite or merge. 
        // Here we'll just append non-duplicates.
        const existingIds = new Set(state.customPoses.map(p => p.id));
        const uniqueNew = imported.filter(p => !existingIds.has(p.id));
        
        return {
            customPoses: [...state.customPoses, ...uniqueNew]
        };
      }),
    }),
    {
      name: 'reaction-forge-custom-poses',
    }
  )
);


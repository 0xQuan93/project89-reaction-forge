import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  type LightSettings, 
  DEFAULT_LIGHT_SETTINGS,
  lightingManager 
} from '../three/lightingManager';
import { 
  type PostProcessingSettings, 
  DEFAULT_POST_SETTINGS,
  postProcessingManager 
} from '../three/postProcessingManager';
import { 
  type EnvironmentSettings, 
  DEFAULT_ENV_SETTINGS,
  environmentManager 
} from '../three/environmentManager';
import {
  type MaterialSettings,
  DEFAULT_MATERIAL_SETTINGS,
  materialManager
} from '../three/materialManager';

// ======================
// Combined Scene Settings
// ======================

interface SceneSettingsState {
  // Lighting
  lighting: LightSettings;
  lightingPreset: string;
  
  // Post-Processing
  postProcessing: PostProcessingSettings;
  postPreset: string;
  
  // Environment
  environment: EnvironmentSettings;
  environmentPreset: string;
  
  // Material/Toon Shader
  material: MaterialSettings;
  materialPreset: string;
  
  // Background
  backgroundLocked: boolean;
  currentBackground: string;  // Preset ID or 'custom'
  customBackgroundData: string | null;  // Base64 data for syncing custom backgrounds
  customBackgroundType: string | null;  // MIME type of custom background
  customBackgroundUrl: string | null;   // Runtime blob/data URL for custom background preview
  
  // Avatar rotation lock (preserve rotation when animations play)
  rotationLocked: boolean;
  
  // Actions
  setLighting: (settings: Partial<LightSettings>) => void;
  setLightingPreset: (preset: string) => void;
  
  setPostProcessing: (settings: Partial<PostProcessingSettings>) => void;
  setPostPreset: (preset: string) => void;
  
  setEnvironment: (settings: Partial<EnvironmentSettings>) => void;
  setEnvironmentPreset: (preset: string) => void;
  
  setMaterial: (settings: Partial<MaterialSettings>) => void;
  setMaterialPreset: (preset: string) => void;
  
  // Background actions
  setBackgroundLocked: (locked: boolean) => void;
  setCurrentBackground: (id: string) => void;
  setCustomBackground: (data: string, mimeType: string) => void;
  setCustomBackgroundUrl: (url: string) => void;
  clearCustomBackground: () => void;
  isBackgroundLocked: () => boolean;
  
  // Rotation lock actions
  setRotationLocked: (locked: boolean) => void;
  isRotationLocked: () => boolean;
  
  // Apply all settings to managers
  applyAll: () => void;
  
  // Reset to defaults
  resetAll: () => void;
}

// Deep merge helper for nested settings objects
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      const sourceValue = source[key];
      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue)
      ) {
        const targetValue = (target as Record<string, unknown>)[key];
        (result as Record<string, unknown>)[key] = deepMerge(
          (targetValue as object) || {},
          sourceValue as Partial<object>
        );
      } else {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }
  return result;
}

function revokeBlobUrl(url: string | null) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export const useSceneSettingsStore = create<SceneSettingsState>()(
  persist(
    (set, get) => ({
      // Initial State
      lighting: DEFAULT_LIGHT_SETTINGS,
      lightingPreset: 'studio',
      
      postProcessing: DEFAULT_POST_SETTINGS,
      postPreset: 'none',
      
      environment: DEFAULT_ENV_SETTINGS,
      environmentPreset: 'none',
      
      material: DEFAULT_MATERIAL_SETTINGS,
      materialPreset: 'default',
      
      // Background state
      backgroundLocked: false,
      currentBackground: 'midnight-circuit',
      customBackgroundData: null,
      customBackgroundType: null,
      customBackgroundUrl: null,
      
      // Rotation lock (auto-enabled when user rotates via gizmo)
      rotationLocked: false,
      
      // Lighting Actions
      setLighting: (settings) => {
        const newLighting = deepMerge(get().lighting, settings);
        set({ lighting: newLighting, lightingPreset: 'custom' });
        lightingManager.applySettings(newLighting);
      },
      
      setLightingPreset: (preset) => {
        set({ lightingPreset: preset });
        lightingManager.applyPreset(preset);
        // Update stored lighting to match preset
        set({ lighting: lightingManager.getSettings() });
      },
      
      // Post-Processing Actions
      setPostProcessing: (settings) => {
        const newPost = deepMerge(get().postProcessing, settings);
        set({ postProcessing: newPost, postPreset: 'custom' });
        postProcessingManager.applySettings(newPost);
      },
      
      setPostPreset: (preset) => {
        set({ postPreset: preset });
        postProcessingManager.applyPreset(preset);
        set({ postProcessing: postProcessingManager.getSettings() });
      },
      
      // Environment Actions
      setEnvironment: (settings) => {
        const newEnv = deepMerge(get().environment, settings);
        set({ environment: newEnv, environmentPreset: 'custom' });
        environmentManager.applySettings(newEnv);
      },
      
      setEnvironmentPreset: async (preset) => {
        if (get().environmentPreset === preset && environmentManager.hasEnvironment()) {
          return;
        }
        set({ environmentPreset: preset });
        try {
          await environmentManager.applyPreset(preset);
          if (preset !== 'none') {
            set({ 
              environment: { ...get().environment, enabled: true }
            });
          } else {
            set({ 
              environment: { ...get().environment, enabled: false }
            });
          }
        } catch (error) {
          console.error('[SceneSettingsStore] Failed to apply environment preset:', error);
        }
      },
      
      // Material Actions
      setMaterial: (settings) => {
        const newMaterial = deepMerge(get().material, settings);
        set({ material: newMaterial, materialPreset: 'custom' });
        materialManager.applySettings(newMaterial);
      },
      
      setMaterialPreset: (preset) => {
        set({ materialPreset: preset });
        materialManager.applyPreset(preset);
        set({ material: materialManager.getSettings() });
      },
      
      // Background Actions
      setBackgroundLocked: (locked) => {
        set({ backgroundLocked: locked });
      },
      
      setCurrentBackground: (id) => {
        set({ currentBackground: id });
        // If switching away from custom, clear the custom data
        if (id !== 'custom') {
          const previousUrl = get().customBackgroundUrl;
          set({ 
            customBackgroundData: null,
            customBackgroundType: null,
            customBackgroundUrl: null,
          });
          revokeBlobUrl(previousUrl);
        }
      },
      
      setCustomBackground: (data, mimeType) => {
        const dataUrl = `data:${mimeType};base64,${data}`;
        const previousUrl = get().customBackgroundUrl;
        set({
          currentBackground: 'custom',
          customBackgroundData: data,
          customBackgroundType: mimeType,
          customBackgroundUrl: dataUrl,
          backgroundLocked: true, // Auto-lock when custom background is set
        });
        revokeBlobUrl(previousUrl);
      },

      setCustomBackgroundUrl: (url) => {
        const previousUrl = get().customBackgroundUrl;
        set({
          currentBackground: 'custom',
          customBackgroundUrl: url,
          backgroundLocked: true,
        });
        revokeBlobUrl(previousUrl);
      },
      
      clearCustomBackground: () => {
        const previousUrl = get().customBackgroundUrl;
        set({
          customBackgroundData: null,
          customBackgroundType: null,
          customBackgroundUrl: null,
        });
        revokeBlobUrl(previousUrl);
      },
      
      isBackgroundLocked: () => {
        return get().backgroundLocked;
      },
      
      // Rotation Lock Actions
      setRotationLocked: (locked) => {
        set({ rotationLocked: locked });
      },
      
      isRotationLocked: () => {
        return get().rotationLocked;
      },
      
      // Apply All
      applyAll: () => {
        const state = get();
        lightingManager.applySettings(state.lighting);
        postProcessingManager.applySettings(state.postProcessing);
        environmentManager.applySettings(state.environment);
        materialManager.applySettings(state.material);
      },
      
      // Reset
      resetAll: () => {
        set({
          lighting: DEFAULT_LIGHT_SETTINGS,
          lightingPreset: 'studio',
          postProcessing: DEFAULT_POST_SETTINGS,
          postPreset: 'none',
          environment: DEFAULT_ENV_SETTINGS,
          environmentPreset: 'none',
          material: DEFAULT_MATERIAL_SETTINGS,
          materialPreset: 'default',
          backgroundLocked: false,
          currentBackground: 'midnight-circuit',
          customBackgroundData: null,
          customBackgroundType: null,
          customBackgroundUrl: null,
          rotationLocked: false,
        });
        lightingManager.applySettings(DEFAULT_LIGHT_SETTINGS);
        postProcessingManager.applySettings(DEFAULT_POST_SETTINGS);
        environmentManager.clear();
        materialManager.reset();
      },
    }),
    {
      name: 'poselab-scene-settings',
      partialize: (state) => ({
        lighting: state.lighting,
        lightingPreset: state.lightingPreset,
        postProcessing: state.postProcessing,
        postPreset: state.postPreset,
        // Don't persist environment URLs as they may expire
        environmentPreset: state.environmentPreset,
        material: state.material,
        materialPreset: state.materialPreset,
        // Background persistence
        backgroundLocked: state.backgroundLocked,
        currentBackground: state.currentBackground,
        // Note: customBackgroundData is NOT persisted to localStorage 
        // because base64 images can be large. Only preset IDs are persisted.
        // Note: rotationLocked is NOT persisted - it resets on app reload
        // to ensure avatars load facing the correct direction
      }),
    }
  )
);

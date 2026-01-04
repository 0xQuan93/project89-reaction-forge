import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { sceneManager } from './sceneManager';

// ======================
// Types & Configuration
// ======================

export interface EnvironmentSettings {
  enabled: boolean;
  intensity: number;        // 0-3
  backgroundBlur: number;   // 0-1
  backgroundIntensity: number; // 0-2
  rotation: number;         // 0-360 degrees
}

export const DEFAULT_ENV_SETTINGS: EnvironmentSettings = {
  enabled: false,
  intensity: 1.0,
  backgroundBlur: 0,
  backgroundIntensity: 1.0,
  rotation: 0,
};

// Built-in HDRI presets (using free HDRIs from Polyhaven-style URLs or placeholders)
export const HDRI_PRESETS: Record<string, { name: string; url: string | null; preview?: string }> = {
  none: {
    name: '🚫 None',
    url: null,
  },
  studio: {
    name: '🎬 Studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr',
  },
  outdoor: {
    name: '🌳 Outdoor',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_43d_clear_puresky_1k.hdr',
  },
  sunset: {
    name: '🌅 Sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr',
  },
  night: {
    name: '🌙 Night',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/dikhololo_night_1k.hdr',
  },
  urban: {
    name: '🏙️ Urban',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr',
  },
};

// ======================
// Environment Manager
// ======================

class EnvironmentManager {
  private loader = new RGBELoader();
  private currentTexture?: THREE.Texture;
  private currentSettings: EnvironmentSettings = DEFAULT_ENV_SETTINGS;
  private pmremGenerator?: THREE.PMREMGenerator;
  private envMap?: THREE.Texture;
  private originalBackground?: THREE.Color | THREE.Texture | null;

  /**
   * Initialize the PMREM generator
   */
  init() {
    const renderer = sceneManager.getRenderer();
    if (!renderer) return;

    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();

    console.log('[EnvironmentManager] Initialized');
  }

  /**
   * Load and apply an HDRI environment map
   */
  async loadHDRI(url: string): Promise<void> {
    const scene = sceneManager.getScene();
    const renderer = sceneManager.getRenderer();
    
    if (!scene || !renderer) {
      throw new Error('Scene or renderer not available');
    }

    if (!this.pmremGenerator) {
      this.init();
    }

    console.log('[EnvironmentManager] Loading HDRI:', url);

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (texture) => {
          // Store original background
          if (!this.originalBackground) {
            this.originalBackground = scene.background;
          }

          // Dispose previous textures
          this.dispose();

          // Generate environment map
          this.currentTexture = texture;
          this.envMap = this.pmremGenerator!.fromEquirectangular(texture).texture;

          // Apply to scene
          scene.environment = this.envMap;
          
          if (this.currentSettings.enabled) {
            scene.background = this.envMap;
            scene.backgroundBlurriness = this.currentSettings.backgroundBlur;
            scene.backgroundIntensity = this.currentSettings.backgroundIntensity;
          }

          // Apply rotation
          if (this.currentSettings.rotation !== 0) {
            scene.backgroundRotation = new THREE.Euler(
              0,
              THREE.MathUtils.degToRad(this.currentSettings.rotation),
              0
            );
            scene.environmentRotation = new THREE.Euler(
              0,
              THREE.MathUtils.degToRad(this.currentSettings.rotation),
              0
            );
          }

          // Dispose the original texture (we only need the processed envMap)
          texture.dispose();

          console.log('[EnvironmentManager] HDRI loaded and applied');
          resolve();
        },
        undefined,
        (error) => {
          console.error('[EnvironmentManager] Failed to load HDRI:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load HDRI from a File object
   */
  async loadHDRIFromFile(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    try {
      await this.loadHDRI(url);
    } finally {
      // Don't revoke immediately - the texture needs the URL
      // It will be cleaned up when dispose() is called
    }
  }

  /**
   * Apply a preset HDRI
   */
  async applyPreset(presetId: string): Promise<void> {
    const preset = HDRI_PRESETS[presetId];
    if (!preset) {
      console.warn('[EnvironmentManager] Unknown preset:', presetId);
      return;
    }

    if (preset.url === null) {
      this.clear();
      return;
    }

    await this.loadHDRI(preset.url);
  }

  /**
   * Apply environment settings
   */
  applySettings(settings: EnvironmentSettings) {
    this.currentSettings = settings;
    const scene = sceneManager.getScene();
    
    if (!scene) return;

    if (settings.enabled && this.envMap) {
      scene.environment = this.envMap;
      scene.environmentIntensity = settings.intensity;
      scene.background = this.envMap;
      scene.backgroundBlurriness = settings.backgroundBlur;
      scene.backgroundIntensity = settings.backgroundIntensity;

      // Apply rotation
      scene.backgroundRotation = new THREE.Euler(
        0,
        THREE.MathUtils.degToRad(settings.rotation),
        0
      );
      scene.environmentRotation = new THREE.Euler(
        0,
        THREE.MathUtils.degToRad(settings.rotation),
        0
      );
    } else if (!settings.enabled && this.originalBackground) {
      // Restore original background but keep environment for reflections
      scene.background = this.originalBackground;
    }
  }

  /**
   * Get current settings
   */
  getSettings(): EnvironmentSettings {
    return { ...this.currentSettings };
  }

  /**
   * Check if an environment map is loaded
   */
  hasEnvironment(): boolean {
    return !!this.envMap;
  }

  /**
   * Clear the environment map and restore original background
   */
  clear() {
    const scene = sceneManager.getScene();
    
    if (scene) {
      scene.environment = null;
      if (this.originalBackground) {
        scene.background = this.originalBackground;
      }
      scene.backgroundBlurriness = 0;
      scene.backgroundIntensity = 1;
    }

    this.dispose();
    this.currentSettings = { ...DEFAULT_ENV_SETTINGS };
    console.log('[EnvironmentManager] Environment cleared');
  }

  /**
   * Dispose textures
   */
  dispose() {
    if (this.currentTexture) {
      this.currentTexture.dispose();
      this.currentTexture = undefined;
    }
    if (this.envMap) {
      this.envMap.dispose();
      this.envMap = undefined;
    }
  }

  /**
   * Full cleanup
   */
  destroy() {
    this.dispose();
    if (this.pmremGenerator) {
      this.pmremGenerator.dispose();
      this.pmremGenerator = undefined;
    }
  }
}

export const environmentManager = new EnvironmentManager();


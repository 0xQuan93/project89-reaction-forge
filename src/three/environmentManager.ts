import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { sceneManager } from './sceneManager';
import { peerManager } from '../multiplayer/peerManager';

// ======================
// Types & Configuration
// ======================

export interface EnvironmentSettings {
  enabled: boolean;
  intensity: number;        // 0-3
  backgroundBlur: number;   // 0-1
  backgroundIntensity: number; // 0-2
  rotation: number;         // 0-360 degrees
  
  // Dynamic background properties (for transferred images/videos)
  backgroundDataType: 'none' | 'image' | 'video'; // 'none', 'image/png', 'video/webm', etc.
  backgroundDataUrl: string | null;
  backgroundFileName: string | null;
}

export const DEFAULT_ENV_SETTINGS: EnvironmentSettings = {
  enabled: false,
  intensity: 1.0,
  backgroundBlur: 0,
  backgroundIntensity: 1.0,
  rotation: 0,
  backgroundDataType: 'none',
  backgroundDataUrl: null,
  backgroundFileName: null,
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
  'cyber-alley': {
    name: '🌃 Cyber Alley',
    url: '/backgrounds/hdr/M3_Anime_hdri-hdr_cyber-city_alleyway_at_midnight_422831616_14844286.hdr',
  },
  'lush-forest': {
    name: '🌲 Lush Forest',
    url: '/backgrounds/hdr/M3_Anime_hdri-hdr_deep_in_a_lush_1051738730_14844291.hdr',
  },
  volcano: {
    name: '🌋 Volcano',
    url: '/backgrounds/hdr/M3_Anime_hdri-hdr_inside_an_active_volcano_1527142368_14844295.hdr',
  },
  'deep-sea': {
    name: '🌊 Deep Sea',
    url: '/backgrounds/hdr/M3_Anime_hdri-hdr_underwater_deep_sea_trench_2030061023_14844424.hdr',
  },
  'glass-platform': {
    name: '💎 Glass Platform',
    url: '/backgrounds/hdr/M3_Anime_hdri-hdr_a_glass_platform_in_81034329_14844536.hdr',
  },
  'hacker-room': {
    name: '💻 Hacker Room',
    url: '/backgrounds/hdr/M3_Anime_hdri-hdr_interior_of_a_cluttered_661225116_14844563.hdr',
  },
  industrial: {
    name: '🏭 Industrial',
    url: '/backgrounds/hdr/M3_Anime_hdri-hdr_inside_a_massive_industrial_1117188263_14844712.hdr',
  },
  'rooftop-garden': {
    name: '🌸 Rooftop',
    url: '/backgrounds/hdr/M3_Anime_hdri-hdr_ooftop_garden_of_a_419291268_14844925.hdr',
  },
  'shinto-shrine': {
    name: '⛩️ Shrine',
    url: '/backgrounds/hdr/M3_Anime_hdri-hdr_pathway_to_a_shinto_1505440517_14844939.hdr',
  },
};

// ======================
// Environment Manager
// ======================

class EnvironmentManager {
  private loader = new RGBELoader();
  private currentTexture?: THREE.Texture;
  private currentUrl?: string | null;
  private currentPresetId?: string | null;
  private currentSettings: EnvironmentSettings = DEFAULT_ENV_SETTINGS;
  private pmremGenerator?: THREE.PMREMGenerator;
  private envMap?: THREE.Texture;
  private originalBackground?: THREE.Color | THREE.Texture | null;
  private _videoElement: HTMLVideoElement | null = null;
  private _unsubscribeBackgroundTransfer: (() => void) | null = null;
  
  // Persistence state
  private customEnvironmentData: string | null = null;
  private customEnvironmentType: string | null = null;

  /**
   * Initialize the PMREM generator
   */
  init() {
    const renderer = sceneManager.getRenderer();
    if (!renderer) return;

    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();

    // Listen for incoming background transfers
    this._unsubscribeBackgroundTransfer = peerManager.onBackgroundTransfer((peerId, fileName, fileType, dataUrl) => {
      console.log(`[EnvironmentManager] Received background from ${peerId}: ${fileName} (${fileType})`);
      this.loadDynamicBackground(dataUrl, fileType.startsWith('image') ? 'image' : 'video', fileName);
    });

    console.log('[EnvironmentManager] Initialized');
  }

  /**
   * Load and apply an HDRI environment map
   */
  async loadHDRI(url: string, presetId?: string): Promise<void> {
    const scene = sceneManager.getScene();
    const renderer = sceneManager.getRenderer();
    
    if (!scene || !renderer) {
      throw new Error('Scene or renderer not available');
    }

    if (!this.pmremGenerator) {
      this.init();
    }

    // SKIP if already loaded - prevents "catching" during animation/export
    if ((this.currentUrl === url || (presetId && this.currentPresetId === presetId)) && this.envMap) {
      console.log('[EnvironmentManager] Skipping HDRI load (already active):', url || presetId);
      
      // Still ensure it's applied to the scene in case something else changed it
      if (scene.environment !== this.envMap) scene.environment = this.envMap;
      if (this.currentSettings.enabled && scene.background !== this.envMap) {
        scene.background = this.envMap;
      }
      return;
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

          // Update tracking
          this.currentUrl = url;
          if (presetId) this.currentPresetId = presetId;

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
    
    // Store for persistence (awaiting to ensure it's ready for immediate save)
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(file);
    });

    this.customEnvironmentData = base64Data;
    this.customEnvironmentType = file.name.endsWith('.exr') ? 'image/x-exr' : 'application/x-hdr';

    try {
      await this.loadHDRI(url);
    } finally {
      // Don't revoke immediately - the texture needs the URL
      // It will be cleaned up when dispose() is called
    }
  }

  /**
   * Set custom environment data manually (e.g. from project load)
   */
  setCustomData(data: string, type: string) {
    this.customEnvironmentData = data;
    this.customEnvironmentType = type;
  }

  getCustomData() {
    return {
      data: this.customEnvironmentData,
      type: this.customEnvironmentType
    };
  }

  /**
   * Apply a preset HDRI
   */
  async applyPreset(presetId: string): Promise<void> {
    if (presetId === 'custom') return;

    const preset = HDRI_PRESETS[presetId];
    if (!preset) {
      console.warn('[EnvironmentManager] Unknown preset:', presetId);
      return;
    }

    if (preset.url === null) {
      this.clear();
      return;
    }

    await this.loadHDRI(preset.url, presetId);
  }

  /**
   * Apply environment settings
   */
  applySettings(settings: EnvironmentSettings) {
    this.currentSettings = settings;
    const scene = sceneManager.getScene();
    
    if (!scene) return;

    if (settings.backgroundDataUrl && settings.backgroundDataType !== 'none') {
      // Prioritize dynamic background if provided
      this.loadDynamicBackground(settings.backgroundDataUrl, settings.backgroundDataType, settings.backgroundFileName || 'dynamic_background')
        .catch(e => console.error('[EnvironmentManager] Failed to apply dynamic background from settings:', e));
      return; // Exit after applying dynamic background
    }

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
    } else if (!settings.enabled && !this.originalBackground) {
      // If no HDRI or original background, ensure background is clear
      this.clear();
    }
  }

  /**
   * Load and apply a dynamic background (image or video data URL)
   */
  async loadDynamicBackground(
    backgroundDataUrl: string,
    backgroundDataType: 'image' | 'video',
    backgroundFileName: string
  ): Promise<void> {
    const scene = sceneManager.getScene();
    if (!scene) {
      throw new Error('Scene not available for dynamic background');
    }

    this.clear(); // Clear any existing environment or background

    console.log(`[EnvironmentManager] Loading dynamic background: ${backgroundFileName} (${backgroundDataType})`);

    return new Promise((resolve, reject) => {
      if (backgroundDataType === 'image') {
        const loader = new THREE.TextureLoader();
        loader.load(
          backgroundDataUrl,
          (texture) => {
            this.currentTexture = texture;
            scene.background = this.currentTexture;
            scene.environment = null; // No HDRI environment for dynamic backgrounds for now
            this.currentSettings.backgroundDataType = 'image';
            this.currentSettings.backgroundDataUrl = backgroundDataUrl;
            this.currentSettings.backgroundFileName = backgroundFileName;
            console.log(`[EnvironmentManager] Image background loaded: ${backgroundFileName}`);
            resolve();
          },
          undefined,
          (error) => {
            console.error(`[EnvironmentManager] Failed to load image background: ${backgroundFileName}`, error);
            reject(error);
          }
        );
      } else if (backgroundDataType === 'video') {
        this._videoElement = document.createElement('video');
        this._videoElement.src = backgroundDataUrl;
        this._videoElement.loop = true;
        this._videoElement.muted = true; // Mute by default for autoplay compatibility
        this._videoElement.autoplay = true;
        this._videoElement.playsInline = true;
        this._videoElement.crossOrigin = 'anonymous';

        this._videoElement.addEventListener('loadeddata', () => {
          this.currentTexture = new THREE.VideoTexture(this._videoElement!);
          this.currentTexture.colorSpace = THREE.SRGBColorSpace;
          scene.background = this.currentTexture;
          scene.environment = null; // No HDRI environment for dynamic backgrounds for now
          this.currentSettings.backgroundDataType = 'video';
          this.currentSettings.backgroundDataUrl = backgroundDataUrl;
          this.currentSettings.backgroundFileName = backgroundFileName;
          this._videoElement?.play();
          console.log(`[EnvironmentManager] Video background loaded and playing: ${backgroundFileName}`);
          resolve();
        });

        this._videoElement.addEventListener('error', (e) => {
          console.error(`[EnvironmentManager] Failed to load video background: ${backgroundFileName}`, e);
          reject(new Error(`Failed to load video: ${backgroundFileName}`));
        });

        this._videoElement.load();
      } else {
        reject(new Error('Unsupported background data type'));
      }
    });
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
    this.customEnvironmentData = null;
    this.customEnvironmentType = null;
    this.currentPresetId = null;
    this.currentUrl = null;
    console.log('[EnvironmentManager] Environment cleared');
  }

  /**
   * Dispose textures
   */
  dispose() {
    this.currentUrl = null;
    this.currentPresetId = null;
    if (this.currentTexture) {
      this.currentTexture.dispose();
      this.currentTexture = undefined;
    }
    if (this.envMap) {
      this.envMap.dispose();
      this.envMap = undefined;
    }
    if (this._videoElement) {
      this._videoElement.pause();
      this._videoElement.removeAttribute('src'); // Clear the video source
      this._videoElement.load(); // Reload to clear resources
      this._videoElement = null;
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

    // Remove the listener from peerManager
    if (this._unsubscribeBackgroundTransfer) {
      this._unsubscribeBackgroundTransfer();
      this._unsubscribeBackgroundTransfer = null;
    }
  }
}

export const environmentManager = new EnvironmentManager();


import * as THREE from 'three';
import { sceneManager } from './sceneManager';

// ======================
// Types & Configuration
// ======================

export interface LightSettings {
  // Key Light (Main directional light)
  keyLight: {
    enabled: boolean;
    intensity: number;
    color: string;
    position: { x: number; y: number; z: number };
  };
  // Fill Light (Softer, opposite side)
  fillLight: {
    enabled: boolean;
    intensity: number;
    color: string;
    position: { x: number; y: number; z: number };
  };
  // Rim/Back Light (Edge definition)
  rimLight: {
    enabled: boolean;
    intensity: number;
    color: string;
    position: { x: number; y: number; z: number };
  };
  // Ambient Light
  ambient: {
    enabled: boolean;
    intensity: number;
    color: string;
    groundColor: string;
  };
}

export const DEFAULT_LIGHT_SETTINGS: LightSettings = {
  keyLight: {
    enabled: true,
    intensity: 1.2,
    color: '#ffffff',
    position: { x: 2, y: 4, z: 2 },
  },
  fillLight: {
    enabled: true,
    intensity: 0.5,
    color: '#b4c8ff', // Slightly cool fill
    position: { x: -2, y: 2, z: 1 },
  },
  rimLight: {
    enabled: true,
    intensity: 0.8,
    color: '#ffe4b5', // Warm rim for edge pop
    position: { x: 0, y: 2, z: -3 },
  },
  ambient: {
    enabled: true,
    intensity: 0.4,
    color: '#ffffff',
    groundColor: '#303050',
  },
};

// Light presets for quick selection
export const LIGHT_PRESETS: Record<string, { name: string; settings: Partial<LightSettings> }> = {
  studio: {
    name: '🎬 Studio',
    settings: DEFAULT_LIGHT_SETTINGS,
  },
  dramatic: {
    name: '🎭 Dramatic',
    settings: {
      keyLight: { enabled: true, intensity: 1.5, color: '#ff8844', position: { x: 3, y: 3, z: 1 } },
      fillLight: { enabled: true, intensity: 0.2, color: '#4488ff', position: { x: -3, y: 1, z: 2 } },
      rimLight: { enabled: true, intensity: 1.2, color: '#ff4488', position: { x: 0, y: 3, z: -2 } },
      ambient: { enabled: true, intensity: 0.15, color: '#222244', groundColor: '#000000' },
    },
  },
  soft: {
    name: '☁️ Soft',
    settings: {
      keyLight: { enabled: true, intensity: 0.8, color: '#fff5e6', position: { x: 1, y: 5, z: 3 } },
      fillLight: { enabled: true, intensity: 0.7, color: '#e6f0ff', position: { x: -2, y: 3, z: 2 } },
      rimLight: { enabled: false, intensity: 0.3, color: '#ffffff', position: { x: 0, y: 2, z: -3 } },
      ambient: { enabled: true, intensity: 0.6, color: '#ffffff', groundColor: '#d0d0e0' },
    },
  },
  neon: {
    name: '💜 Neon',
    settings: {
      keyLight: { enabled: true, intensity: 1.0, color: '#00ffff', position: { x: 2, y: 3, z: 2 } },
      fillLight: { enabled: true, intensity: 0.8, color: '#ff00ff', position: { x: -2, y: 2, z: 1 } },
      rimLight: { enabled: true, intensity: 1.5, color: '#ffff00', position: { x: 0, y: 1, z: -3 } },
      ambient: { enabled: true, intensity: 0.2, color: '#0a0a20', groundColor: '#000000' },
    },
  },
  sunset: {
    name: '🌅 Sunset',
    settings: {
      keyLight: { enabled: true, intensity: 1.3, color: '#ff6b35', position: { x: 4, y: 2, z: 0 } },
      fillLight: { enabled: true, intensity: 0.4, color: '#4a90d9', position: { x: -3, y: 3, z: 2 } },
      rimLight: { enabled: true, intensity: 0.6, color: '#ffcc00', position: { x: -2, y: 1, z: -2 } },
      ambient: { enabled: true, intensity: 0.3, color: '#ff9966', groundColor: '#1a1a3e' },
    },
  },
  moonlight: {
    name: '🌙 Moonlight',
    settings: {
      keyLight: { enabled: true, intensity: 0.6, color: '#c4d4ff', position: { x: -2, y: 5, z: 2 } },
      fillLight: { enabled: true, intensity: 0.2, color: '#2a2a4a', position: { x: 2, y: 1, z: 1 } },
      rimLight: { enabled: true, intensity: 0.4, color: '#8888ff', position: { x: 1, y: 3, z: -3 } },
      ambient: { enabled: true, intensity: 0.15, color: '#1a1a3a', groundColor: '#000010' },
    },
  },
};

// ======================
// Lighting Manager Class
// ======================

class LightingManager {
  private keyLight?: THREE.DirectionalLight;
  private fillLight?: THREE.DirectionalLight;
  private rimLight?: THREE.DirectionalLight;
  private ambientLight?: THREE.HemisphereLight;
  private currentSettings: LightSettings = DEFAULT_LIGHT_SETTINGS;
  private initialized = false;

  /**
   * Initialize the 3-point lighting system
   * Called after scene is ready
   */
  init() {
    const scene = sceneManager.getScene();
    if (!scene || this.initialized) return;

    // Remove existing lights from scene (the default ones from sceneManager)
    const lightsToRemove: THREE.Light[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Light) {
        lightsToRemove.push(obj);
      }
    });
    lightsToRemove.forEach((light) => scene.remove(light));

    // Create Key Light (Main)
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.keyLight.name = 'KeyLight';
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.bias = -0.0001;
    scene.add(this.keyLight);

    // Create Fill Light
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    this.fillLight.name = 'FillLight';
    scene.add(this.fillLight);

    // Create Rim Light
    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.rimLight.name = 'RimLight';
    scene.add(this.rimLight);

    // Create Ambient/Hemisphere Light
    this.ambientLight = new THREE.HemisphereLight(0xffffff, 0x303050, 0.4);
    this.ambientLight.name = 'AmbientLight';
    scene.add(this.ambientLight);

    this.initialized = true;
    this.applySettings(this.currentSettings);

    console.log('[LightingManager] 3-point lighting system initialized');
  }

  /**
   * Apply lighting settings
   */
  applySettings(settings: LightSettings) {
    this.currentSettings = settings;

    if (!this.initialized) {
      this.init();
    }

    // Key Light
    if (this.keyLight) {
      this.keyLight.visible = settings.keyLight.enabled;
      this.keyLight.intensity = settings.keyLight.intensity;
      this.keyLight.color.set(settings.keyLight.color);
      this.keyLight.position.set(
        settings.keyLight.position.x,
        settings.keyLight.position.y,
        settings.keyLight.position.z
      );
    }

    // Fill Light
    if (this.fillLight) {
      this.fillLight.visible = settings.fillLight.enabled;
      this.fillLight.intensity = settings.fillLight.intensity;
      this.fillLight.color.set(settings.fillLight.color);
      this.fillLight.position.set(
        settings.fillLight.position.x,
        settings.fillLight.position.y,
        settings.fillLight.position.z
      );
    }

    // Rim Light
    if (this.rimLight) {
      this.rimLight.visible = settings.rimLight.enabled;
      this.rimLight.intensity = settings.rimLight.intensity;
      this.rimLight.color.set(settings.rimLight.color);
      this.rimLight.position.set(
        settings.rimLight.position.x,
        settings.rimLight.position.y,
        settings.rimLight.position.z
      );
    }

    // Ambient Light
    if (this.ambientLight) {
      this.ambientLight.visible = settings.ambient.enabled;
      this.ambientLight.intensity = settings.ambient.intensity;
      this.ambientLight.color.set(settings.ambient.color);
      this.ambientLight.groundColor.set(settings.ambient.groundColor);
    }
  }

  /**
   * Apply a preset by name
   */
  applyPreset(presetId: string) {
    if (presetId === 'custom') return;

    const preset = LIGHT_PRESETS[presetId];
    if (!preset) {
      console.warn('[LightingManager] Unknown preset:', presetId);
      return;
    }

    // Merge preset with defaults
    const mergedSettings: LightSettings = {
      keyLight: { ...DEFAULT_LIGHT_SETTINGS.keyLight, ...preset.settings.keyLight },
      fillLight: { ...DEFAULT_LIGHT_SETTINGS.fillLight, ...preset.settings.fillLight },
      rimLight: { ...DEFAULT_LIGHT_SETTINGS.rimLight, ...preset.settings.rimLight },
      ambient: { ...DEFAULT_LIGHT_SETTINGS.ambient, ...preset.settings.ambient },
    };

    this.applySettings(mergedSettings);
    console.log('[LightingManager] Applied preset:', preset.name);
  }

  /**
   * Get current settings
   */
  getSettings(): LightSettings {
    return { ...this.currentSettings };
  }

  /**
   * Update a single light property
   */
  updateLight(
    lightType: 'keyLight' | 'fillLight' | 'rimLight' | 'ambient',
    property: string,
    value: unknown
  ) {
    const settings = this.getSettings();
    const lightSettings = settings[lightType] as Record<string, unknown>;
    
    if (!lightSettings) {
      console.warn(`[LightingManager] Invalid light type: ${lightType}`);
      return;
    }
    
    if (property === 'position' && typeof value === 'object') {
      lightSettings.position = value;
    } else {
      lightSettings[property] = value;
    }

    this.applySettings(settings);
  }

  /**
   * Dispose of all lights
   */
  dispose() {
    const scene = sceneManager.getScene();
    if (!scene) return;

    [this.keyLight, this.fillLight, this.rimLight, this.ambientLight].forEach((light) => {
      if (light) {
        scene.remove(light);
        light.dispose?.();
      }
    });

    this.keyLight = undefined;
    this.fillLight = undefined;
    this.rimLight = undefined;
    this.ambientLight = undefined;
    this.initialized = false;
  }
}

export const lightingManager = new LightingManager();


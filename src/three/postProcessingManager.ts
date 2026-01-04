import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { sceneManager } from './sceneManager';

// ======================
// Types & Configuration
// ======================

export interface PostProcessingSettings {
  enabled: boolean;
  
  // Bloom
  bloom: {
    enabled: boolean;
    intensity: number;    // 0-3
    threshold: number;    // 0-1
    radius: number;       // 0-1
  };
  
  // Color Grading
  colorGrading: {
    enabled: boolean;
    brightness: number;   // -1 to 1
    contrast: number;     // 0-2
    saturation: number;   // 0-2
    exposure: number;     // 0-3
  };
  
  // Vignette
  vignette: {
    enabled: boolean;
    intensity: number;    // 0-1
    smoothness: number;   // 0-1
  };
  
  // Film Grain
  filmGrain: {
    enabled: boolean;
    intensity: number;    // 0-0.5
  };
}

export const DEFAULT_POST_SETTINGS: PostProcessingSettings = {
  enabled: false,
  bloom: {
    enabled: true,
    intensity: 0.5,
    threshold: 0.8,
    radius: 0.4,
  },
  colorGrading: {
    enabled: true,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    exposure: 1,
  },
  vignette: {
    enabled: true,
    intensity: 0.3,
    smoothness: 0.5,
  },
  filmGrain: {
    enabled: false,
    intensity: 0.1,
  },
};

// Post-processing presets
export const POST_PRESETS: Record<string, { name: string; settings: Partial<PostProcessingSettings> }> = {
  none: {
    name: '🚫 None',
    settings: { enabled: false },
  },
  cinematic: {
    name: '🎬 Cinematic',
    settings: {
      enabled: true,
      bloom: { enabled: true, intensity: 0.6, threshold: 0.7, radius: 0.5 },
      colorGrading: { enabled: true, brightness: 0, contrast: 1.1, saturation: 0.95, exposure: 1.05 },
      vignette: { enabled: true, intensity: 0.4, smoothness: 0.6 },
      filmGrain: { enabled: true, intensity: 0.08 },
    },
  },
  vibrant: {
    name: '🌈 Vibrant',
    settings: {
      enabled: true,
      bloom: { enabled: true, intensity: 0.8, threshold: 0.6, radius: 0.6 },
      colorGrading: { enabled: true, brightness: 0.05, contrast: 1.2, saturation: 1.4, exposure: 1.1 },
      vignette: { enabled: false, intensity: 0, smoothness: 0 },
      filmGrain: { enabled: false, intensity: 0 },
    },
  },
  noir: {
    name: '🎩 Noir',
    settings: {
      enabled: true,
      bloom: { enabled: true, intensity: 0.3, threshold: 0.9, radius: 0.3 },
      colorGrading: { enabled: true, brightness: -0.1, contrast: 1.4, saturation: 0.2, exposure: 0.9 },
      vignette: { enabled: true, intensity: 0.6, smoothness: 0.4 },
      filmGrain: { enabled: true, intensity: 0.15 },
    },
  },
  dreamy: {
    name: '✨ Dreamy',
    settings: {
      enabled: true,
      bloom: { enabled: true, intensity: 1.2, threshold: 0.5, radius: 0.8 },
      colorGrading: { enabled: true, brightness: 0.1, contrast: 0.9, saturation: 0.85, exposure: 1.15 },
      vignette: { enabled: true, intensity: 0.25, smoothness: 0.8 },
      filmGrain: { enabled: false, intensity: 0 },
    },
  },
  retro: {
    name: '📼 Retro',
    settings: {
      enabled: true,
      bloom: { enabled: true, intensity: 0.4, threshold: 0.75, radius: 0.4 },
      colorGrading: { enabled: true, brightness: 0.05, contrast: 1.1, saturation: 0.7, exposure: 0.95 },
      vignette: { enabled: true, intensity: 0.5, smoothness: 0.3 },
      filmGrain: { enabled: true, intensity: 0.2 },
    },
  },
};

// ======================
// Custom Shaders
// ======================

// Color Grading + Vignette + Film Grain Shader
const ColorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 0 },
    contrast: { value: 1 },
    saturation: { value: 1 },
    exposure: { value: 1 },
    vignetteIntensity: { value: 0.3 },
    vignetteSmoothness: { value: 0.5 },
    grainIntensity: { value: 0 },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform float exposure;
    uniform float vignetteIntensity;
    uniform float vignetteSmoothness;
    uniform float grainIntensity;
    uniform float time;
    
    varying vec2 vUv;
    
    // Simple pseudo-random for grain
    float random(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Exposure
      color.rgb *= exposure;
      
      // Brightness
      color.rgb += brightness;
      
      // Contrast
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;
      
      // Saturation
      float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luminance), color.rgb, saturation);
      
      // Vignette
      if (vignetteIntensity > 0.0) {
        vec2 uv = vUv * (1.0 - vUv.yx);
        float vignette = uv.x * uv.y * 15.0;
        vignette = pow(vignette, vignetteSmoothness + 0.25);
        color.rgb *= mix(1.0 - vignetteIntensity, 1.0, vignette);
      }
      
      // Film Grain
      if (grainIntensity > 0.0) {
        float grain = random(vUv + time * 0.01) * 2.0 - 1.0;
        color.rgb += grain * grainIntensity;
      }
      
      // Clamp
      color.rgb = clamp(color.rgb, 0.0, 1.0);
      
      gl_FragColor = color;
    }
  `,
};

// ======================
// Post Processing Manager
// ======================

class PostProcessingManager {
  private composer?: EffectComposer;
  private renderPass?: RenderPass;
  private bloomPass?: UnrealBloomPass;
  private colorGradingPass?: ShaderPass;
  private outputPass?: OutputPass;
  private currentSettings: PostProcessingSettings = DEFAULT_POST_SETTINGS;
  private initialized = false;
  private time = 0;

  /**
   * Initialize the post-processing pipeline
   */
  init() {
    const renderer = sceneManager.getRenderer();
    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();

    if (!renderer || !scene || !camera || this.initialized) return;

    // Create composer
    this.composer = new EffectComposer(renderer);

    // Render pass
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Bloom pass
    const size = new THREE.Vector2();
    renderer.getSize(size);
    this.bloomPass = new UnrealBloomPass(size, 0.5, 0.4, 0.8);
    this.bloomPass.enabled = this.currentSettings.bloom.enabled;
    this.composer.addPass(this.bloomPass);

    // Color grading pass (includes vignette and grain)
    this.colorGradingPass = new ShaderPass(ColorGradingShader);
    this.colorGradingPass.enabled = true;
    this.composer.addPass(this.colorGradingPass);

    // Output pass (handles color space conversion)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.initialized = true;
    this.applySettings(this.currentSettings);

    console.log('[PostProcessingManager] Initialized');
  }

  /**
   * Apply settings
   */
  applySettings(settings: PostProcessingSettings) {
    this.currentSettings = settings;

    if (!this.initialized) {
      return; // Will be applied on init
    }

    // Bloom
    if (this.bloomPass) {
      this.bloomPass.enabled = settings.enabled && settings.bloom.enabled;
      this.bloomPass.strength = settings.bloom.intensity;
      this.bloomPass.threshold = settings.bloom.threshold;
      this.bloomPass.radius = settings.bloom.radius;
    }

    // Color Grading + Vignette + Grain
    if (this.colorGradingPass) {
      const uniforms = this.colorGradingPass.uniforms;
      
      if (settings.enabled && settings.colorGrading.enabled) {
        uniforms.brightness.value = settings.colorGrading.brightness;
        uniforms.contrast.value = settings.colorGrading.contrast;
        uniforms.saturation.value = settings.colorGrading.saturation;
        uniforms.exposure.value = settings.colorGrading.exposure;
      } else {
        uniforms.brightness.value = 0;
        uniforms.contrast.value = 1;
        uniforms.saturation.value = 1;
        uniforms.exposure.value = 1;
      }

      if (settings.enabled && settings.vignette.enabled) {
        uniforms.vignetteIntensity.value = settings.vignette.intensity;
        uniforms.vignetteSmoothness.value = settings.vignette.smoothness;
      } else {
        uniforms.vignetteIntensity.value = 0;
      }

      if (settings.enabled && settings.filmGrain.enabled) {
        uniforms.grainIntensity.value = settings.filmGrain.intensity;
      } else {
        uniforms.grainIntensity.value = 0;
      }
    }
  }

  /**
   * Apply a preset
   */
  applyPreset(presetId: string) {
    const preset = POST_PRESETS[presetId];
    if (!preset) {
      console.warn('[PostProcessingManager] Unknown preset:', presetId);
      return;
    }

    // Deep merge with defaults
    const merged: PostProcessingSettings = {
      enabled: preset.settings.enabled ?? DEFAULT_POST_SETTINGS.enabled,
      bloom: { ...DEFAULT_POST_SETTINGS.bloom, ...preset.settings.bloom },
      colorGrading: { ...DEFAULT_POST_SETTINGS.colorGrading, ...preset.settings.colorGrading },
      vignette: { ...DEFAULT_POST_SETTINGS.vignette, ...preset.settings.vignette },
      filmGrain: { ...DEFAULT_POST_SETTINGS.filmGrain, ...preset.settings.filmGrain },
    };

    this.applySettings(merged);
    console.log('[PostProcessingManager] Applied preset:', preset.name);
  }

  /**
   * Get current settings
   */
  getSettings(): PostProcessingSettings {
    return { ...this.currentSettings };
  }

  /**
   * Check if post-processing is enabled and active
   */
  isEnabled(): boolean {
    return this.currentSettings.enabled && this.initialized;
  }

  /**
   * Get the composer for rendering
   */
  getComposer(): EffectComposer | undefined {
    return this.composer;
  }

  /**
   * Update time uniform for animated effects (grain)
   */
  update(delta: number) {
    this.time += delta;
    if (this.colorGradingPass && this.currentSettings.filmGrain.enabled) {
      this.colorGradingPass.uniforms.time.value = this.time;
    }
  }

  /**
   * Resize the composer
   */
  resize(width: number, height: number) {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  }

  /**
   * Dispose
   */
  dispose() {
    if (this.composer) {
      this.composer.dispose();
      this.composer = undefined;
    }
    this.renderPass = undefined;
    this.bloomPass = undefined;
    this.colorGradingPass = undefined;
    this.outputPass = undefined;
    this.initialized = false;
  }
}

export const postProcessingManager = new PostProcessingManager();


import * as THREE from 'three';
import { avatarManager } from './avatarManager';

// ======================
// Types & Configuration  
// ======================

export interface MaterialSettings {
  // Outline (MToon shader)
  outline: {
    enabled: boolean;
    widthFactor: number;     // 0-3 (multiplier for outline width)
    color: string;           // Hex color
  };
  // Shade adjustments
  shading: {
    shadeMultiplier: number; // 0-2 (affects shade intensity)
    rimIntensity: number;    // 0-1 (rim lighting intensity)
  };
  // Global material overrides
  material: {
    emissiveIntensity: number; // 0-3
    opacity: number;           // 0-1
  };
}

export const DEFAULT_MATERIAL_SETTINGS: MaterialSettings = {
  outline: {
    enabled: true,
    widthFactor: 1.0,
    color: '#000000',
  },
  shading: {
    shadeMultiplier: 1.0,
    rimIntensity: 0.5,
  },
  material: {
    emissiveIntensity: 1.0,
    opacity: 1.0,
  },
};

// Preset styles
export const MATERIAL_PRESETS: Record<string, { name: string; settings: Partial<MaterialSettings> }> = {
  default: {
    name: '🎨 Default',
    settings: DEFAULT_MATERIAL_SETTINGS,
  },
  anime: {
    name: '🌸 Anime',
    settings: {
      outline: { enabled: true, widthFactor: 1.5, color: '#1a1a2e' },
      shading: { shadeMultiplier: 1.2, rimIntensity: 0.3 },
      material: { emissiveIntensity: 0.8, opacity: 1.0 },
    },
  },
  bold: {
    name: '✒️ Bold Outline',
    settings: {
      outline: { enabled: true, widthFactor: 2.5, color: '#000000' },
      shading: { shadeMultiplier: 1.0, rimIntensity: 0.0 },
      material: { emissiveIntensity: 1.0, opacity: 1.0 },
    },
  },
  subtle: {
    name: '🌫️ Subtle',
    settings: {
      outline: { enabled: true, widthFactor: 0.5, color: '#333344' },
      shading: { shadeMultiplier: 0.8, rimIntensity: 0.7 },
      material: { emissiveIntensity: 1.2, opacity: 1.0 },
    },
  },
  noOutline: {
    name: '🔲 No Outline',
    settings: {
      outline: { enabled: false, widthFactor: 0, color: '#000000' },
      shading: { shadeMultiplier: 1.0, rimIntensity: 0.5 },
      material: { emissiveIntensity: 1.0, opacity: 1.0 },
    },
  },
  glowing: {
    name: '✨ Glowing',
    settings: {
      outline: { enabled: true, widthFactor: 0.8, color: '#00ffd6' },
      shading: { shadeMultiplier: 0.6, rimIntensity: 1.0 },
      material: { emissiveIntensity: 2.5, opacity: 1.0 },
    },
  },
};

// ======================
// Material Manager
// ======================

class MaterialManager {
  private currentSettings: MaterialSettings = DEFAULT_MATERIAL_SETTINGS;
  private originalMaterialData = new Map<THREE.Material, Record<string, unknown>>();
  private initialized = false;

  /**
   * Apply material settings to the current VRM
   */
  applySettings(settings: MaterialSettings) {
    this.currentSettings = settings;
    
    const vrm = avatarManager.getVRM();
    if (!vrm) {
      console.log('[MaterialManager] No VRM loaded, settings will apply on next load');
      return;
    }

    let materialsProcessed = 0;
    const outlineColor = new THREE.Color(settings.outline.color);

    // Method 1: Access materials through VRM.materials if available (VRM 1.0+)
    const vrmAny = vrm as unknown as { materials?: THREE.Material[] };
    if (vrmAny.materials && Array.isArray(vrmAny.materials)) {
      console.log('[MaterialManager] Found VRM.materials array with', vrmAny.materials.length, 'materials');
      vrmAny.materials.forEach((material) => {
        if (this.applyToMaterial(material, settings, outlineColor)) {
          materialsProcessed++;
        }
      });
    }

    // Method 2: Traverse scene and find all mesh materials
    vrm.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        
        materials.forEach((material) => {
          // Skip if already processed
          if (this.originalMaterialData.has(material) && materialsProcessed > 0) {
            return;
          }
          if (this.applyToMaterial(material, settings, outlineColor)) {
            materialsProcessed++;
          }
        });
      }
    });

    console.log('[MaterialManager] Applied settings to', materialsProcessed, 'materials');
    this.initialized = true;
  }

  private applyToMaterial(
    material: THREE.Material, 
    settings: MaterialSettings,
    outlineColor: THREE.Color
  ): boolean {
    // Store original values if not already stored
    if (!this.originalMaterialData.has(material)) {
      this.storeOriginalValues(material);
    }

    // Check material type
    const matType = material.type;
    const matName = material.name || '(unnamed)';
    let modified = false;

    // Cast to record for dynamic access
    const mat = material as unknown as Record<string, unknown>;

    // ===== MToon 1.0 UNIFORMS (ShaderMaterial with uniforms) =====
    if (material instanceof THREE.ShaderMaterial && material.uniforms) {
      const uniforms = material.uniforms;
      
      // Outline width factor - MToon 1.0 uses outlineWidthFactor uniform
      if ('outlineWidthFactor' in uniforms) {
        const baseWidth = settings.outline.enabled ? settings.outline.widthFactor * 0.005 : 0;
        uniforms.outlineWidthFactor.value = baseWidth;
        modified = true;
        console.log(`[MaterialManager] Set outlineWidthFactor to ${baseWidth} on ${matName}`);
      }
      
      // Outline color - MToon 1.0 uses outlineColorFactor uniform
      if ('outlineColorFactor' in uniforms && uniforms.outlineColorFactor.value instanceof THREE.Color) {
        uniforms.outlineColorFactor.value.copy(outlineColor);
        modified = true;
      }
      
      // Rim lighting
      if ('parametricRimFresnelPowerFactor' in uniforms) {
        uniforms.parametricRimFresnelPowerFactor.value = 5.0 - (settings.shading.rimIntensity * 4);
        modified = true;
      }
      if ('parametricRimLiftFactor' in uniforms) {
        uniforms.parametricRimLiftFactor.value = settings.shading.rimIntensity * 0.3;
        modified = true;
      }
      
      // Emissive intensity
      if ('emissiveIntensity' in uniforms) {
        uniforms.emissiveIntensity.value = settings.material.emissiveIntensity;
        modified = true;
      }
      
      // Shading toony factor (affects cel-shading harshness)
      if ('shadingToonyFactor' in uniforms) {
        uniforms.shadingToonyFactor.value = 0.5 + (settings.shading.shadeMultiplier - 1) * 0.25;
        modified = true;
      }
    }

    // ===== MToon 0.x STYLE (Direct Properties) =====
    // outlineWidthMode: 0 = None, 1 = WorldCoordinates, 2 = ScreenCoordinates
    if (typeof mat.outlineWidthMode === 'number') {
      mat.outlineWidthMode = settings.outline.enabled ? 1 : 0;
      modified = true;
    }
    
    // outlineWidth or outlineWidthFactor as direct property
    if (typeof mat.outlineWidth === 'number') {
      mat.outlineWidth = settings.outline.enabled ? settings.outline.widthFactor * 0.005 : 0;
      modified = true;
    }
    if (typeof mat.outlineWidthFactor === 'number') {
      mat.outlineWidthFactor = settings.outline.enabled ? settings.outline.widthFactor * 0.005 : 0;
      modified = true;
    }
    
    // Outline color as direct property
    if (mat.outlineColor instanceof THREE.Color) {
      mat.outlineColor.copy(outlineColor);
      modified = true;
    }
    if (mat.outlineColorFactor instanceof THREE.Color) {
      mat.outlineColorFactor.copy(outlineColor);
      modified = true;
    }

    // ===== STANDARD MATERIAL PROPERTIES =====
    if (material instanceof THREE.MeshStandardMaterial || 
        material instanceof THREE.MeshPhysicalMaterial) {
      material.emissiveIntensity = settings.material.emissiveIntensity;
      modified = true;
    }

    // Opacity handling
    if (settings.material.opacity < 1) {
      material.transparent = true;
      material.opacity = settings.material.opacity;
      modified = true;
    } else {
      material.opacity = 1.0;
    }

    if (modified) {
      material.needsUpdate = true;
    }

    // Log what we found if this is a ShaderMaterial
    if (!modified && matType === 'ShaderMaterial') {
      console.log(`[MaterialManager] ShaderMaterial ${matName} - no recognized outline properties found`);
    }
    
    return modified;
  }

  private storeOriginalValues(material: THREE.Material) {
    const mat = material as unknown as Record<string, unknown>;
    const data: Record<string, unknown> = {
      opacity: material.opacity,
      transparent: material.transparent,
    };

    // Store uniform values
    if (material instanceof THREE.ShaderMaterial && material.uniforms) {
      const uniforms = material.uniforms;
      if ('outlineWidthFactor' in uniforms) {
        data.outlineWidthFactor = uniforms.outlineWidthFactor.value;
      }
      if ('outlineColorFactor' in uniforms && uniforms.outlineColorFactor.value instanceof THREE.Color) {
        data.outlineColorFactor = uniforms.outlineColorFactor.value.clone();
      }
    }

    // Store direct properties
    if (typeof mat.outlineWidth === 'number') {
      data.outlineWidth = mat.outlineWidth;
    }
    if (typeof mat.outlineWidthFactor === 'number') {
      data.outlineWidthFactor = mat.outlineWidthFactor;
    }
    if (mat.outlineColor instanceof THREE.Color) {
      data.outlineColor = mat.outlineColor.clone();
    }

    if (material instanceof THREE.MeshStandardMaterial) {
      data.emissiveIntensity = material.emissiveIntensity;
    }

    this.originalMaterialData.set(material, data);
  }

  /**
   * Apply a preset
   */
  applyPreset(presetId: string) {
    const preset = MATERIAL_PRESETS[presetId];
    if (!preset) {
      console.warn('[MaterialManager] Unknown preset:', presetId);
      return;
    }

    const merged: MaterialSettings = {
      outline: { ...DEFAULT_MATERIAL_SETTINGS.outline, ...preset.settings.outline },
      shading: { ...DEFAULT_MATERIAL_SETTINGS.shading, ...preset.settings.shading },
      material: { ...DEFAULT_MATERIAL_SETTINGS.material, ...preset.settings.material },
    };

    this.applySettings(merged);
    console.log('[MaterialManager] Applied preset:', preset.name);
  }

  /**
   * Get current settings
   */
  getSettings(): MaterialSettings {
    return { ...this.currentSettings };
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Called when a new VRM is loaded - reapply current settings
   */
  onVRMLoaded() {
    console.log('[MaterialManager] VRM loaded, applying current settings');
    this.originalMaterialData.clear();
    // Small delay to ensure materials are fully initialized
    setTimeout(() => {
      this.applySettings(this.currentSettings);
    }, 100);
  }

  /**
   * Reset materials to original state
   */
  reset() {
    this.applySettings(DEFAULT_MATERIAL_SETTINGS);
    this.originalMaterialData.clear();
    this.initialized = false;
  }

  /**
   * Debug: Log material properties to console
   */
  debugMaterials() {
    const vrm = avatarManager.getVRM();
    if (!vrm) {
      console.log('[MaterialManager Debug] No VRM loaded');
      return;
    }

    console.log('[MaterialManager Debug] ==================');
    console.log('[MaterialManager Debug] Scanning VRM materials...');
    
    // Check for VRM.materials array
    const vrmAny = vrm as unknown as { materials?: THREE.Material[] };
    if (vrmAny.materials) {
      console.log('[MaterialManager Debug] VRM.materials array found:', vrmAny.materials.length, 'materials');
    } else {
      console.log('[MaterialManager Debug] VRM.materials array NOT found');
    }

    // Traverse scene
    let meshCount = 0;
    let materialCount = 0;
    
    vrm.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        meshCount++;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        
        materials.forEach((mat) => {
          materialCount++;
          console.log(`\n[Material #${materialCount}] Mesh: ${object.name || '(unnamed)'}`);
          console.log(`  Type: ${mat.type}`);
          console.log(`  Name: ${mat.name || '(unnamed)'}`);
          console.log(`  Constructor: ${mat.constructor.name}`);
          
          // Check for ShaderMaterial uniforms
          if (mat instanceof THREE.ShaderMaterial && mat.uniforms) {
            const uniformKeys = Object.keys(mat.uniforms);
            const outlineKeys = uniformKeys.filter(k => k.toLowerCase().includes('outline'));
            const rimKeys = uniformKeys.filter(k => k.toLowerCase().includes('rim'));
            const emissiveKeys = uniformKeys.filter(k => k.toLowerCase().includes('emissive'));
            
            console.log(`  Has uniforms: YES (${uniformKeys.length} total)`);
            if (outlineKeys.length > 0) {
              console.log(`  Outline uniforms:`, outlineKeys);
              outlineKeys.forEach(key => {
                console.log(`    - ${key}:`, mat.uniforms[key].value);
              });
            } else {
              console.log(`  Outline uniforms: NONE`);
            }
            if (rimKeys.length > 0) console.log(`  Rim uniforms:`, rimKeys);
            if (emissiveKeys.length > 0) console.log(`  Emissive uniforms:`, emissiveKeys);
          }
          
          // Check direct properties
          const m = mat as unknown as Record<string, unknown>;
          const directProps: string[] = [];
          if (typeof m.outlineWidthMode !== 'undefined') directProps.push(`outlineWidthMode=${m.outlineWidthMode}`);
          if (typeof m.outlineWidth !== 'undefined') directProps.push(`outlineWidth=${m.outlineWidth}`);
          if (typeof m.outlineWidthFactor !== 'undefined') directProps.push(`outlineWidthFactor=${m.outlineWidthFactor}`);
          if (m.outlineColor) directProps.push(`outlineColor=exists`);
          
          if (directProps.length > 0) {
            console.log(`  Direct outline props:`, directProps.join(', '));
          }
        });
      }
    });
    
    console.log(`\n[MaterialManager Debug] Summary: ${meshCount} meshes, ${materialCount} materials`);
    console.log('[MaterialManager Debug] ==================');
  }
}

export const materialManager = new MaterialManager();

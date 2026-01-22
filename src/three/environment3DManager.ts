import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { sceneManager } from './sceneManager';

// ======================
// Types & Configuration
// ======================

export interface Environment3DSettings {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // Euler degrees
  scale: number;
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface LoadedEnvironment {
  id: string;
  name: string;
  url: string;
  group: THREE.Group;
  settings: Environment3DSettings;
}

export const DEFAULT_ENV_3D_SETTINGS: Environment3DSettings = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1.0,
  visible: true,
  castShadow: false,
  receiveShadow: true,
};

// ======================
// Environment 3D Manager
// ======================

class Environment3DManager {
  private loader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private environments: Map<string, LoadedEnvironment> = new Map();
  private idCounter = 0;
  private onChangeCallbacks: Set<() => void> = new Set();

  constructor() {
    this.loader = new GLTFLoader();
    
    // Setup Draco decoder for compressed GLB files
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.dracoLoader.setDecoderConfig({ type: 'js' });
    this.loader.setDRACOLoader(this.dracoLoader);
  }

  /**
   * Subscribe to environment changes
   */
  onChange(callback: () => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  private notifyChange() {
    this.onChangeCallbacks.forEach(cb => cb());
  }

  /**
   * Load a GLB file from URL or blob
   */
  async loadFromUrl(url: string, name?: string): Promise<LoadedEnvironment> {
    const scene = sceneManager.getScene();
    if (!scene) {
      throw new Error('Scene not initialized');
    }

    console.log('[Environment3D] Loading GLB:', url);

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const id = `env3d_${++this.idCounter}`;
          const group = new THREE.Group();
          group.name = `Environment3D_${id}`;
          
          // Add the loaded scene to our group
          group.add(gltf.scene);

          // Center the model based on its bounding box
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.position.sub(center);
          
          // Calculate scale to fit reasonably in scene (target ~5 units max dimension)
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetSize = 5;
          const autoScale = maxDim > 0 ? targetSize / maxDim : 1;
          
          // Apply default settings
          const settings: Environment3DSettings = {
            ...DEFAULT_ENV_3D_SETTINGS,
            scale: autoScale,
          };

          this.applySettings(group, settings);

          // Setup shadows for all meshes
          group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = settings.castShadow;
              child.receiveShadow = settings.receiveShadow;
            }
          });

          // Add to scene
          scene.add(group);

          const environment: LoadedEnvironment = {
            id,
            name: name || this.extractName(url) || `Environment ${this.idCounter}`,
            url,
            group,
            settings,
          };

          this.environments.set(id, environment);
          this.notifyChange();

          console.log('[Environment3D] Loaded successfully:', environment.name);
          resolve(environment);
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`[Environment3D] Loading: ${percent.toFixed(1)}%`);
          }
        },
        (error) => {
          console.error('[Environment3D] Failed to load:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load a GLB file from a File object
   */
  async loadFromFile(file: File): Promise<LoadedEnvironment> {
    const url = URL.createObjectURL(file);
    try {
      const env = await this.loadFromUrl(url, file.name.replace(/\.glb$/i, ''));
      return env;
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  /**
   * Extract a readable name from URL
   */
  private extractName(url: string): string {
    try {
      const urlObj = new URL(url, window.location.origin);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || '';
      return filename.replace(/\.glb$/i, '').replace(/[-_]/g, ' ');
    } catch {
      return '';
    }
  }

  /**
   * Apply settings to an environment group
   */
  private applySettings(group: THREE.Group, settings: Environment3DSettings) {
    group.position.set(settings.position.x, settings.position.y, settings.position.z);
    group.rotation.set(
      THREE.MathUtils.degToRad(settings.rotation.x),
      THREE.MathUtils.degToRad(settings.rotation.y),
      THREE.MathUtils.degToRad(settings.rotation.z)
    );
    group.scale.setScalar(settings.scale);
    group.visible = settings.visible;
  }

  /**
   * Update environment settings
   */
  updateSettings(id: string, newSettings: Partial<Environment3DSettings>) {
    const env = this.environments.get(id);
    if (!env) {
      console.warn('[Environment3D] Environment not found:', id);
      return;
    }

    env.settings = { ...env.settings, ...newSettings };
    this.applySettings(env.group, env.settings);

    // Update shadow settings if changed
    if (newSettings.castShadow !== undefined || newSettings.receiveShadow !== undefined) {
      env.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = env.settings.castShadow;
          child.receiveShadow = env.settings.receiveShadow;
        }
      });
    }

    this.notifyChange();
  }

  /**
   * Remove an environment
   */
  remove(id: string) {
    const env = this.environments.get(id);
    if (!env) {
      console.warn('[Environment3D] Environment not found:', id);
      return;
    }

    const scene = sceneManager.getScene();
    if (scene) {
      scene.remove(env.group);
    }

    // Dispose geometries and materials
    env.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });

    // Revoke blob URL if it was created from a file
    if (env.url.startsWith('blob:')) {
      URL.revokeObjectURL(env.url);
    }

    this.environments.delete(id);
    this.notifyChange();
    console.log('[Environment3D] Removed:', env.name);
  }

  /**
   * Remove all environments
   */
  removeAll() {
    const ids = Array.from(this.environments.keys());
    ids.forEach(id => this.remove(id));
  }

  /**
   * Get all loaded environments
   */
  getAll(): LoadedEnvironment[] {
    return Array.from(this.environments.values());
  }

  /**
   * Get a specific environment
   */
  get(id: string): LoadedEnvironment | undefined {
    return this.environments.get(id);
  }

  /**
   * Check if any environments are loaded
   */
  hasEnvironments(): boolean {
    return this.environments.size > 0;
  }

  /**
   * Set visibility of an environment
   */
  setVisible(id: string, visible: boolean) {
    this.updateSettings(id, { visible });
  }

  /**
   * Toggle visibility of an environment
   */
  toggleVisible(id: string) {
    const env = this.environments.get(id);
    if (env) {
      this.updateSettings(id, { visible: !env.settings.visible });
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose() {
    this.removeAll();
    this.dracoLoader.dispose();
    this.onChangeCallbacks.clear();
  }
}

export const environment3DManager = new Environment3DManager();

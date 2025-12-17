import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { applyBackground, type AnimatedBackground } from './backgrounds';
import type { BackgroundId } from '../types/reactions';
import { useSettingsStore } from '../state/useSettingsStore';
import { perfMonitor } from '../perf/perfMonitor';

type TickHandler = (delta: number) => void;

// Logo overlay configuration
const LOGO_CONFIG = {
  path: '/logo/poselab.svg', // PoseLab logo
  position: 'bottom-right' as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  size: 0.08, // 8% of canvas width
  opacity: 0.85,
};

type AspectRatio = '16:9' | '1:1' | '9:16';

class SceneManager {
  private renderer?: THREE.WebGLRenderer;
  private camera?: THREE.PerspectiveCamera;
  private scene?: THREE.Scene;
  private controls?: OrbitControls;
  private animationFrameId?: number;
  private readonly tickHandlers = new Set<TickHandler>();
  private readonly clock = new THREE.Clock();
  private canvas?: HTMLCanvasElement;
  private readonly box = new THREE.Box3();
  private readonly size = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private currentAspectRatio: AspectRatio = '16:9';
  private animatedBackground?: AnimatedBackground;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    this.camera.position.set(0, 1.4, 1.6); // Closer default distance

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // required for downloads
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x080820, 1.2);
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(0, 4, 2);
    this.scene.add(hemisphere);
    this.scene.add(directional);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.4, 0);
    this.controls.enablePan = true;
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.8; // Allow getting closer
    this.controls.maxDistance = 3;

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.startLoop();

    applyBackground(this.scene, 'midnight' as BackgroundId);
    
    // Apply initial aspect ratio after a short delay to ensure canvas is in DOM
    setTimeout(() => {
      this.handleResize();
    }, 100);

    // Subscribe to settings changes
    useSettingsStore.subscribe((state) => {
      this.updateSettings(state);
    });
    
    // Apply initial settings
    this.updateSettings(useSettingsStore.getState());
    
    // Start performance monitoring after a short delay to allow initial load/compilation
    setTimeout(() => {
        perfMonitor.start();
    }, 3000);
  }

  private updateSettings(state: { quality: string; shadows: boolean }) {
    if (!this.renderer || !this.scene) return;

    // Resolution
    let pixelRatio = 1;
    switch(state.quality) {
       case 'high': pixelRatio = Math.min(window.devicePixelRatio, 2); break;
       case 'medium': pixelRatio = 0.8; break;
       case 'low': pixelRatio = 0.5; break;
    }
    this.renderer.setPixelRatio(pixelRatio);

    // Shadows
    this.renderer.shadowMap.enabled = state.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Update lights to cast shadows
    this.scene.traverse((obj) => {
       if (obj instanceof THREE.DirectionalLight) {
           obj.castShadow = state.shadows;
           // Optimize shadow map
           if (state.shadows) {
               obj.shadow.mapSize.width = 1024;
               obj.shadow.mapSize.height = 1024;
               obj.shadow.bias = -0.001;
           }
       }
    });
    
    // Note: Meshes need castShadow/receiveShadow set. 
    // AvatarManager handles the VRM meshes.
  }

  private startLoop() {
    const loop = () => {
      const delta = this.clock.getDelta();
      this.controls?.update();
      this.tickHandlers.forEach((handler) => handler(delta));

      if (this.animatedBackground) {
        this.animatedBackground.update(delta);
      }

      this.renderer?.render(this.scene!, this.camera!);
      this.animationFrameId = window.requestAnimationFrame(loop);
    };
    this.animationFrameId = window.requestAnimationFrame(loop);
  }

  private handleResize() {
    if (!this.renderer || !this.camera || !this.canvas) return;
    
    // Get the container (viewport) dimensions
    const container = this.canvas.parentElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate target aspect ratio
    const targetRatio = this.getAspectRatioValue(this.currentAspectRatio);
    
    // Calculate canvas size to fit container while maintaining aspect ratio
    let canvasWidth = containerWidth;
    let canvasHeight = containerHeight;
    
    const containerRatio = containerWidth / containerHeight;
    
    if (containerRatio > targetRatio) {
      // Container is wider than target, constrain by height
      canvasWidth = containerHeight * targetRatio;
      canvasHeight = containerHeight;
    } else {
      // Container is taller than target, constrain by width
      canvasWidth = containerWidth;
      canvasHeight = containerWidth / targetRatio;
    }
    
    // Update canvas CSS size (visual size)
    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;
    
    // Update renderer and camera to match
    this.renderer.setSize(canvasWidth, canvasHeight, false);
    this.camera.aspect = targetRatio;
    this.camera.updateProjectionMatrix();
    
    console.log('[SceneManager] Canvas resized to:', canvasWidth, 'x', canvasHeight, 'Aspect:', targetRatio);
  }
  
  private getAspectRatioValue(ratio: AspectRatio): number {
    switch (ratio) {
      case '16:9': return 16 / 9;
      case '1:1': return 1;
      case '9:16': return 9 / 16;
      default: return 16 / 9;
    }
  }

  registerTick(handler: TickHandler) {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  getScene() {
    return this.scene;
  }

  getCanvas() {
    return this.canvas;
  }

  getRenderer() {
    return this.renderer;
  }

  getCamera() {
    return this.camera;
  }

  getControls() {
    return this.controls;
  }

  frameObject(object: THREE.Object3D, padding = 1.2) {
    if (!this.camera || !this.controls) return;
    this.box.setFromObject(object);
    if (!isFinite(this.box.min.lengthSq()) || !isFinite(this.box.max.lengthSq())) return;

    this.box.getCenter(this.center);
    this.box.getSize(this.size);

    const height = this.size.y || 1;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (height * padding) / (2 * Math.tan(fov / 2));

    const dir = new THREE.Vector3(0, 0, 1);
    this.camera.position.copy(this.center).addScaledVector(dir, distance);

    this.camera.near = distance / 100;
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(this.center);
    
    // Scale controls limits to accommodate the object size
    this.controls.maxDistance = distance * 10;
    this.controls.minDistance = distance * 0.1;
    
    this.controls.update();
  }

  async setBackground(id: BackgroundId | string) {
    if (!this.scene) return;
    
    // Dispose previous animated background
    if (this.animatedBackground) {
      this.animatedBackground.dispose();
      this.animatedBackground = undefined;
    }

    const result = await applyBackground(this.scene, id);
    
    if (result) {
      this.animatedBackground = result;
      console.log('[SceneManager] Animated background active');
    }
  }

  /**
   * Set the aspect ratio for the scene
   * This will adjust the camera and visually resize the canvas to match the desired aspect ratio
   */
  setAspectRatio(ratio: AspectRatio) {
    this.currentAspectRatio = ratio;
    console.log('[SceneManager] Aspect ratio set to:', ratio);
    
    // Trigger resize to apply the new aspect ratio visually
    this.handleResize();
  }

  /**
   * Get the current aspect ratio
   */
  getAspectRatio(): AspectRatio {
    return this.currentAspectRatio;
  }

  async captureSnapshot(options?: {
    width?: number;
    height?: number;
    includeLogo?: boolean;
    transparentBackground?: boolean;
  }): Promise<string | null> {
    if (!this.renderer || !this.canvas || !this.scene || !this.camera) return null;
    
    const includeLogo = options?.includeLogo ?? true;
    const transparentBackground = options?.transparentBackground ?? false;
    const targetWidth = options?.width || this.canvas.width;
    const targetHeight = options?.height || this.canvas.height;
    
    console.log('[SceneManager] Capturing snapshot:', { 
      targetWidth, 
      targetHeight, 
      includeLogo, 
      transparentBackground 
    });
    
    // Save current background and clear color state
    const originalBackground = this.scene.background;
    const originalClearColor = new THREE.Color();
    const originalClearAlpha = this.renderer.getClearAlpha();
    this.renderer.getClearColor(originalClearColor);
    
    // If transparent background requested, temporarily remove background and set transparent clear
    if (transparentBackground) {
      this.scene.background = null;
      this.renderer.setClearColor(0x000000, 0); // Fully transparent
      console.log('[SceneManager] Background removed and clear color set to transparent');
    }
    
    try {
      // If custom resolution requested, render to an off-screen canvas
      if (options?.width || options?.height) {
        // Save current renderer size
        const originalSize = new THREE.Vector2();
        this.renderer.getSize(originalSize);
        
        // Temporarily resize renderer for high-res capture
        this.renderer.setSize(targetWidth, targetHeight, false);
        this.camera.aspect = targetWidth / targetHeight;
        this.camera.updateProjectionMatrix();
        
        // Render at target resolution
        this.renderer.render(this.scene, this.camera);
        
        // Capture the render
        const dataUrl = await this.compositeWithLogo(
          this.renderer.domElement, 
          targetWidth, 
          targetHeight, 
          includeLogo,
          transparentBackground
        );
        
        // Restore original size
        this.renderer.setSize(originalSize.x, originalSize.y, false);
        this.camera.aspect = originalSize.x / originalSize.y;
        this.camera.updateProjectionMatrix();
        
        // Restore background and clear color
        this.scene.background = originalBackground;
        this.renderer.setClearColor(originalClearColor, originalClearAlpha);
        
        return dataUrl;
      }
      
      // Normal resolution capture
      this.renderer.render(this.scene, this.camera);
      
      const dataUrl = await this.compositeWithLogo(
        this.renderer.domElement, 
        this.canvas.width, 
        this.canvas.height, 
        includeLogo,
        transparentBackground
      );
      
      // Restore background and clear color
      this.scene.background = originalBackground;
      this.renderer.setClearColor(originalClearColor, originalClearAlpha);
      
      return dataUrl;
    } catch (error) {
      // Ensure background and clear color are restored even on error
      this.scene.background = originalBackground;
      this.renderer.setClearColor(originalClearColor, originalClearAlpha);
      throw error;
    }
  }
  
  private async compositeWithLogo(
    sourceCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    includeLogo: boolean,
    transparentBackground: boolean = false
  ): Promise<string> {
    // Create a temporary canvas to composite logo
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d', { alpha: true });
    if (!ctx) return sourceCanvas.toDataURL('image/png');
    
    // Clear canvas - if transparent, don't fill with color
    if (!transparentBackground) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    } else {
      // Clear to transparent
      ctx.clearRect(0, 0, width, height);
    }
    
    // Draw the WebGL canvas
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
    
    // Load and draw the logo if requested
    if (includeLogo) {
      try {
        const logo = await this.loadLogo();
        if (logo) {
          // Calculate logo size and position
          const logoWidth = width * LOGO_CONFIG.size;
          const logoHeight = (logo.height / logo.width) * logoWidth;
          
          // Position based on config
          let x = 0;
          let y = 0;
          const padding = 20;
          
          switch (LOGO_CONFIG.position) {
            case 'bottom-right':
              x = width - logoWidth - padding;
              y = height - logoHeight - padding;
              break;
            case 'bottom-left':
              x = padding;
              y = height - logoHeight - padding;
              break;
            case 'top-right':
              x = width - logoWidth - padding;
              y = padding;
              break;
            case 'top-left':
              x = padding;
              y = padding;
              break;
          }
          
          // Draw logo with opacity
          ctx.globalAlpha = LOGO_CONFIG.opacity;
          ctx.drawImage(logo, x, y, logoWidth, logoHeight);
          ctx.globalAlpha = 1.0;
        }
      } catch (error) {
        console.warn('[SceneManager] Failed to add logo to snapshot:', error);
      }
    }
    
    return tempCanvas.toDataURL('image/png');
  }
  
  private logoImage?: HTMLImageElement;
  
  private async loadLogo(): Promise<HTMLImageElement | null> {
    // Return cached logo if available
    if (this.logoImage) return this.logoImage;
    
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.logoImage = img;
        resolve(img);
      };
      img.onerror = () => {
        console.warn('[SceneManager] Failed to load logo');
        resolve(null);
      };
      img.src = LOGO_CONFIG.path;
    });
  }

  /**
   * Reset camera to default position
   */
  resetCamera() {
    if (!this.controls || !this.camera) return;
    
    // Reset to default position (closer)
    this.camera.position.set(0, 1.4, 1.6);
    this.controls.target.set(0, 1.4, 0);
    this.controls.update();
    
    console.log('[SceneManager] Camera reset to default position');
  }

  /**
   * Set camera to a preset view
   */
  setCameraPreset(preset: 'front' | 'quarter' | 'side') {
    if (!this.controls || !this.camera) return;
    
    switch (preset) {
      case 'front':
        this.camera.position.set(0, 1.4, 1.6); // Closer front view
        this.controls.target.set(0, 1.4, 0);
        break;
      case 'quarter':
        this.camera.position.set(1.2, 1.5, 1.4); // Closer quarter view
        this.controls.target.set(0, 1.4, 0);
        break;
      case 'side':
        this.camera.position.set(1.6, 1.4, 0); // Closer side view
        this.controls.target.set(0, 1.4, 0);
        break;
    }
    
    this.controls.update();
    console.log('[SceneManager] Camera set to', preset, 'view');
  }

  dispose() {
    if (this.animatedBackground) {
      this.animatedBackground.dispose();
      this.animatedBackground = undefined;
    }
    if (this.animationFrameId) window.cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.handleResize);
    this.tickHandlers.clear();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.scene = undefined;
    this.camera = undefined;
    this.renderer = undefined;
    this.controls = undefined;
    this.canvas = undefined;
  }
}

export const sceneManager = new SceneManager();


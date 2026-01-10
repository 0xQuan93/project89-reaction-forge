import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { applyBackground, type AnimatedBackground } from './backgrounds';
import type { BackgroundId } from '../types/reactions';
import { useSettingsStore } from '../state/useSettingsStore';
import { perfMonitor } from '../perf/perfMonitor';
import { useUIStore } from '../state/useUIStore';
import { lightingManager } from './lightingManager';
import { postProcessingManager } from './postProcessingManager';
import { environmentManager } from './environmentManager';
import { live2dManager } from '../live2d/live2dManager';

type TickHandler = (delta: number) => void;

// ======================
// Configuration Constants
// ======================

/** Logo overlay configuration for exports */
const LOGO_CONFIG = {
  path: '/logo/poselab.svg',
  position: 'bottom-right' as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  size: 0.08, // 8% of canvas width
  opacity: 0.85,
};

/** Camera configuration */
const CAMERA_CONFIG = {
  /** Field of view in degrees */
  FOV: 35,
  /** Near clipping plane - set very small to prevent clipping when zoomed in */
  NEAR: 0.01,
  /** Far clipping plane */
  FAR: 100,
  /** Default camera position */
  DEFAULT_POSITION: { x: 0, y: 1.4, z: 1.6 },
  /** Default orbit target */
  DEFAULT_TARGET: { x: 0, y: 1.4, z: 0 },
  /** Minimum orbit distance - allow close-ups but not inside the model */
  MIN_DISTANCE: 0.3,
  /** Maximum orbit distance */
  MAX_DISTANCE: 5,
};

/** Timing constants in milliseconds */
const TIMING = {
  /** Delay before applying initial resize to ensure canvas is in DOM */
  INITIAL_RESIZE_DELAY: 100,
  /** Delay before starting performance monitoring (allows initial load/shader compilation) */
  PERF_MONITOR_DELAY: 3000,
};

/** Default background ID on scene init */
const DEFAULT_BACKGROUND: BackgroundId = 'midnight-circuit';

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
  private overlayMesh?: THREE.Mesh;
  private animatedBackground?: AnimatedBackground;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.currentAspectRatio = this.getInitialAspectRatio();
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.FOV,
      canvas.clientWidth / canvas.clientHeight,
      CAMERA_CONFIG.NEAR,
      CAMERA_CONFIG.FAR
    );
    this.camera.position.set(
      CAMERA_CONFIG.DEFAULT_POSITION.x,
      CAMERA_CONFIG.DEFAULT_POSITION.y,
      CAMERA_CONFIG.DEFAULT_POSITION.z
    );

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
    this.controls.target.set(
      CAMERA_CONFIG.DEFAULT_TARGET.x,
      CAMERA_CONFIG.DEFAULT_TARGET.y,
      CAMERA_CONFIG.DEFAULT_TARGET.z
    );
    this.controls.enablePan = true;
    this.controls.enableDamping = true;
    this.controls.minDistance = CAMERA_CONFIG.MIN_DISTANCE;
    this.controls.maxDistance = CAMERA_CONFIG.MAX_DISTANCE;

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.startLoop();

    applyBackground(this.scene, DEFAULT_BACKGROUND);
    
    // Initialize visual managers
    lightingManager.init();
    postProcessingManager.init();
    environmentManager.init();
    
    // Apply initial aspect ratio after a short delay to ensure canvas is in DOM
    setTimeout(() => {
      this.handleResize();
    }, TIMING.INITIAL_RESIZE_DELAY);

    // Subscribe to settings changes
    useSettingsStore.subscribe((state) => {
      this.updateSettings(state);
    });
    
    // Apply initial settings
    this.updateSettings(useSettingsStore.getState());
    
    // Start performance monitoring after a short delay to allow initial load/compilation
    setTimeout(() => {
        perfMonitor.start();
    }, TIMING.PERF_MONITOR_DELAY);
  }

  private getInitialAspectRatio(): AspectRatio {
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (!isCoarsePointer) {
      return '16:9';
    }

    const minSide = Math.min(window.innerWidth, window.innerHeight);
    if (minSide <= 640) {
      return '9:16';
    }

    if (minSide <= 1024) {
      return '1:1';
    }

    return '16:9';
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

      // Update post-processing (for animated effects like film grain)
      postProcessingManager.update(delta);

      // Render using post-processing composer if enabled, otherwise direct render
      const composer = postProcessingManager.getComposer();
      if (postProcessingManager.isEnabled() && composer) {
        composer.render();
      } else {
        this.renderer?.render(this.scene!, this.camera!);
      }
      
      this.animationFrameId = window.requestAnimationFrame(loop);
    };
    this.animationFrameId = window.requestAnimationFrame(loop);
  }

  /**
   * Set a transparent video or image overlay
   * @param url URL to the overlay media (webm/png)
   * @param opacity Opacity (0-1)
   */
  async setOverlay(url: string | null, opacity = 1.0) {
    if (!this.camera || !this.scene) return;

    // Remove existing
    if (this.overlayMesh) {
      this.camera.remove(this.overlayMesh);
      // Dispose textures
      const mat = this.overlayMesh.material as THREE.MeshBasicMaterial;
      if (mat.map) mat.map.dispose();
      this.overlayMesh.geometry.dispose();
      this.overlayMesh = undefined;
    }

    if (!url) {
      return;
    }

    // Load Texture
    const isVideo = url.toLowerCase().endsWith('.webm') || url.toLowerCase().endsWith('.mp4');
    let texture: THREE.Texture;

    if (isVideo) {
      const video = document.createElement('video');
      video.src = url;
      video.loop = true;
      video.muted = true;
      video.crossOrigin = 'anonymous';
      video.play().catch(e => console.warn("Overlay video failed to play", e));
      texture = new THREE.VideoTexture(video);
    } else {
      texture = await new THREE.TextureLoader().loadAsync(url);
    }

    texture.colorSpace = THREE.SRGBColorSpace;

    // Create Mesh attached to Camera (HUD style)
    // We want it to cover the screen.
    // At z=-1 (in front of camera), width should be:
    // 2 * tan(fov/2) * aspect * 1
    
    // Actually, simpler to use a full-screen quad or just place it properly.
    // Let's place it at a fixed distance and scale it.
    
    const dist = 1; // 1 unit in front
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const height = 2 * Math.tan(fov / 2) * dist;
    const width = height * this.camera.aspect;

    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: opacity,
      depthTest: false, // Always on top
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.overlayMesh = new THREE.Mesh(geometry, material);
    // Move it significantly further out to avoid near clipping, but scale it to fill view
    // At z=-1, height is 2 * tan(fov/2). 
    // Let's use distance = 0.5 (closer to camera) or stay at 1.
    // The issue might be near plane clipping (0.1) or render order.
    
    // Ensure renderOrder puts it on top of everything
    this.overlayMesh.position.set(0, 0, -dist);
    this.overlayMesh.renderOrder = 9999; 
    this.overlayMesh.onBeforeRender = function(renderer) { renderer.clearDepth(); };
    
    this.camera.add(this.overlayMesh);
    
    // Force overlay to be visible (ensure camera is in scene)
    // The camera is already in scene, but sometimes updates are needed.
    // If we want it to act as a HUD, it must be a child of camera.
    // However, near plane clipping is a common issue.
    // distance=1, height=2*tan(fov/2). 
    // This is mathematically correct to fill the frustum at distance 1.
    // Let's verify frustumNear. Default is 0.1. Distance 1 is safe.
    
    console.log('[SceneManager] Overlay applied:', url);
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
    
    // Resize post-processing composer
    postProcessingManager.resize(canvasWidth, canvasHeight);
    
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

    // Use a very small near plane to prevent clipping on close-ups
    // but not so small it causes z-fighting
    this.camera.near = Math.max(0.01, distance / 500);
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(this.center);
    
    // Scale controls limits to accommodate the object size
    // Allow getting quite close for detail shots, but not inside the model
    this.controls.maxDistance = distance * 5;
    this.controls.minDistance = Math.max(0.2, distance * 0.05);
    
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
    
    // Check if we have an active CSS overlay
    const activeCssOverlay = useUIStore.getState().activeCssOverlay;

    console.log('[SceneManager] Capturing snapshot:', { 
      targetWidth, 
      targetHeight, 
      includeLogo, 
      transparentBackground,
      activeCssOverlay
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

        // Resize post-processing composer if enabled
        if (postProcessingManager.isEnabled()) {
          postProcessingManager.resize(targetWidth, targetHeight);
        }
        
        // Render at target resolution
        const composer = postProcessingManager.getComposer();
        if (postProcessingManager.isEnabled() && composer) {
          composer.render();
        } else {
          this.renderer.render(this.scene, this.camera);
        }
        
        // Capture the render
        const dataUrl = await this.compositeWithLogo(
          this.renderer.domElement, 
          targetWidth, 
          targetHeight, 
          includeLogo,
          transparentBackground,
          activeCssOverlay
        );
        
        // Restore original size
        this.renderer.setSize(originalSize.x, originalSize.y, false);
        this.camera.aspect = originalSize.x / originalSize.y;
        this.camera.updateProjectionMatrix();

        // Restore post-processing size
        if (postProcessingManager.isEnabled()) {
          postProcessingManager.resize(originalSize.x, originalSize.y);
        }
        
        // Restore background and clear color
        this.scene.background = originalBackground;
        this.renderer.setClearColor(originalClearColor, originalClearAlpha);
        
        return dataUrl;
      }
      
      // Normal resolution capture
      const composer = postProcessingManager.getComposer();
      if (postProcessingManager.isEnabled() && composer) {
        composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      
      const dataUrl = await this.compositeWithLogo(
        this.renderer.domElement, 
        this.canvas.width, 
        this.canvas.height, 
        includeLogo,
        transparentBackground,
        activeCssOverlay
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
    transparentBackground: boolean = false,
    cssOverlay: string | null = null
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

    // Draw Live2D overlay canvas if present
    const live2dCanvas = live2dManager.getCanvas();
    if (live2dCanvas && live2dCanvas.width > 0 && live2dCanvas.height > 0) {
      ctx.drawImage(live2dCanvas, 0, 0, width, height);
    }

    // Apply CSS-based effects by drawing them manually onto the canvas
    if (cssOverlay) {
        ctx.save();
        
        if (cssOverlay === 'overlay-scanlines') {
            // Draw horizontal scanlines
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            for (let i = 0; i < height; i += 4) {
                ctx.fillRect(0, i, width, 2);
            }
        } else if (cssOverlay === 'overlay-vignette') {
            // Draw radial gradient vignette
            const gradient = ctx.createRadialGradient(width/2, height/2, height/3, width/2, height/2, height * 0.8);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        } else if (cssOverlay === 'overlay-glitch') {
            // Simulate color channel shift
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
            ctx.fillRect(5, 0, width, height);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.fillRect(-5, 0, width, height);
        } else if (cssOverlay === 'overlay-crt') {
             // Scanlines + Vignette + slight RGB shift
             // 1. Scanlines
             ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
             for (let i = 0; i < height; i += 3) {
                 ctx.fillRect(0, i, width, 1);
             }
             // 2. Vignette
             const gradient = ctx.createRadialGradient(width/2, height/2, height/3, width/2, height/2, height);
             gradient.addColorStop(0, 'rgba(0,0,0,0)');
             gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
             ctx.globalCompositeOperation = 'source-over';
             ctx.fillStyle = gradient;
             ctx.fillRect(0, 0, width, height);
        }

        ctx.restore();
    }
    
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
    
    this.camera.position.set(
      CAMERA_CONFIG.DEFAULT_POSITION.x,
      CAMERA_CONFIG.DEFAULT_POSITION.y,
      CAMERA_CONFIG.DEFAULT_POSITION.z
    );
    this.controls.target.set(
      CAMERA_CONFIG.DEFAULT_TARGET.x,
      CAMERA_CONFIG.DEFAULT_TARGET.y,
      CAMERA_CONFIG.DEFAULT_TARGET.z
    );
    this.controls.update();
    
    console.log('[SceneManager] Camera reset to default position');
  }

  /**
   * Set camera to a preset view
   * Hotkeys: 1=headshot, 3=quarter, 5=side, 7=full body
   */
  setCameraPreset(preset: 'headshot' | 'quarter' | 'side' | 'fullbody') {
    if (!this.controls || !this.camera) return;
    
    const targetY = CAMERA_CONFIG.DEFAULT_TARGET.y;
    
    switch (preset) {
      case 'headshot':
        // Headshot mode - use frameHeadshot for smart head targeting
        this.frameHeadshot();
        return; // frameHeadshot handles everything
      case 'quarter':
        // 3/4 view - angled for dynamic poses
        this.camera.position.set(1.2, targetY + 0.1, 1.4);
        this.controls.target.set(
          CAMERA_CONFIG.DEFAULT_TARGET.x,
          CAMERA_CONFIG.DEFAULT_TARGET.y,
          CAMERA_CONFIG.DEFAULT_TARGET.z
        );
        break;
      case 'side':
        // Profile/side view
        this.camera.position.set(2.0, targetY, 0);
        this.controls.target.set(
          CAMERA_CONFIG.DEFAULT_TARGET.x,
          CAMERA_CONFIG.DEFAULT_TARGET.y,
          CAMERA_CONFIG.DEFAULT_TARGET.z
        );
        break;
      case 'fullbody':
        // Full body view - pull back to see entire avatar
        this.frameFullBody();
        return; // frameFullBody handles everything
    }
    
    this.controls.update();
    console.log('[SceneManager] Camera set to', preset, 'view');
  }

  /**
   * Smart full body framing - frames the entire avatar with proper margins
   */
  frameFullBody() {
    if (!this.controls || !this.camera || !this.scene) return;
    
    // Find the VRM avatar bounds
    let avatarBox: THREE.Box3 | null = null;
    
    this.scene.traverse((obj) => {
      if (obj.userData?.vrm || obj.name === 'VRMRoot') {
        avatarBox = new THREE.Box3().setFromObject(obj);
      }
    });
    
    if (!avatarBox) {
      // Fallback to default full body position
      this.camera.position.set(0, 0.9, 2.5);
      this.controls.target.set(0, 0.9, 0);
      this.controls.update();
      console.log('[SceneManager] Full body: Using default fallback');
      return;
    }
    
    const box = avatarBox as THREE.Box3;
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    
    // Calculate distance needed to fit avatar with margin
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (this.camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
    const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.3; // 1.3x for margin
    
    // Position camera in front, centered on avatar
    this.camera.position.set(
      center.x,
      center.y,
      center.z + distance
    );
    
    this.controls.target.copy(center);
    this.controls.update();
    
    console.log('[SceneManager] Full body: Framed avatar at distance', distance.toFixed(2));
  }

  /**
   * Smart headshot framing - finds the avatar's head and frames it nicely
   */
  frameHeadshot() {
    if (!this.controls || !this.camera || !this.scene) return;
    
    // Try to find the VRM's head bone for accurate targeting
    let headPosition: THREE.Vector3 | null = null;
    let avatarCenter: THREE.Vector3 | null = null;
    
    this.scene.traverse((obj) => {
      // Look for head bone (VRM naming conventions)
      if (obj.name.toLowerCase().includes('head') && !obj.name.toLowerCase().includes('headset')) {
        headPosition = new THREE.Vector3();
        obj.getWorldPosition(headPosition);
      }
      // Also get avatar root for fallback
      if (obj.userData?.vrm || obj.name === 'VRMRoot') {
        const box = new THREE.Box3().setFromObject(obj);
        avatarCenter = new THREE.Vector3();
        box.getCenter(avatarCenter);
      }
    });
    
    // Use head position if found, otherwise estimate from avatar bounds
    let targetPos: THREE.Vector3;
    
    if (headPosition) {
      targetPos = headPosition;
      console.log('[SceneManager] Headshot: Using detected head bone position');
    } else if (avatarCenter) {
      // Estimate head position as ~85% up the avatar height
      const box = new THREE.Box3();
      this.scene.traverse((obj) => {
        if (obj.userData?.vrm) {
          box.setFromObject(obj);
        }
      });
      const height = box.max.y - box.min.y;
      const center = avatarCenter as THREE.Vector3; // TypeScript narrowing help
      targetPos = new THREE.Vector3(
        center.x,
        box.min.y + height * 0.85, // Head is roughly at 85% height
        center.z
      );
      console.log('[SceneManager] Headshot: Estimating head from avatar bounds');
    } else {
      // Fallback to default target with slight offset
      targetPos = new THREE.Vector3(0, CAMERA_CONFIG.DEFAULT_TARGET.y + 0.2, 0);
      console.log('[SceneManager] Headshot: Using default fallback position');
    }
    
    // Position camera in front of the head at a good portrait distance
    const headDistance = 0.7; // Distance from head for nice portrait framing
    this.camera.position.set(
      targetPos.x,
      targetPos.y,
      targetPos.z + headDistance
    );
    
    // Look at the head
    this.controls.target.copy(targetPos);
    this.controls.update();
    
    console.log('[SceneManager] Headshot framed at:', targetPos);
  }

  dispose() {
    if (this.animatedBackground) {
      this.animatedBackground.dispose();
      this.animatedBackground = undefined;
    }
    if (this.animationFrameId) window.cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.handleResize);
    this.tickHandlers.clear();
    
    // Dispose visual managers
    lightingManager.dispose();
    postProcessingManager.dispose();
    environmentManager.destroy();
    
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

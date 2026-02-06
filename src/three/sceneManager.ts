import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { applyBackground, type AnimatedBackground } from './backgrounds';
import type { BackgroundId } from '../types/reactions';
import { useSettingsStore } from '../state/useSettingsStore';
import { perfMonitor } from '../perf/perfMonitor';
import { useUIStore } from '../state/useUIStore';
import { lightingManager } from './lightingManager';
import { postProcessingManager } from './postProcessingManager';
import { environmentManager, HDRI_PRESETS } from './environmentManager';
import { useSceneSettingsStore } from '../state/useSceneSettingsStore';
import { environment3DManager } from './environment3DManager';
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
  /** Selfie mode camera follow smoothing (lower = more dampening, 0.02-0.1 range) */
  SELFIE_FOLLOW_SMOOTHING: 0.04,
};

/** Timing constants in milliseconds */
const TIMING = {
  /** Delay before applying initial resize to ensure canvas is in DOM */
  INITIAL_RESIZE_DELAY: 100,
  /** Delay before starting performance monitoring (allows initial load/shader compilation) */
  PERF_MONITOR_DELAY: 3000,
};

/** Default background ID on scene init */
const DEFAULT_BACKGROUND: BackgroundId = 'synthwave-grid';

type AspectRatio = '16:9' | '1:1' | '9:16';

class SceneManager {
  private renderer?: THREE.WebGLRenderer;
  private camera?: THREE.PerspectiveCamera;
  private scene?: THREE.Scene;
  private controls?: OrbitControls;
  private animationFrameId?: number;
  private readonly tickHandlers = new Map<number, Set<TickHandler>>();
  private readonly clock = new THREE.Clock();
  private canvas?: HTMLCanvasElement;
  private readonly box = new THREE.Box3();
  private readonly size = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly followTargetPosition = new THREE.Vector3();
  private readonly followTargetQuaternion = new THREE.Quaternion();
  private readonly followTargetLookAt = new THREE.Vector3();
  private followTarget?: THREE.Object3D;
  private followOffset = new THREE.Vector3();
  private followMode: 'selfie' | 'third-person' | null = null;
  /** Smoothed camera position for dampened selfie follow */
  private readonly smoothedCameraPosition = new THREE.Vector3();
  /** Smoothed look-at target for dampened selfie follow */
  private readonly smoothedLookAt = new THREE.Vector3();
  /** Whether selfie follow has been initialized (for first frame) */
  private selfieFollowInitialized = false;
  private currentAspectRatio: AspectRatio = '16:9';
  private overlayMesh?: THREE.Mesh;
  private currentOverlayUrl: string | null = null;
  private currentOverlayOpacity: number = 1.0;
  private animatedBackground?: AnimatedBackground;
  private lastBackgroundId?: string;

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
    this.renderer.xr.enabled = true; // Enable WebXR support

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

  private isRunning = true;

  setRunning(running: boolean) {
    this.isRunning = running;
    if (running && !this.animationFrameId) {
      this.clock.start();
      this.startLoop();
    } else if (!running && this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
      this.clock.stop();
    }
  }

  manualRender(delta: number) {
    if (this.isRunning) {
        console.warn('[SceneManager] manualRender called while loop is running. Pausing loop.');
        this.setRunning(false);
    }
    this.processFrame(delta);
  }

  private processFrame(delta: number) {
      this.controls?.update();
      
      // Execute tick handlers in order of priority (higher first)
      const sortedPriorities = Array.from(this.tickHandlers.keys()).sort((a, b) => b - a);
      sortedPriorities.forEach(priority => {
          this.tickHandlers.get(priority)?.forEach(handler => handler(delta));
      });

      if (this.followTarget && this.camera && this.controls) {
        this.followTarget.getWorldPosition(this.followTargetPosition);
        
        if (this.followMode === 'selfie') {
            this.followTarget.getWorldQuaternion(this.followTargetQuaternion);
            
            // Calculate world position based on local offset rotated by target
            const worldOffset = this.followOffset.clone().applyQuaternion(this.followTargetQuaternion);
            
            // Target positions for camera and look-at
            const targetCameraPos = this.followTargetPosition.clone().add(worldOffset);
            this.followTargetLookAt.copy(this.followTargetPosition);
            
            // Initialize smoothed positions on first frame
            if (!this.selfieFollowInitialized) {
              this.smoothedCameraPosition.copy(targetCameraPos);
              this.smoothedLookAt.copy(this.followTargetLookAt);
              this.selfieFollowInitialized = true;
            }
            
            // Lerp towards target positions for subtle, dampened follow
            const smoothing = CAMERA_CONFIG.SELFIE_FOLLOW_SMOOTHING;
            this.smoothedCameraPosition.lerp(targetCameraPos, smoothing);
            this.smoothedLookAt.lerp(this.followTargetLookAt, smoothing);
            
            // Apply smoothed positions
            this.camera.position.copy(this.smoothedCameraPosition);
            this.camera.lookAt(this.smoothedLookAt);
            this.controls.target.copy(this.smoothedLookAt);

        } else if (this.followMode === 'third-person') {
            // Calculate desired camera position based on offset from target
            const targetCameraPos = this.followTargetPosition.clone().add(this.followOffset);
            
            // Smoothly interpolate camera and target positions
            this.camera.position.lerp(targetCameraPos, 0.05);
            this.controls.target.lerp(this.followTargetPosition, 0.05);
        }
      }

      if (this.animatedBackground) {
        this.animatedBackground.update(delta);
      }

      // Camera collision detection (prevent clipping through environment)
      this.handleCameraCollision();

      // Update post-processing (for animated effects like film grain)
      postProcessingManager.update(delta);

      // Render using post-processing composer if enabled, otherwise direct render
      const composer = postProcessingManager.getComposer();
      if (postProcessingManager.isEnabled() && composer) {
        composer.render();
      } else {
        this.renderer?.render(this.scene!, this.camera!);
      }
  }

  private handleCameraCollision() {
    if (!this.camera || !this.controls) return;
    
    const colliders = environment3DManager.getAllColliders();
    if (colliders.length === 0) return;

    // Raycast from target to camera to see if something is in between
    const target = this.controls.target;
    const cameraPos = this.camera.position;
    const direction = new THREE.Vector3().subVectors(cameraPos, target);
    const distance = direction.length();
    direction.normalize();

    const raycaster = new THREE.Raycaster(target, direction, 0, distance);
    const intersects = raycaster.intersectObjects(colliders, true);

    if (intersects.length > 0) {
      // Something is blocking the view! 
      // Move camera to just in front of the collision point
      const collisionPoint = intersects[0].point;
      const offset = direction.multiplyScalar(0.1); // 10cm offset from wall
      this.camera.position.copy(collisionPoint).sub(offset);
      
      // We don't update controls target here as that would change the look-at point
      // which might be confusing during a cinematic shot.
    }
  }

  private startLoop() {
    const loop = () => {
      if (!this.isRunning) return;
      const delta = this.clock.getDelta();
      this.processFrame(delta);
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

    this.currentOverlayUrl = url;
    this.currentOverlayOpacity = opacity;

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

  registerTick(handler: TickHandler, priority = 0) {
    if (!this.tickHandlers.has(priority)) {
        this.tickHandlers.set(priority, new Set());
    }
    this.tickHandlers.get(priority)!.add(handler);
    
    return () => {
        const set = this.tickHandlers.get(priority);
        if (set) {
            set.delete(handler);
            if (set.size === 0) {
                this.tickHandlers.delete(priority);
            }
        }
    };
  }

  getOverlayInfo() {
    return {
      url: this.currentOverlayUrl,
      opacity: this.currentOverlayOpacity
    };
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

  setFollowTarget(target: THREE.Object3D | null, mode: 'selfie' | 'third-person' | null) {
    if (!this.camera || !this.controls) return;
    
    this.followMode = mode;
    this.followTarget = target || undefined;
    this.selfieFollowInitialized = false; 
    
    if (!target || !mode) {
      this.controls.enabled = true;
      return;
    }

    this.controls.enabled = false;
    
    target.getWorldPosition(this.followTargetPosition);
    
    // Calculate offset for the camera from the target
    const worldOffset = new THREE.Vector3().subVectors(this.camera.position, this.followTargetPosition);
    
    if (mode === 'selfie') {
        target.getWorldQuaternion(this.followTargetQuaternion);
        // Convert world offset to local offset for selfie mode
        this.followOffset.copy(worldOffset).applyQuaternion(this.followTargetQuaternion.clone().invert());
    } else { // third-person
        this.followOffset.copy(worldOffset);
    }
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

  async setBackground(id: BackgroundId | string, force = false) {
    if (!this.scene) return;
    
    // SKIP if already set to this background - prevents redundant loads
    // and performance hitches during script playback or export
    if (!force && this.lastBackgroundId === id) {
      console.log('[SceneManager] Skipping background set (already active):', id);
      return;
    }

    console.log('[SceneManager] Setting background:', id);
    this.lastBackgroundId = id;

    // 1. Update the store first so UI stays in sync
    // This prevents "resets" when React components re-render
    const store = useSceneSettingsStore.getState();
    store.setCurrentBackground(id);

    // 2. Handle HDRI Environments
    if (HDRI_PRESETS[id]) {
      await store.setEnvironmentPreset(id);
      store.setEnvironment({ enabled: true });
      return;
    }

    // 3. Handle Standard Backgrounds
    // Dispose previous animated background ONLY if it's changing
    if (this.animatedBackground) {
      this.animatedBackground.dispose();
      this.animatedBackground = undefined;
    }

    // Apply the background
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
   * Defaults to full body view of the avatar's current position
   */
  resetCamera() {
    this.setCameraPreset('fullbody');
  }

  /**
   * Helper to find avatar head and hips positions
   */
  private getAvatarTargets(): { head: THREE.Vector3, hips: THREE.Vector3, forward: THREE.Vector3 } {
    let hipsPos: THREE.Vector3 | null = null;
    let headPos: THREE.Vector3 | null = null;
    let foundRootPos: THREE.Vector3 | null = null;
    let avatarRotation = new THREE.Quaternion();
    
    this.scene?.traverse((obj) => {
      const name = obj.name.toLowerCase();
      // Use standard VRM bone names
      if (name === 'hips') {
        hipsPos = new THREE.Vector3();
        obj.getWorldPosition(hipsPos);
        // Also capture hips rotation to know which way avatar is facing?
        // Actually, scene rotation is usually what matters for "Front", 
        // but bone rotation changes with animation. 
        // For presets (1,3,5,7) we usually want "World Front" centered on avatar, 
        // OR "Character Front". 
        // User request: "set to the avatars position". 
        // Let's stick to World offsets centered on Avatar Position for stability.
      }
      if (name === 'head' && !name.includes('headset')) {
        headPos = new THREE.Vector3();
        obj.getWorldPosition(headPos);
      }
      if (obj.userData?.vrm || name === 'vrmroot') {
        if (!foundRootPos) { // Capture the first found root
            foundRootPos = new THREE.Vector3();
            obj.getWorldPosition(foundRootPos);
            obj.getWorldQuaternion(avatarRotation);
        }
      }
    });

    // Fallbacks
    let finalHipsPos: THREE.Vector3;
    let finalHeadPos: THREE.Vector3;
    const defaultPos = new THREE.Vector3(0, 1.0, 0); // Define a consistent default

    if (hipsPos) {
        finalHipsPos = hipsPos;
    } else {
        finalHipsPos = (foundRootPos ? (foundRootPos as THREE.Vector3).clone() : defaultPos).add(new THREE.Vector3(0, 1.0, 0));
    }

    if (headPos) {
        finalHeadPos = headPos;
    } else {
        finalHeadPos = finalHipsPos.clone().add(new THREE.Vector3(0, 0.6, 0));
    }
    
    // Default forward vector (Z+)
    const forward = new THREE.Vector3(0, 0, 1);

    return { head: finalHeadPos, hips: finalHipsPos, forward };
  }

  /**
   * Set camera to a preset view
   * Hotkeys: 1=headshot, 3=quarter, 5=side, 7=full body
   */
  setCameraPreset(preset: 'headshot' | 'quarter' | 'side' | 'fullbody') {
    if (!this.controls || !this.camera) return;
    
    // Find avatar targets
    const targets = this.getAvatarTargets();
    const { head, hips } = targets;
    
    // Adjust Z distance based on aspect ratio to prevent cropping
    const aspect = this.camera.aspect;
    let distanceModifier = 1.0;
    if (aspect < 1) { // Portrait or square
        distanceModifier = 1 / aspect;
    }

    switch (preset) {
      case 'headshot':
        // Headshot: Target Head, Camera in front of head
        this.camera.position.set(head.x, head.y, head.z + 0.7 * distanceModifier);
        this.controls.target.copy(head);
        break;
        
      case 'quarter':
        // 3/4 View: Target Hips/Chest (averaged), Camera at 45 degrees
        // Target slightly above hips for better center of mass view
        const quarterTarget = hips.clone().add(new THREE.Vector3(0, 0.3, 0));
        this.controls.target.copy(quarterTarget);
        this.camera.position.set(
            quarterTarget.x + 1.2 * distanceModifier, 
            quarterTarget.y + 0.2, 
            quarterTarget.z + 1.2 * distanceModifier
        );
        break;
        
      case 'side':
        // Side View: Target Hips/Chest, Camera at 90 degrees (X axis)
        const sideTarget = hips.clone().add(new THREE.Vector3(0, 0.3, 0));
        this.controls.target.copy(sideTarget);
        this.camera.position.set(
            sideTarget.x + 2.0 * distanceModifier, 
            sideTarget.y, 
            sideTarget.z
        );
        break;
        
      case 'fullbody':
        // Full Body: Target Hips, Camera Front
        this.controls.target.copy(hips);
        this.camera.position.set(
            hips.x, 
            hips.y, 
            hips.z + 2.5 * distanceModifier
        );
        break;
    }
    
    this.controls.update();
    console.log(`[SceneManager] Camera set to ${preset} centered at`, this.controls.target);
  }

  /**
   * Smart full body framing - frames the entire avatar with proper margins
   * @deprecated Use setCameraPreset('fullbody')
   */
  frameFullBody() {
    this.setCameraPreset('fullbody');
  }

  /**
   * Smart headshot framing - finds the avatar's head and frames it nicely
   * @deprecated Use setCameraPreset('headshot')
   */
  frameHeadshot() {
    this.setCameraPreset('headshot');
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
    environment3DManager.dispose();
    
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

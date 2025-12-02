import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { applyBackground } from './backgrounds';
import type { BackgroundId } from '../types/reactions';

type TickHandler = (delta: number) => void;

// Logo overlay configuration
const LOGO_CONFIG = {
  path: '/logo/89-logo.svg', // Project 89 logo
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

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    this.camera.position.set(0, 1.4, 2.3);

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
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 3;

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.startLoop();

    applyBackground(this.scene, 'midnight');
  }

  private startLoop() {
    const loop = () => {
      const delta = this.clock.getDelta();
      this.controls?.update();
      this.tickHandlers.forEach((handler) => handler(delta));
      this.renderer?.render(this.scene!, this.camera!);
      this.animationFrameId = window.requestAnimationFrame(loop);
    };
    this.animationFrameId = window.requestAnimationFrame(loop);
  }

  private handleResize() {
    if (!this.renderer || !this.camera || !this.canvas) return;
    const { clientWidth, clientHeight } = this.canvas;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
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

    this.camera.near = distance / 10;
    this.camera.far = distance * 10;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(this.center);
    this.controls.update();
  }

  async setBackground(id: BackgroundId) {
    if (!this.scene) return;
    await applyBackground(this.scene, id);
  }

  /**
   * Set the aspect ratio for the scene
   * This will adjust the camera to match the desired aspect ratio
   */
  setAspectRatio(ratio: AspectRatio) {
    this.currentAspectRatio = ratio;
    console.log('[SceneManager] Aspect ratio set to:', ratio);
    
    if (!this.camera || !this.renderer || !this.canvas) return;
    
    // Calculate the aspect ratio value
    let aspectValue: number;
    switch (ratio) {
      case '16:9':
        aspectValue = 16 / 9;
        break;
      case '1:1':
        aspectValue = 1;
        break;
      case '9:16':
        aspectValue = 9 / 16;
        break;
      default:
        aspectValue = 16 / 9;
    }
    
    // Update camera aspect ratio
    this.camera.aspect = aspectValue;
    this.camera.updateProjectionMatrix();
    
    // Note: We don't resize the canvas here, we just adjust the camera
    // The canvas will maintain its container size, but the rendered view
    // will respect the aspect ratio
    console.log('[SceneManager] Camera aspect updated to:', aspectValue);
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
  }): Promise<string | null> {
    if (!this.renderer || !this.canvas || !this.scene || !this.camera) return null;
    
    const includeLogo = options?.includeLogo ?? true;
    const targetWidth = options?.width || this.canvas.width;
    const targetHeight = options?.height || this.canvas.height;
    
    console.log('[SceneManager] Capturing snapshot:', { targetWidth, targetHeight, includeLogo });
    
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
      const dataUrl = await this.compositeWithLogo(this.renderer.domElement, targetWidth, targetHeight, includeLogo);
      
      // Restore original size
      this.renderer.setSize(originalSize.x, originalSize.y, false);
      this.camera.aspect = originalSize.x / originalSize.y;
      this.camera.updateProjectionMatrix();
      
      return dataUrl;
    }
    
    // Normal resolution capture
    this.renderer.render(this.scene, this.camera);
    return this.compositeWithLogo(this.renderer.domElement, this.canvas.width, this.canvas.height, includeLogo);
  }
  
  private async compositeWithLogo(
    sourceCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    includeLogo: boolean
  ): Promise<string> {
    // Create a temporary canvas to composite logo
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return sourceCanvas.toDataURL('image/png');
    
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

  dispose() {
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


import * as THREE from 'three';
import { sceneManager } from './sceneManager';
import { avatarManager } from './avatarManager';
import type { DirectorScript, CameraPreset } from '../types/director';
import { useToastStore } from '../state/useToastStore';

class DirectorManager {
  private isPlaying = false;
  private currentScript: DirectorScript | null = null;
  private currentShotIndex = 0;
  private tickDispose?: () => void;

  // Camera interpolation state
  private startCameraPos = new THREE.Vector3();
  private startCameraTarget = new THREE.Vector3();
  private targetCameraPos = new THREE.Vector3();
  private targetCameraTarget = new THREE.Vector3();
  private shotElapsedTime = 0;

  /**
   * Play a director script
   */
  async playScript(script: DirectorScript): Promise<void> {
    if (this.isPlaying) {
      this.stop();
    }

    const vrm = avatarManager.getVRM();
    if (!vrm) {
      useToastStore.getState().addToast('Please load an avatar first', 'error');
      return;
    }

    console.log(`[Director] Starting script: ${script.title}`);
    this.isPlaying = true;
    this.currentScript = script;
    this.currentShotIndex = 0;

    // Initial shot setup
    await this.setupShot(0);

    // Register tick for camera movement
    this.tickDispose = sceneManager.registerTick((delta) => {
      this.update(delta);
    });
  }

  /**
   * Stop playback
   */
  stop() {
    if (!this.isPlaying) return;
    
    console.log('[Director] Stopping playback');
    this.isPlaying = false;
    this.tickDispose?.();
    this.tickDispose = undefined;
    this.currentScript = null;
    
    // Reset camera
    sceneManager.resetCamera();
  }

  private async setupShot(index: number) {
    if (!this.currentScript || index >= this.currentScript.shots.length) {
      this.stop();
      return;
    }

    const shot = this.currentScript.shots[index];
    this.currentShotIndex = index;
    this.shotElapsedTime = 0;

    console.log(`[Director] Shot ${index + 1}: ${shot.name} (${shot.duration}s)`);

    // 1. Apply Pose & Expression
    await avatarManager.applyPose(shot.poseId, shot.animated ?? true, 'loop', shot.rootMotion ?? false);
    avatarManager.applyExpression(shot.expressionId);

    // 2. Apply Background
    await sceneManager.setBackground(shot.backgroundId);

    // 3. Setup Camera Target
    this.calculateCameraTarget(shot.cameraPreset);
  }

  private calculateCameraTarget(preset: CameraPreset) {
    const camera = sceneManager.getCamera();
    const controls = sceneManager.getControls();
    const vrm = avatarManager.getVRM();
    if (!camera || !controls || !vrm) return;

    // Capture current for transition
    this.startCameraPos.copy(camera.position);
    this.startCameraTarget.copy(controls.target);

    // Get head position for smart framing
    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const headPos = new THREE.Vector3();
    if (head) {
        head.getWorldPosition(headPos);
    } else {
        headPos.set(0, 1.6, 0); // Fallback height
    }

    // Default target is usually the head or chest
    const lookAtPos = headPos.clone();
    const cameraPos = headPos.clone();

    switch (preset) {
      case 'headshot':
        cameraPos.z += 0.6;
        cameraPos.y += 0.05;
        break;
      case 'portrait':
        cameraPos.z += 1.0;
        cameraPos.y -= 0.1;
        lookAtPos.y -= 0.1;
        break;
      case 'medium':
        cameraPos.z += 1.6;
        cameraPos.y -= 0.3;
        lookAtPos.y -= 0.3;
        break;
      case 'full-body':
        cameraPos.z += 2.5;
        cameraPos.y -= 0.6;
        lookAtPos.y -= 0.7;
        break;
      case 'wide':
        cameraPos.z += 4.0;
        cameraPos.x += 1.0;
        cameraPos.y -= 0.4;
        lookAtPos.y -= 0.6;
        break;
      case 'low-angle':
        cameraPos.z += 1.8;
        cameraPos.y -= 1.2;
        lookAtPos.y -= 0.4;
        break;
      case 'high-angle':
        cameraPos.z += 1.5;
        cameraPos.y += 1.0;
        lookAtPos.y -= 0.4;
        break;
      case 'over-shoulder':
        cameraPos.z -= 0.8;
        cameraPos.x += 0.6;
        cameraPos.y += 0.1;
        lookAtPos.z += 1.0;
        lookAtPos.x -= 0.4;
        break;
      case 'orbit-slow':
      case 'orbit-fast':
        cameraPos.z += 1.8;
        cameraPos.x += 0.5;
        break;
      case 'dolly-in':
        cameraPos.z += 2.0;
        // Target is closer than start
        // For dolly moves, we want a specific start point relative to the subject,
        // not relative to the previous camera position.
        this.startCameraPos.copy(cameraPos);
        this.startCameraTarget.copy(lookAtPos);
        
        this.targetCameraPos.copy(cameraPos).add(new THREE.Vector3(0, 0, -1.2));
        this.targetCameraTarget.copy(lookAtPos);
        return; // Return early to avoid overwrite
      case 'dolly-out':
        cameraPos.z += 1.0;
        // Target is further than start
        this.startCameraPos.copy(cameraPos);
        this.startCameraTarget.copy(lookAtPos);
        
        this.targetCameraPos.copy(cameraPos).add(new THREE.Vector3(0, 0, 1.2));
        this.targetCameraTarget.copy(lookAtPos);
        return; // Return early to avoid overwrite
    }

    this.targetCameraPos.copy(cameraPos);
    this.targetCameraTarget.copy(lookAtPos);
  }

  private update(delta: number) {
    if (!this.isPlaying || !this.currentScript) return;

    this.shotElapsedTime += delta;
    const shot = this.currentScript.shots[this.currentShotIndex];

    if (this.shotElapsedTime >= shot.duration) {
      // Move to next shot
      this.setupShot(this.currentShotIndex + 1);
      return;
    }

    // Handle camera movement/animations based on preset
    const camera = sceneManager.getCamera();
    const controls = sceneManager.getControls();
    if (!camera || !controls) return;

    const t = this.shotElapsedTime / shot.duration;
    const transitionTime = 1.5; // 1.5 second smooth transition between shots
    const isTransitioning = this.shotElapsedTime < transitionTime;
    const transitionT = isTransitioning ? this.shotElapsedTime / transitionTime : 1.0;
    
    // Smooth easing for transition
    const easedT = transitionT < 0.5 ? 2 * transitionT * transitionT : -1 + (4 - 2 * transitionT) * transitionT;

    if (shot.cameraPreset.startsWith('orbit')) {
        const radius = 1.8;
        const speed = shot.cameraPreset === 'orbit-fast' ? 1.0 : 0.3;
        const angle = t * Math.PI * 0.5 * speed; // 90 degree orbit
        
        const orbitPos = new THREE.Vector3(
            Math.sin(angle) * radius,
            this.targetCameraPos.y,
            Math.cos(angle) * radius
        );

        if (isTransitioning) {
            camera.position.lerpVectors(this.startCameraPos, orbitPos, easedT);
            controls.target.lerpVectors(this.startCameraTarget, this.targetCameraTarget, easedT);
        } else {
            camera.position.copy(orbitPos);
            controls.target.copy(this.targetCameraTarget);
        }
    } else if (shot.cameraPreset === 'dolly-in' || shot.cameraPreset === 'dolly-out') {
        // For dolly, we interpolate between start and target throughout the shot
        camera.position.lerpVectors(this.startCameraPos, this.targetCameraPos, t);
        controls.target.lerpVectors(this.startCameraTarget, this.targetCameraTarget, easedT);
    } else {
        // Standard shot with transition at the start
        if (isTransitioning) {
            camera.position.lerpVectors(this.startCameraPos, this.targetCameraPos, easedT);
            controls.target.lerpVectors(this.startCameraTarget, this.targetCameraTarget, easedT);
        } else {
            camera.position.copy(this.targetCameraPos);
            controls.target.copy(this.targetCameraTarget);
        }
    }

    controls.update();
  }
}

export const directorManager = new DirectorManager();

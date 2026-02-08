/**
 * IntroSequence - Cinematic opening sequence for PoseLab
 * 
 * Creates an immersive showcase when the app opens or avatar loads:
 * - Camera dolly/orbit animations
 * - Pose transitions
 * - Expression changes
 * - Optional auto-capture at peak moments
 */

import * as THREE from 'three';
import { sceneManager } from '../three/sceneManager';
import { avatarManager } from '../three/avatarManager';
import { useIntroStore } from '../state/useIntroStore';
import type { PoseId, ExpressionId } from '../types/reactions';
import { useSceneSettingsStore } from '../state/useSceneSettingsStore';

/** Camera keyframe for animation */
interface CameraKeyframe {
  position: THREE.Vector3;
  target: THREE.Vector3;
  duration: number; // seconds
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

/** Pose keyframe for avatar animation */
interface PoseKeyframe {
  pose: PoseId;
  expression?: ExpressionId;
  delay: number; // seconds from start
  animated?: boolean;
}

/** Capture moment for auto-snapshot */
interface CaptureMoment {
  delay: number; // seconds from start
  label?: string;
}

/** Complete intro sequence definition */
interface IntroSequenceDefinition {
  name: string;
  duration: number; // total duration in seconds
  cameraKeyframes: CameraKeyframe[];
  poseKeyframes: PoseKeyframe[];
  captureMoments?: CaptureMoment[];
}

// Easing functions
const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};

// Pre-defined intro sequences with cinematic camera work
// CAMERA DISTANCE GUIDELINES:
// - Minimum Z distance: 1.2 (close-up)
// - Normal Z distance: 1.6 (front view)
// - Wide Z distance: 2.0-2.5 (full body)
// - All sequences should end near front view (z ~1.6)

const SEQUENCES: Record<string, IntroSequenceDefinition> = {
  'sunset-showcase': {
    name: 'Sunset Showcase',
    duration: 8,
    cameraKeyframes: [
      // Start wide and low, looking up (hero shot)
      { 
        position: new THREE.Vector3(1.8, 1.0, 2.0), 
        target: new THREE.Vector3(0, 1.1, 0), 
        duration: 2,
        easing: 'easeOut'
      },
      // Rise up and orbit to 3/4 view (classic portrait angle)
      { 
        position: new THREE.Vector3(1.0, 1.45, 1.5), 
        target: new THREE.Vector3(0, 1.35, 0), 
        duration: 2.5,
        easing: 'easeInOut'
      },
      // Dolly in for portrait (safer distance)
      { 
        position: new THREE.Vector3(0.3, 1.4, 1.5), 
        target: new THREE.Vector3(0, 1.35, 0), 
        duration: 1.5,
        easing: 'easeInOut'
      },
      // Pull back to final front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'sunset-call', expression: 'calm', delay: 0, animated: true },
    ],
    captureMoments: [
      { delay: 2, label: 'Hero' },
      { delay: 4.5, label: 'Portrait' },
      { delay: 6, label: 'CloseUp' },
      { delay: 7.8, label: 'Beauty' },
    ],
  },
  'dynamic-reveal': {
    name: 'Dynamic Reveal',
    duration: 12,
    cameraKeyframes: [
      // Start behind shoulder (mystery shot)
      { 
        position: new THREE.Vector3(-1.2, 1.5, -0.5), 
        target: new THREE.Vector3(0, 1.4, 0.5), 
        duration: 1,
        easing: 'easeOut'
      },
      // Dramatic swing around to reveal face
      { 
        position: new THREE.Vector3(1.6, 1.35, 1.2), 
        target: new THREE.Vector3(0, 1.25, 0), 
        duration: 2.5,
        easing: 'easeInOut'
      },
      // Low angle power shot during taunt
      { 
        position: new THREE.Vector3(0.3, 0.9, 1.6), 
        target: new THREE.Vector3(0, 1.15, 0), 
        duration: 2,
        easing: 'easeOut'
      },
      // Wide dance shot
      { 
        position: new THREE.Vector3(-1.3, 1.4, 1.8), 
        target: new THREE.Vector3(0, 1.1, 0), 
        duration: 2.5,
        easing: 'easeInOut'
      },
      // Celebration 3/4 view
      { 
        position: new THREE.Vector3(0.8, 1.4, 1.4), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Final front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'cipher-whisper', expression: 'calm', delay: 0, animated: true },
      { pose: 'agent-taunt', expression: 'joy', delay: 3.5, animated: true },
      { pose: 'agent-dance', expression: 'joy', delay: 6, animated: true },
      { pose: 'agent-clapping', expression: 'joy', delay: 8.5, animated: true },
      { pose: 'dawn-runner', expression: 'calm', delay: 10.5, animated: true },
    ],
    captureMoments: [
      { delay: 3, label: 'Reveal' },
      { delay: 5, label: 'Power' },
      { delay: 7.5, label: 'Dance' },
      { delay: 10, label: 'Victory' },
      { delay: 11.8, label: 'Iconic' },
    ],
  },
  'content-creator': {
    name: 'Content Creator',
    duration: 10,
    cameraKeyframes: [
      // Start with low angle (not too close)
      { 
        position: new THREE.Vector3(0, 0.8, 1.8), 
        target: new THREE.Vector3(0, 1.2, 0), 
        duration: 1.5,
        easing: 'easeOut'
      },
      // Rise to eye level for connection
      { 
        position: new THREE.Vector3(0.7, 1.4, 1.4), 
        target: new THREE.Vector3(0, 1.35, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Pull back for full body during wave
      { 
        position: new THREE.Vector3(-0.4, 1.25, 2.0), 
        target: new THREE.Vector3(0, 1.1, 0), 
        duration: 2,
        easing: 'easeOut'
      },
      // 3/4 angle for style
      { 
        position: new THREE.Vector3(1.0, 1.45, 1.3), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Final front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2.5,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'nebula-drift', expression: 'calm', delay: 0, animated: true },
      { pose: 'simple-wave', expression: 'joy', delay: 3, animated: true },
      { pose: 'point', expression: 'joy', delay: 5.5, animated: true },
      { pose: 'sunset-call', expression: 'calm', delay: 7.5, animated: true },
    ],
    captureMoments: [
      { delay: 1.5, label: 'Dramatic' },
      { delay: 4, label: 'Wave' },
      { delay: 6.5, label: 'Point' },
      { delay: 9.5, label: 'Final' },
    ],
  },
  'quick-snap': {
    name: 'Quick Snap',
    duration: 3,
    cameraKeyframes: [
      // Start slightly off-center
      { 
        position: new THREE.Vector3(0.4, 1.4, 2.0), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 0.5,
        easing: 'easeIn'
      },
      // Quick dolly to portrait distance
      { 
        position: new THREE.Vector3(0.2, 1.4, 1.5), 
        target: new THREE.Vector3(0, 1.35, 0), 
        duration: 1.5,
        easing: 'easeOut'
      },
      // Settle to front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 1,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'simple-wave', expression: 'joy', delay: 0, animated: true },
    ],
    captureMoments: [
      { delay: 2, label: 'Portrait' },
      { delay: 2.8, label: 'Final' },
    ],
  },
  'hero-entrance': {
    name: 'Hero Entrance',
    duration: 10,
    cameraKeyframes: [
      // Epic wide establishing shot
      { 
        position: new THREE.Vector3(2.5, 1.6, 2.2), 
        target: new THREE.Vector3(0, 1.1, 0), 
        duration: 2,
        easing: 'easeOut'
      },
      // Dramatic push in during taunt
      { 
        position: new THREE.Vector3(1.0, 1.1, 1.6), 
        target: new THREE.Vector3(0, 1.2, 0), 
        duration: 2.5,
        easing: 'easeInOut'
      },
      // Low angle hero shot (not too close)
      { 
        position: new THREE.Vector3(0, 0.8, 1.5), 
        target: new THREE.Vector3(0, 1.25, 0), 
        duration: 2,
        easing: 'easeOut'
      },
      // Orbit around during dance
      { 
        position: new THREE.Vector3(-1.2, 1.35, 1.4), 
        target: new THREE.Vector3(0, 1.2, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Final front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 1.5,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'signal-reverie', expression: 'calm', delay: 0, animated: true },
      { pose: 'agent-taunt', expression: 'surprise', delay: 2, animated: true },
      { pose: 'silly-agent', expression: 'joy', delay: 5, animated: true },
      { pose: 'agent-clapping', expression: 'joy', delay: 8, animated: true },
    ],
    captureMoments: [
      { delay: 2, label: 'Epic' },
      { delay: 4, label: 'Taunt' },
      { delay: 6.5, label: 'Dance' },
      { delay: 9.5, label: 'Hero' },
    ],
  },
  'chill-vibes': {
    name: 'Chill Vibes',
    duration: 8,
    cameraKeyframes: [
      // Gentle start from side
      { 
        position: new THREE.Vector3(1.3, 1.4, 1.4), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2.5,
        easing: 'easeOut'
      },
      // Slow orbit to front
      { 
        position: new THREE.Vector3(0.2, 1.4, 1.5), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 3,
        easing: 'easeInOut'
      },
      // Settle to front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2.5,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'cipher-whisper', expression: 'calm', delay: 0, animated: true },
      { pose: 'nebula-drift', expression: 'calm', delay: 3, animated: true },
      { pose: 'sunset-call', expression: 'joy', delay: 6, animated: true },
    ],
    captureMoments: [
      { delay: 2, label: 'Working' },
      { delay: 5, label: 'Thinking' },
      { delay: 7.5, label: 'Relaxed' },
    ],
  },
  'power-poses': {
    name: 'Power Poses',
    duration: 14,
    cameraKeyframes: [
      // Wide establishing
      { 
        position: new THREE.Vector3(2.2, 1.3, 2.0), 
        target: new THREE.Vector3(0, 1.15, 0), 
        duration: 2,
        easing: 'easeOut'
      },
      // Low angle power shot (not too close)
      { 
        position: new THREE.Vector3(0, 0.9, 1.7), 
        target: new THREE.Vector3(0, 1.2, 0), 
        duration: 2.5,
        easing: 'easeInOut'
      },
      // Side profile
      { 
        position: new THREE.Vector3(1.6, 1.35, 0.6), 
        target: new THREE.Vector3(0, 1.25, 0), 
        duration: 2.5,
        easing: 'easeInOut'
      },
      // Dynamic 3/4
      { 
        position: new THREE.Vector3(-1.0, 1.45, 1.4), 
        target: new THREE.Vector3(0, 1.25, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Portrait angle
      { 
        position: new THREE.Vector3(0.5, 1.4, 1.4), 
        target: new THREE.Vector3(0, 1.35, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Final front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 3,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'signal-reverie', expression: 'calm', delay: 0, animated: true },
      { pose: 'agent-taunt', expression: 'surprise', delay: 2.5, animated: true },
      { pose: 'point', expression: 'joy', delay: 5.5, animated: true },
      { pose: 'simple-wave', expression: 'joy', delay: 8, animated: true },
      { pose: 'agent-clapping', expression: 'joy', delay: 10.5, animated: true },
      { pose: 'dawn-runner', expression: 'calm', delay: 12.5, animated: true },
    ],
    captureMoments: [
      { delay: 2, label: 'Ready' },
      { delay: 4.5, label: 'Taunt' },
      { delay: 7, label: 'Point' },
      { delay: 9.5, label: 'Wave' },
      { delay: 12, label: 'Clapping' },
      { delay: 13.8, label: 'Hero' },
    ],
  },
  'emotional-journey': {
    name: 'Emotional Journey',
    duration: 12,
    cameraKeyframes: [
      // Start on face (sad) - safer distance
      { 
        position: new THREE.Vector3(0.3, 1.4, 1.5), 
        target: new THREE.Vector3(0, 1.35, 0), 
        duration: 2.5,
        easing: 'easeOut'
      },
      // Pull back as hope arrives
      { 
        position: new THREE.Vector3(0.7, 1.35, 1.5), 
        target: new THREE.Vector3(0, 1.25, 0), 
        duration: 2.5,
        easing: 'easeInOut'
      },
      // Wide for awakening
      { 
        position: new THREE.Vector3(-0.4, 1.4, 1.8), 
        target: new THREE.Vector3(0, 1.15, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Orbit to celebration
      { 
        position: new THREE.Vector3(1.1, 1.3, 1.4), 
        target: new THREE.Vector3(0, 1.2, 0), 
        duration: 2.5,
        easing: 'easeInOut'
      },
      // Final front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2.5,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'nebula-drift', expression: 'calm', delay: 0, animated: true },
      { pose: 'cipher-whisper', expression: 'surprise', delay: 3, animated: true },
      { pose: 'signal-reverie', expression: 'calm', delay: 5.5, animated: true },
      { pose: 'agent-clapping', expression: 'joy', delay: 8, animated: true },
      { pose: 'sunset-call', expression: 'joy', delay: 10.5, animated: true },
    ],
    captureMoments: [
      { delay: 2.5, label: 'Calm' },
      { delay: 5, label: 'Awakening' },
      { delay: 7, label: 'Focused' },
      { delay: 9.5, label: 'Celebration' },
      { delay: 11.5, label: 'Happy' },
    ],
  },
  'party-mode': {
    name: 'Party Mode',
    duration: 10,
    cameraKeyframes: [
      // High energy start
      { 
        position: new THREE.Vector3(1.3, 1.1, 1.6), 
        target: new THREE.Vector3(0, 1.1, 0), 
        duration: 1.5,
        easing: 'easeOut'
      },
      // Dance orbit
      { 
        position: new THREE.Vector3(-1.1, 1.35, 1.5), 
        target: new THREE.Vector3(0, 1.15, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Wide party shot
      { 
        position: new THREE.Vector3(0, 1.35, 2.0), 
        target: new THREE.Vector3(0, 1.1, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Dance 3/4 view
      { 
        position: new THREE.Vector3(0.8, 1.25, 1.4), 
        target: new THREE.Vector3(0, 1.2, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Final front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2.5,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'silly-agent', expression: 'joy', delay: 0, animated: true },
      { pose: 'agent-dance', expression: 'joy', delay: 2, animated: true },
      { pose: 'agent-clapping', expression: 'joy', delay: 4.5, animated: true },
      { pose: 'simple-wave', expression: 'joy', delay: 6.5, animated: true },
      { pose: 'agent-taunt', expression: 'joy', delay: 8.5, animated: true },
    ],
    captureMoments: [
      { delay: 1.5, label: 'Dance1' },
      { delay: 3.5, label: 'Dance2' },
      { delay: 5.5, label: 'Cheer' },
      { delay: 7.5, label: 'Wave' },
      { delay: 9.5, label: 'Taunt' },
    ],
  },
  'professional': {
    name: 'Professional',
    duration: 8,
    cameraKeyframes: [
      // Clean side approach
      { 
        position: new THREE.Vector3(1.4, 1.4, 1.2), 
        target: new THREE.Vector3(0, 1.35, 0), 
        duration: 2,
        easing: 'easeOut'
      },
      // Classic portrait angle
      { 
        position: new THREE.Vector3(0.4, 1.4, 1.4), 
        target: new THREE.Vector3(0, 1.35, 0), 
        duration: 2.5,
        easing: 'easeInOut'
      },
      // Slight orbit
      { 
        position: new THREE.Vector3(-0.3, 1.4, 1.5), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 2,
        easing: 'easeInOut'
      },
      // Final front view
      { 
        position: new THREE.Vector3(0, 1.4, 1.6), 
        target: new THREE.Vector3(0, 1.3, 0), 
        duration: 1.5,
        easing: 'easeOut'
      },
    ],
    poseKeyframes: [
      { pose: 'cipher-whisper', expression: 'calm', delay: 0, animated: true },
      { pose: 'simple-wave', expression: 'joy', delay: 2.5, animated: true },
      { pose: 'point', expression: 'calm', delay: 5, animated: true },
      { pose: 'sunset-call', expression: 'joy', delay: 7, animated: true },
    ],
    captureMoments: [
      { delay: 2, label: 'Focused' },
      { delay: 4, label: 'Wave' },
      { delay: 6, label: 'Present' },
      { delay: 7.8, label: 'Confident' },
    ],
  },
};

class IntroSequenceManager {
  private isPlaying = false;
  private startTime = 0;
  private currentSequence: IntroSequenceDefinition | null = null;
  private tickDispose?: () => void;
  private capturedMoments = new Set<number>();
  private pendingPoses = new Set<number>();
  
  // Interpolation state
  private currentKeyframeIndex = 0;
  private startPosition = new THREE.Vector3();
  private startTarget = new THREE.Vector3();

  /**
   * Play an intro sequence
   */
  async play(sequenceId: string = 'sunset-showcase'): Promise<void> {
    const sequence = SEQUENCES[sequenceId];
    if (!sequence) {
      console.warn(`[IntroSequence] Unknown sequence: ${sequenceId}`);
      return;
    }

    const store = useIntroStore.getState();
    if (!store.enabled) {
      console.log('[IntroSequence] Intro disabled, applying default pose');
      await this.applyDefaultPose();
      return;
    }

    if (this.isPlaying) {
      console.log('[IntroSequence] Already playing, skipping');
      return;
    }

    const vrm = avatarManager.getVRM();
    if (!vrm) {
      console.log('[IntroSequence] No VRM loaded, skipping intro');
      return;
    }

    console.log(`[IntroSequence] Playing: ${sequence.name}`);

    this.isPlaying = true;
    this.currentSequence = sequence;
    this.startTime = performance.now() / 1000;
    this.capturedMoments.clear();
    this.pendingPoses.clear();
    this.currentKeyframeIndex = 0;

    // Set initial camera position
    const camera = sceneManager.getCamera();
    const controls = sceneManager.getControls();
    if (camera && controls && sequence.cameraKeyframes.length > 0) {
      this.startPosition.copy(camera.position);
      this.startTarget.copy(controls.target);
    }

    // Schedule pose changes
    sequence.poseKeyframes.forEach((poseKf, index) => {
      this.pendingPoses.add(index);
      setTimeout(() => {
        if (this.isPlaying && this.pendingPoses.has(index)) {
          this.applyPoseKeyframe(poseKf);
          this.pendingPoses.delete(index);
        }
      }, poseKf.delay * 1000);
    });

    // Start the animation tick
    this.tickDispose = sceneManager.registerTick((delta) => {
      this.updateCamera(delta);
    });

    // Wait for sequence to complete
    return new Promise((resolve) => {
      setTimeout(() => {
        this.stop();
        resolve();
      }, sequence.duration * 1000);
    });
  }

  /**
   * Stop the current sequence and reset camera to front view
   */
  stop() {
    if (!this.isPlaying) return;

    console.log('[IntroSequence] Stopped');
    this.isPlaying = false;
    this.currentSequence = null;
    this.tickDispose?.();
    this.tickDispose = undefined;
    this.capturedMoments.clear();
    this.pendingPoses.clear();
    
    // Reset camera to fit avatar (consistent with UI "Fit to Screen" button)
    const vrm = avatarManager.getVRM();
    if (vrm) {
      sceneManager.frameObject(vrm.scene);
      console.log('[IntroSequence] Camera reset to fit avatar');
    } else {
      // Fallback if VRM reference missing
      const camera = sceneManager.getCamera();
      const controls = sceneManager.getControls();
      if (camera && controls) {
        camera.position.set(0, 1.4, 1.6);
        controls.target.set(0, 1.3, 0);
        controls.update();
      }
    }
    
    // Notify store
    useIntroStore.getState().setPlaying(false);
  }

  /**
   * Apply the default pose (sunset-call) without intro
   */
  async applyDefaultPose() {
    try {
      const rotationLocked = useSceneSettingsStore.getState().rotationLocked;
      await avatarManager.applyPose('sunset-call', rotationLocked, true, 'loop');
      avatarManager.applyExpression('calm');
      console.log('[IntroSequence] Applied default pose: sunset-call');
    } catch (e) {
      console.warn('[IntroSequence] Could not apply default pose:', e);
    }
  }

  /**
   * Check if currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get available sequence IDs
   */
  getSequenceIds(): string[] {
    return Object.keys(SEQUENCES);
  }

  /**
   * Get sequence info
   */
  getSequenceInfo(id: string): { name: string; duration: number } | null {
    const seq = SEQUENCES[id];
    if (!seq) return null;
    return { name: seq.name, duration: seq.duration };
  }

  /**
   * Trigger a random snapshot (called by auto-capture feature)
   */
  async triggerRandomSnapshot(): Promise<string | null> {
    const store = useIntroStore.getState();
    if (!store.autoCapture) return null;

    const dataUrl = await sceneManager.captureSnapshot({
      includeLogo: true,
      transparentBackground: false,
    });

    if (dataUrl) {
      console.log('[IntroSequence] Auto-captured snapshot');
      store.addAutoCapture(dataUrl);
    }

    return dataUrl;
  }

  // ==================
  // Internal
  // ==================

  private updateCamera(_delta: number) {
    if (!this.isPlaying || !this.currentSequence) return;

    const camera = sceneManager.getCamera();
    const controls = sceneManager.getControls();
    if (!camera || !controls) return;

    const now = performance.now() / 1000;
    const elapsed = now - this.startTime;
    const keyframes = this.currentSequence.cameraKeyframes;

    // Check for capture moments
    this.checkCaptureMoments(elapsed);

    // Find current keyframe segment
    let accumulatedTime = 0;
    for (let i = 0; i < keyframes.length; i++) {
      const kf = keyframes[i];
      const segmentEnd = accumulatedTime + kf.duration;

      if (elapsed < segmentEnd || i === keyframes.length - 1) {
        // We're in this segment
        if (i !== this.currentKeyframeIndex) {
          // Starting a new segment
          this.currentKeyframeIndex = i;
          this.startPosition.copy(camera.position);
          this.startTarget.copy(controls.target);
        }

        // Calculate progress in this segment
        const segmentElapsed = elapsed - accumulatedTime;
        const t = Math.min(1, segmentElapsed / kf.duration);
        const easedT = easings[kf.easing || 'easeInOut'](t);

        // Interpolate position
        camera.position.lerpVectors(this.startPosition, kf.position, easedT);
        
        // Interpolate target
        const currentTarget = new THREE.Vector3();
        currentTarget.lerpVectors(this.startTarget, kf.target, easedT);
        controls.target.copy(currentTarget);
        controls.update();

        break;
      }

      accumulatedTime = segmentEnd;
    }
  }

  private async checkCaptureMoments(elapsed: number) {
    if (!this.currentSequence?.captureMoments) return;

    const store = useIntroStore.getState();
    if (!store.autoCapture) return;

    for (let i = 0; i < this.currentSequence.captureMoments.length; i++) {
      const moment = this.currentSequence.captureMoments[i];
      
      // Check if we've passed this moment and haven't captured yet
      if (elapsed >= moment.delay && !this.capturedMoments.has(i)) {
        this.capturedMoments.add(i);
        
        const dataUrl = await sceneManager.captureSnapshot({
          includeLogo: true,
          transparentBackground: false,
        });

        if (dataUrl) {
          console.log(`[IntroSequence] Auto-captured: ${moment.label || 'moment ' + i}`);
          store.addAutoCapture(dataUrl);
        }
      }
    }
  }

  private async applyPoseKeyframe(poseKf: PoseKeyframe) {
    try {
      const rotationLocked = useSceneSettingsStore.getState().rotationLocked;
      await avatarManager.applyPose(poseKf.pose, rotationLocked, poseKf.animated ?? true, 'loop');
      if (poseKf.expression) {
        avatarManager.applyExpression(poseKf.expression);
      }
    } catch (e) {
      console.warn(`[IntroSequence] Failed to apply pose ${poseKf.pose}:`, e);
    }
  }
}

// Singleton
export const introSequence = new IntroSequenceManager();


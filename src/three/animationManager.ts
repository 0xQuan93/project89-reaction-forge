import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

/**
 * AnimationManager handles playback of animation clips on VRM avatars
 */
class AnimationManager {
  private mixer?: THREE.AnimationMixer;
  private currentAction?: THREE.AnimationAction;
  private vrm?: VRM;

  /**
   * Initialize the animation manager with a VRM avatar
   */
  initialize(vrm: VRM) {
    console.log('[AnimationManager] Initializing with VRM');
    this.cleanup();
    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);
  }

  /**
   * Play an animation clip
   * @param clip - The THREE.AnimationClip to play
   * @param loop - Whether to loop the animation (default: true)
   * @param fadeInDuration - Fade in duration in seconds (default: 0.3)
   */
  playAnimation(clip: THREE.AnimationClip, loop = true, fadeInDuration = 0.3) {
    if (!this.mixer || !this.vrm) {
      console.warn('[AnimationManager] Cannot play animation - mixer not initialized');
      return;
    }

    console.log('[AnimationManager] Playing animation:', clip.name, { loop, duration: clip.duration });

    // Stop current animation with fade out
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeInDuration);
    }

    // Create and configure new action
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.fadeIn(fadeInDuration);
    action.play();

    this.currentAction = action;
  }

  /**
   * Stop the current animation
   * @param immediate - If true, stop immediately without fade (default: true for static poses)
   */
  stopAnimation(immediate = true) {
    if (this.currentAction) {
      console.log('[AnimationManager] Stopping animation', { immediate });
      if (immediate) {
        this.currentAction.stop();
        this.currentAction.reset();
      } else {
        this.currentAction.fadeOut(0.3);
      }
      this.currentAction = undefined;
    }
    // Stop all actions to ensure clean state
    if (this.mixer && immediate) {
      this.mixer.stopAllAction();
    }
  }

  /**
   * Update the animation mixer (call this in your render loop)
   * @param delta - Time delta in seconds
   */
  update(delta: number) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  /**
   * Check if an animation is currently playing
   */
  isPlaying(): boolean {
    return this.currentAction?.isRunning() ?? false;
  }

  /**
   * Get the current animation progress (0-1)
   */
  getProgress(): number {
    if (!this.currentAction) return 0;
    const clip = this.currentAction.getClip();
    return clip.duration > 0 ? this.currentAction.time / clip.duration : 0;
  }

  /**
   * Set the loop mode of the current animation
   */
  setLoop(loop: boolean) {
    if (this.currentAction) {
      this.currentAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    }
  }

  /**
   * Set the playback speed of the current animation
   */
  setSpeed(speed: number) {
    if (this.currentAction) {
      this.currentAction.timeScale = speed;
    }
  }

  /**
   * Get the current action (for external access if needed)
   */
  getCurrentAction(): THREE.AnimationAction | undefined {
    return this.currentAction;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    console.log('[AnimationManager] Cleaning up');
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = undefined;
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = undefined;
    }
    this.vrm = undefined;
  }
}

export const animationManager = new AnimationManager();


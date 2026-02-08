import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { VRMHumanBoneName } from '@pixiv/three-vrm';
import { collisionManager } from './collisionManager';

export class RootMotionManager {
  private vrm?: VRM;
  private hipsLocalPosStart = new THREE.Vector3();
  private hipsWorldPos = new THREE.Vector3();
  private lastRaycastTime = 0;

  setVRM(vrm: VRM) {
    this.vrm = vrm;
  }

  update(delta: number) {
    if (!this.vrm) return;

    this.updateRootMotion(delta);
  }

  public updateGrounding(_delta: number) {
    if (!this.vrm) return;
    const hips = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips);
    if (!hips) return;

    const now = performance.now();
    if (now - this.lastRaycastTime < 100) return;
    this.lastRaycastTime = now;

    hips.getWorldPosition(this.hipsWorldPos);
    const groundY = collisionManager.getGroundHeight(this.hipsWorldPos);
    if (groundY !== null) {
      this.vrm.scene.position.y = groundY;
    }
  }

  private updateRootMotion(delta: number) {
    if (!this.vrm) return;
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const hips = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Hips);
    if (!hips) return;

    // --- ROOT MOTION EXTRACTION ---
    // 1. Calculate the local movement delta of the hips
    const deltaX = hips.position.x - this.hipsLocalPosStart.x;
    const deltaZ = hips.position.z - this.hipsLocalPosStart.z;

    // 2. Apply that delta to the scene root (vrm.scene) instead of the bone
    // We rotate the delta by the avatar's current rotation so it moves in the right direction
    const worldDelta = new THREE.Vector3(deltaX, 0, deltaZ).applyQuaternion(this.vrm.scene.quaternion);
    
    // 3. Wall Collision: Check if movement is blocked
    hips.getWorldPosition(this.hipsWorldPos);
    const moveDist = worldDelta.length();
    if (moveDist > 0.0001) {
      const moveDir = worldDelta.clone().normalize();
      
      const now = performance.now();
      let wallDist: number | null = null;
      if (now - this.lastRaycastTime > 100) {
        this.lastRaycastTime = now;
        // Raycast from the hips world position in the movement direction
        wallDist = collisionManager.checkWallCollision(this.hipsWorldPos, moveDir, moveDist + 0.1);
      }
      
      if (wallDist === null || wallDist > moveDist) {
        this.vrm.scene.position.add(worldDelta);
      }
    }

    // 4. Reset hips local X/Z to stay centered on the root
    // We keep Y as-is for vertical animation (crouching/jumping)
    hips.position.x = this.hipsLocalPosStart.x;
    hips.position.z = this.hipsLocalPosStart.z;

    // 5. Handle grounding after movement
    this.updateGrounding(delta);
  }

  captureHipsPosition() {
    if (!this.vrm) return;
    const hips = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips);
    if (hips) this.hipsLocalPosStart.copy(hips.position);
  }
}

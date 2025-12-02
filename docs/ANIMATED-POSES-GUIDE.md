# Animated Poses Guide

## Overview

The Reaction Forge now supports **true animated poses** with actual movement! Instead of just smooth transitions between static poses, poses can now have continuous motion like swaying, breathing, typing, and more.

---

## 🎬 Built-in Animated Poses

### 1. **Stand Tall** - Subtle Sway
- **Movement:** Weight shift and breathing
- **Duration:** 3.2 seconds per cycle
- **Effect:** Natural idle stance with gentle sway

**Animation Details:**
- Hip sway: ±5° rotation
- Spine breathing: 3° forward/back
- 4-frame animation for smooth loop

### 2. **Typing** - Hand Motion
- **Movement:** Alternating finger/hand movements
- **Duration:** 1.2 seconds per cycle
- **Effect:** Active typing motion

**Animation Details:**
- Left/right hand alternate
- 8 frames of motion
- Simulates keyboard interaction

### 3. **Agent Taunt** - Playful Gestures
- **Movement:** Hip sway + head tilt
- **Duration:** 1.9 seconds per cycle
- **Effect:** Confident, playful taunting

**Animation Details:**
- Hip rotation: ±10°
- Head tilt: ±8°
- 16 frames for smooth motion

### 4. **All Other Poses** - Idle Breathing
- **Movement:** Subtle chest/spine breathing
- **Duration:** 3.0 seconds per cycle
- **Effect:** Natural breathing motion

**Animation Details:**
- Chest expansion: 2° range
- Spine movement: 1.5° range
- 12 frames per breath cycle

---

## 🎮 How to Use

### In the UI

1. **Select any pose** from the dropdown
2. **Set Animation Mode to "Loop"**
3. **Click "Generate reaction"**
4. **Watch the pose animate!**

### Animation Modes

- **Static Pose** - No animation, traditional static display
- **Play Once** - Plays animation once then holds
- **Loop Animation** - Continuously loops the animation ✨

---

## 🛠️ Technical Implementation

### Architecture

```
User selects pose + Loop mode
  ↓
avatarManager.applyPose(poseId, true, 'loop')
  ↓
getAnimatedPose(poseId, basePose, vrm)
  ↓
Creates multi-frame animation
  ↓
posesToAnimationClip([frame1, frame2, ...], vrm)
  ↓
AnimationMixer plays the clip
  ↓
Smooth looping animation! 🎭
```

### File Structure

**`src/poses/animatedPoses.ts`** - Animation creators
- `createStandTallAnimation()` - Sway animation
- `createTypingAnimation()` - Typing motion
- `createTauntAnimation()` - Taunt gestures
- `createIdleBreathing()` - Default breathing
- `getAnimatedPose()` - Router function

**`src/three/avatarManager.ts`** - Integration
- Calls `getAnimatedPose()` when animated mode enabled
- Falls back to simple transition if no custom animation

---

## 🎨 Creating Custom Animations

### Method 1: Add to animatedPoses.ts

```typescript
export function createMyCustomAnimation(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  const frames: VRMPose[] = [];
  const frameCount = 10;

  for (let i = 0; i < frameCount; i++) {
    const pose = JSON.parse(JSON.stringify(basePose)) as VRMPose;
    const t = i / frameCount;
    
    // Modify the pose for this frame
    if (pose.leftUpperArm?.rotation) {
      const [x, y, z, w] = pose.leftUpperArm.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      
      // Add wave motion
      const wave = new THREE.Euler(Math.sin(t * Math.PI * 2) * 0.5, 0, 0);
      quat.multiply(new THREE.Quaternion().setFromEuler(wave));
      
      pose.leftUpperArm.rotation = [quat.x, quat.y, quat.z, quat.w];
    }

    frames.push(pose);
  }

  return posesToAnimationClip(frames, vrm, 0.2, 'my-custom-animation');
}
```

### Method 2: Register in getAnimatedPose()

```typescript
export function getAnimatedPose(poseId: string, basePose: VRMPose, vrm: VRM): THREE.AnimationClip | null {
  switch (poseId) {
    case 'my-pose':
      return createMyCustomAnimation(basePose, vrm);
    // ... other cases
  }
}
```

---

## 📐 Animation Principles

### 1. **Frame Count**
- More frames = smoother animation
- Fewer frames = snappier motion
- Typical range: 8-16 frames

### 2. **Frame Duration**
- Longer duration = slower motion
- Shorter duration = faster motion
- Typical range: 0.1-0.3 seconds per frame

### 3. **Rotation Amounts**
- Subtle: 0.01-0.05 radians (0.5-3°)
- Moderate: 0.05-0.15 radians (3-8°)
- Dramatic: 0.15-0.3 radians (8-17°)

### 4. **Looping**
- First frame should match last frame
- Use sine waves for smooth cycles
- Add extra frame at end = first frame for perfect loop

---

## 🎯 Animation Techniques

### Sine Wave Motion (Smooth Cycles)

```typescript
const t = i / frameCount;
const motion = Math.sin(t * Math.PI * 2);
// motion goes: 0 → 1 → 0 → -1 → 0 (smooth loop)
```

### Alternating Motion (Back and Forth)

```typescript
const motion = (i % 2 === 0) ? 0.1 : -0.1;
// motion goes: 0.1, -0.1, 0.1, -0.1, ...
```

### Easing (Slow In/Out)

```typescript
const t = i / frameCount;
const eased = (1 - Math.cos(t * Math.PI)) / 2;
// eased goes: 0 → 0.5 → 1 (smooth acceleration/deceleration)
```

### Offset Animations (Phase Shift)

```typescript
const leftMotion = Math.sin(t * Math.PI * 2);
const rightMotion = Math.sin((t + 0.5) * Math.PI * 2);
// Right is 180° out of phase with left
```

---

## 🔧 Modifying Bone Rotations

### Safe Rotation Modification

```typescript
// 1. Get current rotation
const [x, y, z, w] = pose.boneName.rotation;

// 2. Convert to Quaternion
const quat = new THREE.Quaternion(x, y, z, w);

// 3. Create rotation change
const change = new THREE.Euler(deltaX, deltaY, deltaZ);

// 4. Apply change
quat.multiply(new THREE.Quaternion().setFromEuler(change));

// 5. Save back to pose
pose.boneName.rotation = [quat.x, quat.y, quat.z, quat.w];
```

### Common Bones to Animate

**Upper Body:**
- `hips` - Overall body position/sway
- `spine` - Breathing, leaning
- `chest` - Breathing emphasis
- `neck` - Head movement base
- `head` - Looking, tilting

**Arms:**
- `leftUpperArm` / `rightUpperArm` - Shoulder movement
- `leftLowerArm` / `rightLowerArm` - Elbow bends
- `leftHand` / `rightHand` - Hand gestures

**Legs:**
- `leftUpperLeg` / `rightUpperLeg` - Hip movement
- `leftLowerLeg` / `rightLowerLeg` - Knee bends

---

## 🎭 Animation Examples

### Example 1: Simple Breathing

```typescript
export function createBreathing(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  const frames: VRMPose[] = [];
  
  for (let i = 0; i < 12; i++) {
    const pose = JSON.parse(JSON.stringify(basePose));
    const breathAmount = Math.sin((i / 12) * Math.PI * 2) * 0.02;
    
    if (pose.chest?.rotation) {
      const [x, y, z, w] = pose.chest.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(breathAmount, 0, 0)));
      pose.chest.rotation = [quat.x, quat.y, quat.z, quat.w];
    }
    
    frames.push(pose);
  }
  
  return posesToAnimationClip(frames, vrm, 0.25, 'breathing');
}
```

### Example 2: Head Look Around

```typescript
export function createLookAround(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  const frames: VRMPose[] = [];
  const lookPositions = [0, 0.2, 0, -0.2, 0]; // Center, right, center, left, center
  
  lookPositions.forEach(yRotation => {
    const pose = JSON.parse(JSON.stringify(basePose));
    
    if (pose.head?.rotation) {
      const [x, y, z, w] = pose.head.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yRotation, 0)));
      pose.head.rotation = [quat.x, quat.y, quat.z, quat.w];
    }
    
    frames.push(pose);
  });
  
  return posesToAnimationClip(frames, vrm, 0.5, 'look-around');
}
```

### Example 3: Wave Hand

```typescript
export function createWave(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  const frames: VRMPose[] = [];
  
  for (let i = 0; i < 8; i++) {
    const pose = JSON.parse(JSON.stringify(basePose));
    const waveAmount = Math.sin((i / 8) * Math.PI * 4) * 0.3;
    
    // Raise arm
    if (pose.rightUpperArm?.rotation) {
      const [x, y, z, w] = pose.rightUpperArm.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.5, 0, 0)));
      pose.rightUpperArm.rotation = [quat.x, quat.y, quat.z, quat.w];
    }
    
    // Wave hand
    if (pose.rightLowerArm?.rotation) {
      const [x, y, z, w] = pose.rightLowerArm.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, waveAmount)));
      pose.rightLowerArm.rotation = [quat.x, quat.y, quat.z, quat.w];
    }
    
    frames.push(pose);
  }
  
  return posesToAnimationClip(frames, vrm, 0.15, 'wave');
}
```

---

## 🐛 Troubleshooting

### Animation Not Visible

**Check:**
1. Animation Mode is set to "Loop" or "Play Once"
2. Browser console shows "Using custom animated pose"
3. Bone names in your animation match VRM bones

**Debug:**
```typescript
console.log('Animating bone:', boneName);
console.log('Original rotation:', pose.boneName.rotation);
console.log('Modified rotation:', [quat.x, quat.y, quat.z, quat.w]);
```

### Animation Too Fast/Slow

**Adjust frame duration:**
```typescript
// Slower
posesToAnimationClip(frames, vrm, 0.5, name); // 0.5s per frame

// Faster
posesToAnimationClip(frames, vrm, 0.1, name); // 0.1s per frame
```

### Animation Too Subtle/Dramatic

**Adjust rotation amounts:**
```typescript
// More subtle
const motion = Math.sin(t * Math.PI * 2) * 0.01; // 0.5° range

// More dramatic
const motion = Math.sin(t * Math.PI * 2) * 0.3; // 17° range
```

### Animation Not Looping Smoothly

**Ensure first frame = last frame:**
```typescript
const frames = [pose1, pose2, pose3, pose1]; // Add first frame at end
```

---

## 📊 Performance

### Frame Count Impact

- **8 frames:** ~50KB animation data, very smooth
- **16 frames:** ~100KB animation data, ultra smooth
- **32 frames:** ~200KB animation data, may be overkill

### Optimization Tips

1. **Use fewer frames** for simple motions
2. **Reuse animations** across similar poses
3. **Cache animation clips** instead of recreating
4. **Limit bone count** - only animate necessary bones

---

## 🚀 Future Enhancements

### Planned Features

- [ ] **Animation blending** - Smooth transitions between animations
- [ ] **Additive animations** - Layer animations (breathing + waving)
- [ ] **Animation speed control** - User-adjustable playback speed
- [ ] **Custom animation editor** - Visual tool for creating animations
- [ ] **Animation library** - Pre-made animation templates
- [ ] **Procedural animations** - Physics-based motion

---

## 📚 Resources

### THREE.js Animation Docs
- [AnimationClip](https://threejs.org/docs/#api/en/animation/AnimationClip)
- [AnimationMixer](https://threejs.org/docs/#api/en/animation/AnimationMixer)
- [Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)

### VRM Specification
- [VRM Humanoid Bones](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/humanoid.md)
- [VRM Animation](https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm-animation/README.md)

---

**Now your poses come alive with real animation!** 🎭✨

Try selecting "Stand Tall" with "Loop Animation" to see the subtle sway in action!


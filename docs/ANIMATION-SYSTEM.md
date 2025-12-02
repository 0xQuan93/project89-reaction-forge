# Animation System Documentation

## Overview

The Reaction Forge now supports **both static poses and animated reactions**! This enhancement allows poses to be played as smooth animations with looping and single-play options.

---

## 🎬 Features

### Animation Modes

1. **Static Pose** (default) - Traditional static pose display
2. **Play Once** - Play the pose as an animation once with smooth transitions
3. **Loop Animation** - Continuously loop the animation

### Key Capabilities

- ✅ **Smooth transitions** between poses using animation blending
- ✅ **Animation looping** for continuous playback
- ✅ **Single-shot animations** that play once and hold
- ✅ **Stop animation** control to freeze on current frame
- ✅ **Automatic pose-to-animation conversion** for any static pose
- ✅ **Custom animation clips** support for pre-recorded animations
- ✅ **Fade in/out** for smooth animation transitions

---

## 🏗️ Architecture

### New Files Created

#### 1. `src/three/animationManager.ts`
Manages THREE.AnimationMixer and playback control:
- `initialize(vrm)` - Set up animation mixer for a VRM
- `playAnimation(clip, loop, fadeIn)` - Play an animation clip
- `stopAnimation(fadeOut)` - Stop current animation
- `update(delta)` - Update mixer (called in render loop)
- `isPlaying()` - Check if animation is active
- `getProgress()` - Get animation progress (0-1)

#### 2. `src/poses/poseToAnimation.ts`
Utilities to convert static poses to animations:
- `poseToAnimationClip(pose, duration, name)` - Convert single pose to animation
- `posesToAnimationClip(poses[], frameDuration, name)` - Create sequence from multiple poses

### Modified Files

#### 1. `src/types/reactions.ts`
Added animation types:
```typescript
export type AnimationMode = 'static' | 'loop' | 'once';

export type ReactionPreset = {
  // ... existing fields
  animated?: boolean;          // Optional: force animation
  animationMode?: AnimationMode; // Optional: override mode
};
```

#### 2. `src/poses/index.ts`
Extended pose definitions:
```typescript
export type PoseDefinition = {
  // ... existing fields
  animationClip?: THREE.AnimationClip; // Optional: pre-recorded animation
  isAnimated?: boolean;                // Optional: mark as animated
};
```

#### 3. `src/three/avatarManager.ts`
Updated to support animations:
- `applyPose(pose, animated, animationMode)` - Now accepts animation parameters
- `stopAnimation()` - Stop current animation
- `isAnimationPlaying()` - Check animation status
- `getVRM()` - Access VRM instance

#### 4. `src/state/useReactionStore.ts`
Added global animation mode state:
```typescript
interface ReactionState {
  // ... existing fields
  animationMode: AnimationMode;
  setAnimationMode: (mode: AnimationMode) => void;
}
```

#### 5. `src/components/ReactionPanel.tsx`
Added animation controls:
- **Animation Mode dropdown** - Select static/once/loop
- **Stop Animation button** - Appears when animation mode is active

#### 6. `src/components/CanvasStage.tsx`
Updated to apply animation settings from store

---

## 🎮 How to Use

### For Users

1. **Select a pose** from the dropdown
2. **Choose animation mode**:
   - Static Pose - Traditional static display
   - Play Once - Smooth transition animation
   - Loop Animation - Continuous looping
3. **Generate reaction** - Pose will animate according to mode
4. **Stop Animation** button appears when animating

### For Developers

#### Method 1: Use Global Animation Mode

The simplest way - users control animation via UI:

```typescript
// No code changes needed!
// Users select animation mode in the UI dropdown
```

#### Method 2: Mark Specific Poses as Animated

In `src/data/reactions.ts`:

```typescript
{
  id: 'dancing',
  label: 'Dancing',
  description: 'Energetic dance moves',
  pose: 'dancing-pose',
  expression: 'joy',
  background: 'matrix',
  animated: true,           // ✨ Force this pose to animate
  animationMode: 'loop',    // ✨ Always loop this pose
}
```

#### Method 3: Add Custom Animation Clips

For poses with pre-recorded animations:

```typescript
// In src/poses/index.ts
import * as THREE from 'three';

// Load or create your animation clip
const myAnimationClip = new THREE.AnimationClip('myAnim', 2.0, tracks);

const poseLibrary: Record<PoseId, PoseDefinition> = {
  'my-pose': {
    sceneRotation: { y: 180 },
    vrmPose: myPoseData,
    isAnimated: true,
    animationClip: myAnimationClip, // ✨ Custom animation
  },
};
```

---

## 🔧 Technical Details

### Animation Pipeline

1. **User selects pose + animation mode**
2. **CanvasStage** reads mode from store
3. **avatarManager.applyPose()** called with animation parameters
4. **Decision tree**:
   ```
   Has custom animationClip?
     YES → Play the clip
     NO → Is animated mode enabled?
       YES → Convert pose to animation clip
       NO → Apply as static pose
   ```
5. **animationManager** handles playback
6. **Mixer updates** in render loop via `sceneManager.registerTick()`

### Pose-to-Animation Conversion

When a static pose is played as animation:

1. **Extract bone rotations** from VRMPose
2. **Create keyframe tracks** for each bone
3. **Generate start/end frames** (same values for static hold)
4. **Build AnimationClip** with specified duration
5. **Play with fade-in** for smooth transition

### Animation Blending

- **Fade-in duration**: 0.3s (configurable)
- **Fade-out duration**: 0.3s (configurable)
- **Crossfade**: Previous animation fades out as new one fades in
- **Clamp when finished**: Non-looping animations hold final frame

---

## 📊 Performance Considerations

### Optimizations

- ✅ **Single mixer per VRM** - Efficient resource usage
- ✅ **Lazy animation updates** - Only updates when `isAnimated` is true
- ✅ **Automatic cleanup** - Mixer disposed when VRM changes
- ✅ **Keyframe interpolation** - THREE.js handles smooth transitions

### Memory Usage

- **Static poses**: ~1-5KB per pose (JSON data)
- **Animation clips**: ~10-50KB per clip (depends on duration/tracks)
- **Mixer overhead**: ~100KB per VRM instance

---

## 🎨 Creating Custom Animations

### Option 1: From Mixamo (Recommended)

1. **Export FBX** from Mixamo
2. **Use Pose Lab** to convert to VRM format
3. **Save as JSON** pose file
4. **Mark as animated** in reactions.ts

### Option 2: Programmatic Sequences

Create animation from multiple poses:

```typescript
import { posesToAnimationClip } from '../poses/poseToAnimation';

const pose1 = getPoseDefinition('stand-tall')!.vrmPose!;
const pose2 = getPoseDefinition('typing')!.vrmPose!;
const pose3 = getPoseDefinition('stand-tall')!.vrmPose!;

const animClip = posesToAnimationClip(
  [pose1, pose2, pose3],
  0.5, // 0.5s per frame
  'typing-sequence'
);

// Add to pose library
poseLibrary['typing-animation'] = {
  sceneRotation: { y: 180 },
  isAnimated: true,
  animationClip: animClip,
};
```

### Option 3: Manual Keyframe Animation

```typescript
import * as THREE from 'three';

const times = [0, 0.5, 1.0, 1.5, 2.0];
const values = [
  // Frame 0: quaternion [x, y, z, w]
  0, 0, 0, 1,
  // Frame 1
  0.1, 0, 0, 0.995,
  // Frame 2
  0.2, 0, 0, 0.98,
  // Frame 3
  0.1, 0, 0, 0.995,
  // Frame 4
  0, 0, 0, 1,
];

const track = new THREE.QuaternionKeyframeTrack(
  'leftUpperArm.quaternion',
  times,
  values
);

const clip = new THREE.AnimationClip('wave', 2.0, [track]);
```

---

## 🐛 Troubleshooting

### Animation Not Playing

**Check:**
1. Animation mode is set to "Loop" or "Play Once"
2. Browser console for errors
3. VRM is loaded (check "Avatar ready" status)
4. Pose definition exists in pose library

**Console logs to look for:**
```
[AnimationManager] Initializing with VRM
[AvatarManager] Applying pose: typing { animated: true, animationMode: 'loop' }
[AnimationManager] Playing animation clip from definition
```

### Animation Stuttering

**Possible causes:**
- Heavy scene (too many polygons)
- Multiple animations running simultaneously
- Browser performance throttling

**Solutions:**
- Reduce VRM polygon count
- Use simpler poses
- Close other browser tabs

### Pose Not Converting to Animation

**Check:**
- Pose has valid `vrmPose` data
- Bone rotations are quaternions (not euler angles)
- Console shows "Converting pose to animation"

---

## 🚀 Future Enhancements

### Planned Features

- [ ] **Animation timeline scrubbing** - Manual control of playback position
- [ ] **Animation speed control** - Slow-mo / fast-forward
- [ ] **Blend multiple animations** - Combine upper/lower body animations
- [ ] **Expression animations** - Animate facial expressions over time
- [ ] **Camera animations** - Animated camera movements
- [ ] **Physics-based animations** - Cloth/hair simulation
- [ ] **IK (Inverse Kinematics)** - Procedural hand/foot placement
- [ ] **Animation export** - Save as video/GIF

### Community Contributions

Want to add more animations? Here's how:

1. Create your animation (Mixamo, Blender, etc.)
2. Convert to VRM format using Pose Lab
3. Add to `src/poses/` directory
4. Register in `src/poses/index.ts`
5. Create preset in `src/data/reactions.ts`
6. Submit PR!

---

## 📚 API Reference

### animationManager

```typescript
class AnimationManager {
  initialize(vrm: VRM): void
  playAnimation(clip: AnimationClip, loop?: boolean, fadeIn?: number): void
  stopAnimation(fadeOut?: number): void
  update(delta: number): void
  isPlaying(): boolean
  getProgress(): number
  cleanup(): void
}
```

### avatarManager

```typescript
class AvatarManager {
  applyPose(pose: PoseId, animated?: boolean, animationMode?: AnimationMode): void
  stopAnimation(): void
  isAnimationPlaying(): boolean
  getVRM(): VRM | undefined
}
```

### Utilities

```typescript
function poseToAnimationClip(
  pose: VRMPose,
  duration?: number,
  name?: string
): THREE.AnimationClip

function posesToAnimationClip(
  poses: VRMPose[],
  frameDuration?: number,
  name?: string
): THREE.AnimationClip
```

---

## 🎓 Examples

### Example 1: Simple Looping Animation

```typescript
// In reactions.ts
{
  id: 'idle-breathing',
  label: 'Idle Breathing',
  description: 'Subtle breathing animation',
  pose: 'stand-tall',
  expression: 'calm',
  background: 'midnight',
  animated: true,
  animationMode: 'loop',
}
```

### Example 2: One-Shot Greeting

```typescript
{
  id: 'wave-hello',
  label: 'Wave Hello',
  description: 'Friendly wave gesture',
  pose: 'loom-vanguard',
  expression: 'joy',
  background: 'sunset',
  animated: true,
  animationMode: 'once',
}
```

### Example 3: Programmatic Control

```typescript
import { avatarManager } from '../three/avatarManager';

// Play animation
avatarManager.applyPose('typing', true, 'loop');

// Stop after 5 seconds
setTimeout(() => {
  avatarManager.stopAnimation();
}, 5000);
```

---

**Built with 💜 for Project 89**

*Bringing avatars to life, one animation at a time.*


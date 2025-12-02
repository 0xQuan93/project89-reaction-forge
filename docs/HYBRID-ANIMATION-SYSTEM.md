# Hybrid Animation System

## Overview

The Reaction Forge now supports a **hybrid animation system** that combines:
1. **FBX Animation Data** - Real Mixamo animations from FBX files
2. **Procedural Animations** - Code-generated animations for custom effects

This gives you the best of both worlds: professional Mixamo animations where available, and custom procedural animations as fallback.

---

## 🎬 How It Works

### Animation Priority

When you select "Loop Animation" or "Play Once", the system checks in this order:

1. **FBX Animation File** (`pose-animation.json`)
   - If exists: Uses real Mixamo animation data
   - Professional quality, complex motion
   
2. **Procedural Animation** (`animatedPoses.ts`)
   - If FBX not available: Generates animation in code
   - Custom effects like breathing, swaying

3. **Simple Transition** (fallback)
   - If neither available: Smooth transition to pose
   - Basic fade-in effect

---

## 📁 File Structure

### For Each Pose

```
src/poses/
├── agent-taunt.json              # Static pose data (required)
├── agent-taunt-animation.json    # FBX animation data (optional)
└── animatedPoses.ts              # Procedural animations (optional)
```

### Animation File Format

**`agent-taunt-animation.json`:**
```json
{
  "name": "agent-taunt",
  "duration": 2.5,
  "tracks": [
    {
      "name": "Armature/Hips.quaternion",
      "type": "quaternion",
      "times": [0, 0.5, 1.0, 1.5, 2.0, 2.5],
      "values": [0, 0, 0, 1, ...]
    },
    // ... more tracks
  ]
}
```

---

## 🛠️ Creating FBX Animations

### Step 1: Get Mixamo Animation

1. Go to [Mixamo.com](https://www.mixamo.com/)
2. Select a character
3. Choose an animation (e.g., "Taunt")
4. Download as **FBX** (not BVH)
5. Save to `src/poses/fbx/Taunt.fbx`

### Step 2: Export via Pose Lab

#### Method A: Manual Export

1. **Open Pose Lab:** http://localhost:5173/?mode=pose-lab
2. **Upload your VRM avatar**
3. **Drag & drop the FBX file** (e.g., `Taunt.fbx`)
4. **Click "Export Pose"**
5. **Two files download:**
   - `pose.json` - Static pose data
   - `pose-animation.json` - Animation clip data

#### Method B: Batch Export (Automatic)

1. **Add to batch config** in `src/pose-lab/PoseLab.tsx`:

```typescript
const batchConfigs: BatchPoseConfig[] = [
  // ... existing configs
  {
    id: 'agent-taunt',
    label: 'Agent Taunt',
    source: new URL('../poses/fbx/Taunt.fbx', import.meta.url).href,
    fileName: 'Taunt.fbx',
    sceneRotation: { y: 180 }
  },
];
```

2. **Open Pose Lab**
3. **Upload VRM**
4. **Click "Batch Export"**
5. **All poses + animations export automatically**

### Step 3: Place Files

1. **Rename files:**
   - `pose.json` → `agent-taunt.json`
   - `pose-animation.json` → `agent-taunt-animation.json`

2. **Move to** `src/poses/`

3. **System automatically detects** animation file

---

## 🎨 Creating Procedural Animations

If you want custom animation effects (not from Mixamo), add to `src/poses/animatedPoses.ts`:

```typescript
export function createMyCustomAnimation(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  const frames: VRMPose[] = [];
  
  for (let i = 0; i < 10; i++) {
    const pose = JSON.parse(JSON.stringify(basePose));
    const t = i / 10;
    
    // Modify bones for this frame
    if (pose.leftUpperArm?.rotation) {
      const [x, y, z, w] = pose.leftUpperArm.rotation;
      const quat = new THREE.Quaternion(x, y, z, w);
      const wave = new THREE.Euler(Math.sin(t * Math.PI * 2) * 0.5, 0, 0);
      quat.multiply(new THREE.Quaternion().setFromEuler(wave));
      pose.leftUpperArm.rotation = [quat.x, quat.y, quat.z, quat.w];
    }
    
    frames.push(pose);
  }
  
  return posesToAnimationClip(frames, vrm, 0.2, 'my-custom');
}

// Register in getAnimatedPose()
export function getAnimatedPose(poseId: string, basePose: VRMPose, vrm: VRM): THREE.AnimationClip | null {
  switch (poseId) {
    case 'my-pose':
      return createMyCustomAnimation(basePose, vrm);
    // ... other cases
  }
}
```

---

## 🔄 Animation Selection Logic

```typescript
async function selectAnimation(poseId: string) {
  // 1. Try to load FBX animation file
  const fbxAnimation = await loadAnimationClip(poseId);
  if (fbxAnimation) {
    console.log('Using FBX animation');
    return fbxAnimation;
  }
  
  // 2. Try procedural animation
  const proceduralAnimation = getAnimatedPose(poseId, basePose, vrm);
  if (proceduralAnimation) {
    console.log('Using procedural animation');
    return proceduralAnimation;
  }
  
  // 3. Fallback to simple transition
  console.log('Using simple transition');
  return poseToAnimationClip(basePose, vrm, 0.5, poseId);
}
```

---

## 📊 Current Pose Status

| Pose | FBX Animation | Procedural | Status |
|------|---------------|------------|--------|
| Dawn Runner | ❌ | ✅ Breathing | Procedural |
| Green Loom | ❌ | ✅ Breathing | Procedural |
| Sunset Call | ❌ | ✅ Breathing | Procedural |
| Cipher Whisper | ❌ | ✅ Breathing | Procedural |
| Nebula Drift | ❌ | ✅ Breathing | Procedural |
| Loom Vanguard | ❌ | ✅ Breathing | Procedural |
| Signal Reverie | ❌ | ✅ Breathing | Procedural |
| Protocol Enforcer | ❌ | ✅ Breathing | Procedural |
| Stand Tall | ❌ | ✅ Sway | Procedural |
| Typing | ❌ | ✅ Hand Motion | Procedural |
| Agent Taunt | ⚠️ Ready | ✅ Gestures | **Ready for FBX!** |

---

## 🎯 Adding FBX Animation to Agent Taunt

### Quick Start

1. **Get Taunt.fbx** from Mixamo
2. **Open Pose Lab:** http://localhost:5173/?mode=pose-lab
3. **Upload HarmonVox VRM**
4. **Drop Taunt.fbx**
5. **Click "Export Pose"**
6. **Rename downloads:**
   - `pose.json` → `agent-taunt.json` (replace existing)
   - `pose-animation.json` → `agent-taunt-animation.json` (new)
7. **Move both to** `src/poses/`
8. **Refresh browser**
9. **Select "Agent Taunt" + "Loop Animation"**
10. **Watch real Mixamo animation!** 🎭

---

## 🔧 Technical Details

### Animation Clip Serialization

**Why:** THREE.AnimationClip objects can't be stored in JSON directly

**Solution:** Custom serializer/deserializer

```typescript
// Serialize for storage
const serialized = serializeAnimationClip(animationClip);
// Save to JSON file

// Deserialize for use
const clip = deserializeAnimationClip(serialized);
// Use in AnimationMixer
```

### Async Pose Loading

**Why:** Animation files are loaded dynamically

**Solution:** Async `getPoseDefinitionWithAnimation()`

```typescript
// Synchronous (no animation)
const pose = getPoseDefinition('agent-taunt');

// Asynchronous (with animation)
const poseWithAnim = await getPoseDefinitionWithAnimation('agent-taunt');
```

### Caching

Animation clips are cached after first load:
- **First load:** Reads JSON file, deserializes
- **Subsequent loads:** Returns cached clip
- **Performance:** ~50ms first load, <1ms cached

---

## 📈 Performance Comparison

### FBX Animation
- **File Size:** 50-200KB per animation
- **Load Time:** 50-100ms (first load)
- **Quality:** Professional Mixamo quality
- **Complexity:** Full body motion, realistic

### Procedural Animation
- **File Size:** 0KB (code only)
- **Load Time:** <1ms (generated on-demand)
- **Quality:** Simple, customizable
- **Complexity:** Basic motions (breathing, swaying)

### Simple Transition
- **File Size:** 0KB
- **Load Time:** <1ms
- **Quality:** Smooth fade
- **Complexity:** Static pose hold

---

## 🎭 Use Cases

### Use FBX When:
- ✅ Complex full-body animations
- ✅ Professional quality needed
- ✅ Mixamo has perfect animation
- ✅ Realistic motion required

**Examples:** Dancing, taunting, waving, jumping

### Use Procedural When:
- ✅ Simple subtle motion
- ✅ Custom effects
- ✅ Small file size important
- ✅ Quick iteration needed

**Examples:** Breathing, swaying, blinking, head tilts

### Use Simple Transition When:
- ✅ Static pose is fine
- ✅ No animation needed
- ✅ Fastest loading

**Examples:** Portrait poses, screenshots

---

## 🐛 Troubleshooting

### Animation Not Playing

**Check:**
1. Animation file exists: `agent-taunt-animation.json`
2. File is valid JSON
3. Console shows: "Using FBX animation"
4. Animation Mode is "Loop" or "Play Once"

**Debug:**
```typescript
// In browser console
const clip = await loadAnimationClip('agent-taunt');
console.log(clip); // Should show AnimationClip object
```

### Animation Looks Wrong

**Possible causes:**
1. **Wrong rig:** FBX must be for humanoid rig
2. **Scale issues:** Check Mixamo export settings
3. **Bone mapping:** VRM bones might not match

**Solution:**
- Re-export from Mixamo
- Use "Without Skin" option
- Check bone names in animation file

### File Size Too Large

**If animation JSON > 500KB:**
1. Reduce keyframes in Mixamo
2. Use lower sample rate
3. Consider procedural animation instead

---

## 🚀 Future Enhancements

### Planned Features

- [ ] **Animation blending** - Smooth transitions between animations
- [ ] **Partial animations** - Upper body + lower body separate
- [ ] **Animation speed control** - User-adjustable playback speed
- [ ] **Animation library** - Pre-exported Mixamo animations
- [ ] **Compression** - Smaller animation files
- [ ] **Streaming** - Load animations on-demand from CDN

---

## 📚 API Reference

### Serialization

```typescript
// Serialize
function serializeAnimationClip(clip: THREE.AnimationClip): SerializedAnimationClip

// Deserialize
function deserializeAnimationClip(data: SerializedAnimationClip): THREE.AnimationClip

// Validate
function isValidAnimationData(data: any): data is SerializedAnimationClip
```

### Loading

```typescript
// Load single animation
async function loadAnimationClip(poseId: string): Promise<THREE.AnimationClip | null>

// Preload multiple
async function preloadAnimationClips(poseIds: string[]): Promise<Map<string, THREE.AnimationClip>>

// Get pose with animation
async function getPoseDefinitionWithAnimation(id: PoseId): Promise<PoseDefinition | undefined>
```

### Procedural

```typescript
// Create custom animation
function createCustomAnimation(basePose: VRMPose, vrm: VRM): THREE.AnimationClip

// Get animated pose
function getAnimatedPose(poseId: string, basePose: VRMPose, vrm: VRM): THREE.AnimationClip | null
```

---

## 📖 Examples

### Example 1: Export Taunt Animation

```bash
# 1. Download Taunt.fbx from Mixamo
# 2. Open Pose Lab
# 3. Upload VRM
# 4. Drop Taunt.fbx
# 5. Click Export
# 6. Rename files:
mv pose.json src/poses/agent-taunt.json
mv pose-animation.json src/poses/agent-taunt-animation.json
# 7. Refresh browser
# 8. Select "Agent Taunt" + "Loop Animation"
# 9. Enjoy!
```

### Example 2: Create Procedural Wave

```typescript
// In animatedPoses.ts
export function createWaveAnimation(basePose: VRMPose, vrm: VRM): THREE.AnimationClip {
  const frames: VRMPose[] = [];
  
  for (let i = 0; i < 8; i++) {
    const pose = JSON.parse(JSON.stringify(basePose));
    const t = i / 8;
    
    // Raise arm
    if (pose.rightUpperArm?.rotation) {
      const quat = new THREE.Quaternion(...pose.rightUpperArm.rotation);
      quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.5, 0, 0)));
      pose.rightUpperArm.rotation = [quat.x, quat.y, quat.z, quat.w];
    }
    
    // Wave hand
    if (pose.rightLowerArm?.rotation) {
      const quat = new THREE.Quaternion(...pose.rightLowerArm.rotation);
      const wave = Math.sin(t * Math.PI * 4) * 0.3;
      quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, wave)));
      pose.rightLowerArm.rotation = [quat.x, quat.y, quat.z, quat.w];
    }
    
    frames.push(pose);
  }
  
  return posesToAnimationClip(frames, vrm, 0.15, 'wave');
}
```

---

## ✅ Summary

**The Hybrid System:**
- ✅ FBX animations for professional quality
- ✅ Procedural animations for custom effects
- ✅ Automatic fallback system
- ✅ Easy to add new animations
- ✅ Flexible and extensible

**Next Steps:**
1. Export Taunt.fbx animation
2. Test with Agent Taunt pose
3. Add more FBX animations as needed
4. Enjoy professional-quality animations! 🎭✨

---

**Built with 💜 for Project 89**

*The best of both worlds: Mixamo's professional animations + custom procedural effects!*


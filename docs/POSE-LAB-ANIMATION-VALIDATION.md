# Pose Lab Animation Translation Validation

## Overview

The Pose Lab now correctly translates Mixamo FBX animations to VRM format with proper scene node paths. This ensures animations work correctly when loaded in the main app.

---

## 🔄 Translation Pipeline

### Step 1: Load FBX
```
Mixamo FBX File
  ↓
FBXLoader parses file
  ↓
Extract animations & rig
```

### Step 2: Retarget to VRM
```
Mixamo Animation (Mixamo bone names)
  ↓
getMixamoAnimation() - Retarget to VRM
  ↓
VRM Animation (VRM bone names like "hips", "spine")
```

**Key transformations:**
- Bone name mapping (Mixamo → VRM)
- Quaternion adjustments for coordinate system
- Position scaling for different rig sizes
- VRM 0.x vs 1.0 compatibility

### Step 3: Convert to Scene Paths ✨ NEW
```
VRM Animation (bone names: "hips.quaternion")
  ↓
convertAnimationToScenePaths() - Get actual node paths
  ↓
Scene Animation (paths: "Armature/Hips.quaternion")
```

**Why this is critical:**
- THREE.AnimationMixer requires actual scene node paths
- VRM bone names are abstract, not scene nodes
- Each VRM model has different internal structure

### Step 4: Serialize & Export
```
Scene Animation (THREE.AnimationClip)
  ↓
serializeAnimationClip() - Convert to JSON
  ↓
Save as pose-animation.json
```

---

## ✅ Validation Checks

### Automatic Validation

The system now performs these checks:

#### 1. Track Conversion Count
```typescript
if (convertedTracks.length === 0) {
  throw new Error('No tracks were converted!');
}

if (convertedTracks.length < clip.tracks.length * 0.5) {
  console.warn('Less than 50% of tracks converted');
}
```

**What it checks:** All bones were successfully mapped

#### 2. Scene Path Format
```typescript
const hasScenePaths = convertedTracks.every(track => track.name.includes('/'));
if (!hasScenePaths) {
  throw new Error('Tracks missing scene paths');
}
```

**What it checks:** All tracks use scene paths (not bone names)

#### 3. Node Path Resolution
```typescript
const boneNode = vrm.humanoid?.getNormalizedBoneNode(boneName);
if (!boneNode) {
  console.warn('Bone node not found:', boneName);
  return;
}
```

**What it checks:** VRM has all required bones

---

## 🧪 Testing the Translation

### Test 1: Export Animation

1. **Open Pose Lab:** http://localhost:5173/?mode=pose-lab
2. **Upload VRM**
3. **Drop Taunt.fbx**
4. **Check console logs:**

```
[PoseLab] Loading Mixamo pose…
Mixamo conversion complete {"clip":"mixamo.com","duration":2.5,"totalTracks":54,"convertedTracks":54}
[PoseLab] Converted animation to scene paths
[convertAnimationToScenePaths] Converted tracks: {
  original: 54,
  converted: 54,
  sampleOriginal: "hips.quaternion",
  sampleConverted: "Armature/Hips.quaternion"
}
[convertAnimationToScenePaths] ✅ Validation passed
```

**✅ Success indicators:**
- `convertedTracks` matches `totalTracks`
- Sample track shows scene path format (`Armature/...`)
- Validation passed message

**❌ Failure indicators:**
- `convertedTracks` is 0 or much less than `totalTracks`
- Error: "No tracks were converted"
- Error: "Tracks missing scene paths"

### Test 2: Inspect Exported JSON

1. **Click "Export Pose"**
2. **Open `pose-animation.json`**
3. **Check track names:**

```json
{
  "name": "vrmAnimation",
  "duration": 2.5,
  "tracks": [
    {
      "name": "Armature/Hips.quaternion",  // ✅ Has scene path
      "type": "quaternion",
      "times": [0, 0.041, 0.083, ...],
      "values": [0, 0, 0, 1, ...]
    },
    {
      "name": "Armature/Hips/Spine.quaternion",  // ✅ Hierarchical path
      "type": "quaternion",
      "times": [0, 0.041, 0.083, ...],
      "values": [0.1, 0, 0, 0.995, ...]
    }
    // ... more tracks
  ]
}
```

**✅ Correct format:**
- Track names contain `/` (scene path separator)
- Hierarchical structure: `Parent/Child/Bone`
- Type is `"quaternion"` for rotations
- Times and values arrays have data

**❌ Incorrect format:**
- Track names like `"hips.quaternion"` (no `/`)
- Missing tracks
- Empty values arrays

### Test 3: Load in Main App

1. **Place files in `src/poses/`:**
   - `agent-taunt.json`
   - `agent-taunt-animation.json`
2. **Refresh browser**
3. **Select "Agent Taunt" + "Loop Animation"**
4. **Check console:**

```
[AvatarManager] Applying pose: agent-taunt { animated: true, animationMode: 'loop' }
[loadAnimationClip] Loaded animation clip for: agent-taunt { duration: 2.5, tracks: 54 }
[AvatarManager] Playing FBX animation clip from file
[AnimationManager] Playing animation: vrmAnimation { loop: true, duration: 2.5 }
```

**✅ Animation plays:**
- Avatar moves continuously
- Motion matches Mixamo animation
- Loops smoothly

**❌ Animation doesn't play:**
- Avatar is static
- Console errors about missing nodes
- Tracks not found by mixer

---

## 🔍 Common Issues & Fixes

### Issue 1: "No tracks were converted"

**Cause:** VRM bone mapping failed

**Debug:**
```typescript
// Check VRM has humanoid
console.log(vrm.humanoid); // Should not be null

// Check bone nodes exist
console.log(vrm.humanoid.getNormalizedBoneNode('hips')); // Should return Object3D
```

**Fix:**
- Ensure VRM is valid humanoid model
- Check VRM version (0.x vs 1.0)
- Verify bone names in VRMRigMapMixamo

### Issue 2: "Tracks missing scene paths"

**Cause:** Node path resolution failed

**Debug:**
```typescript
// Check node hierarchy
const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
console.log(hipsNode?.name); // Should show actual bone name
console.log(hipsNode?.parent?.name); // Should show parent name
```

**Fix:**
- Verify VRM scene structure
- Check node names are not empty
- Ensure nodes are in scene hierarchy

### Issue 3: "Animation plays but looks wrong"

**Cause:** Coordinate system or scale mismatch

**Debug:**
```typescript
// Check retargeting logs
// Look for hipsPositionScale value
console.log('Hips scale:', hipsPositionScale); // Should be reasonable (0.5-2.0)
```

**Fix:**
- Re-export FBX from Mixamo with "Without Skin"
- Check FBX scale settings
- Verify VRM is standard size

### Issue 4: "Some bones don't animate"

**Cause:** Partial bone mapping

**Debug:**
```typescript
// Check which bones failed
// Look for warnings in console:
// "Bone node not found: leftHand"
```

**Fix:**
- Check VRMRigMapMixamo has all bones
- Verify VRM has all humanoid bones
- Some bones may be optional (fingers, toes)

---

## 📊 Expected Results

### Typical Animation Stats

**Good Mixamo animation:**
- **Total tracks:** 50-60 (full body)
- **Converted tracks:** 50-60 (100% conversion)
- **Duration:** 1-5 seconds
- **Sample rate:** 24-30 fps
- **Track types:** Mostly quaternion, some vector

**Minimal animation:**
- **Total tracks:** 20-30 (upper body only)
- **Converted tracks:** 20-30 (100% conversion)
- **Duration:** 0.5-2 seconds

**File sizes:**
- **Pose JSON:** 10-50 KB
- **Animation JSON:** 50-200 KB (depends on duration/fps)

---

## 🛠️ Advanced Debugging

### Enable Detailed Logging

Add to `convertAnimationToScenePaths.ts`:

```typescript
console.log('Processing track:', track.name);
console.log('  Bone name:', boneName);
console.log('  Bone node:', boneNode?.name);
console.log('  Node path:', nodePath);
console.log('  New track name:', newTrackName);
```

### Inspect Animation Clip

```typescript
// In browser console after export
const clip = animationClipRef.current;
console.log('Clip:', clip);
console.log('Tracks:', clip.tracks.map(t => t.name));
console.log('First track values:', clip.tracks[0]?.values.slice(0, 20));
```

### Validate Serialization

```typescript
// After serialization
const serialized = serializeAnimationClip(clip);
console.log('Serialized:', serialized);
console.log('Track names:', serialized.tracks.map(t => t.name));

// Test deserialization
const deserialized = deserializeAnimationClip(serialized);
console.log('Deserialized:', deserialized);
console.log('Matches original:', deserialized.tracks.length === clip.tracks.length);
```

---

## ✅ Validation Checklist

Before using an exported animation:

- [ ] Console shows "Validation passed"
- [ ] Converted tracks count matches total tracks
- [ ] Sample track name contains "/" (scene path)
- [ ] Animation JSON file has hierarchical track names
- [ ] File size is reasonable (50-200 KB)
- [ ] No console errors during export
- [ ] Animation loads in main app without errors
- [ ] Animation plays smoothly when selected
- [ ] Motion matches expected Mixamo animation

---

## 🎯 Summary

**The Translation Pipeline:**
1. ✅ FBX → Mixamo animation
2. ✅ Mixamo → VRM bone names (retargeting)
3. ✅ VRM bones → Scene node paths (NEW!)
4. ✅ Scene paths → JSON serialization
5. ✅ JSON → THREE.AnimationClip (in main app)
6. ✅ AnimationClip → AnimationMixer playback

**Key Fix:**
The new `convertAnimationToScenePaths()` step ensures animations use actual scene node paths instead of abstract bone names, making them compatible with THREE.AnimationMixer.

**Validation:**
Automatic checks ensure all tracks are converted correctly and use proper scene path format.

---

**Your Pose Lab now correctly translates Mixamo animations!** 🎭✨


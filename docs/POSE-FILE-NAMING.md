# Pose File Naming Guide

## 📁 Understanding the Two Files

When you export from Pose Lab, you get **TWO files**. Here's what each one does:

---

## File 1: Static Pose (REQUIRED)

### Downloaded as: `pose.json`
### Rename to: `{pose-id}.json`

**Example:** `agent-taunt.json`

**Contains:**
```json
{
  "sceneRotation": { "y": 180 },
  "vrmPose": {
    "hips": { "rotation": [0.07, -0.39, 0.03, 0.91] },
    "spine": { "rotation": [...] },
    // ... all bones (first frame only)
  }
}
```

**Used for:**
- ✅ Static pose display (Animation Mode: "Static Pose")
- ✅ Base for procedural animations
- ✅ Thumbnail/preview
- ✅ Always loaded

**File size:** 10-50 KB

---

## File 2: Animation Data (OPTIONAL)

### Downloaded as: `pose-animation.json`
### Rename to: `{pose-id}-animation.json`

**Example:** `agent-taunt-animation.json`

**Contains:**
```json
{
  "name": "vrmAnimation",
  "duration": 2.5,
  "tracks": [
    {
      "name": "Armature/Hips.quaternion",
      "type": "quaternion",
      "times": [0, 0.041, 0.083, ...],
      "values": [0, 0, 0, 1, 0.01, 0.02, ...]
    },
    // ... all bones (all frames)
  ]
}
```

**Used for:**
- ✅ Real Mixamo animation (Animation Mode: "Loop" or "Play Once")
- ✅ Full animation playback
- ✅ Professional quality motion
- ✅ Only loaded when animation mode is active

**File size:** 50-200 KB

---

## 🎯 Quick Reference

### Scenario 1: Static Pose Only

**You want:** Just a static pose, no animation

**Export:**
1. Export from Pose Lab
2. **Keep only:** `pose.json`
3. **Rename to:** `{pose-id}.json`
4. **Delete:** `pose-animation.json` (not needed)

**Result:** Pose works in static mode, uses procedural animation if available

---

### Scenario 2: FBX Animation

**You want:** Real Mixamo animation

**Export:**
1. Export from Pose Lab
2. **Keep both files**
3. **Rename:**
   - `pose.json` → `{pose-id}.json`
   - `pose-animation.json` → `{pose-id}-animation.json`

**Result:** Pose works in all modes, uses FBX animation when animated

---

## 📋 Step-by-Step Example

### Adding "Agent Taunt" with FBX Animation

**Step 1: Export**
```
Pose Lab → Drop Taunt.fbx → Click "Export Pose"
Downloads:
  - pose.json
  - pose-animation.json
```

**Step 2: Rename**
```
pose.json → agent-taunt.json
pose-animation.json → agent-taunt-animation.json
```

**Step 3: Place Files**
```
Move to: src/poses/
  ✅ agent-taunt.json
  ✅ agent-taunt-animation.json
```

**Step 4: Verify**
```
src/poses/
├── agent-taunt.json          ← Static pose
├── agent-taunt-animation.json ← FBX animation
```

**Step 5: Use**
```
Main App → Select "Agent Taunt" → Set "Loop Animation" → Generate
Result: Real Mixamo taunt animation plays! 🎭
```

---

## 🔍 Current Files in Your Poses Folder

```
src/poses/
├── agent-taunt.json          ✅ Static pose
├── taunt1.json               ⚠️  Duplicate? (check if needed)
├── dawn-runner.json          ✅ Static pose
├── green-loom.json           ✅ Static pose
├── sunset-call.json          ✅ Static pose
├── cipher-whisper.json       ✅ Static pose
├── nebula-drift.json         ✅ Static pose
├── loom-vanguard.json        ✅ Static pose
├── signal-reverie.json       ✅ Static pose
├── protocol-enforcer.json    ✅ Static pose
├── stand-tall.json           ✅ Static pose
├── typing.json               ✅ Static pose
└── fbx/
    └── Taunt.fbx             ✅ Source animation
```

**Missing:** `agent-taunt-animation.json` (needs to be exported)

---

## 🎬 To Add Animation to Agent Taunt

### Option A: Manual Export

1. **Open Pose Lab:** http://localhost:5173/?mode=pose-lab
2. **Upload VRM** (HarmonVox_519.vrm)
3. **Drop** `src/poses/fbx/Taunt.fbx`
4. **Click "Export Pose"**
5. **Rename downloads:**
   ```
   pose.json → agent-taunt.json (replace existing)
   pose-animation.json → agent-taunt-animation.json (NEW!)
   ```
6. **Move to** `src/poses/`
7. **Refresh browser**
8. **Test:** Select "Agent Taunt" + "Loop Animation"

### Option B: Batch Export

1. **Verify** `Taunt.fbx` is in `src/poses/fbx/`
2. **Update** `batchConfigs` in `src/pose-lab/PoseLab.tsx`:
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
3. **Open Pose Lab**
4. **Upload VRM**
5. **Click "Batch Export"**
6. **All files auto-generated!**

---

## ⚠️ Common Mistakes

### ❌ Wrong: Using generic names
```
pose.json
pose-animation.json
```
**Problem:** System can't find them

### ❌ Wrong: Missing suffix
```
agent-taunt.json
agent-taunt.json  (trying to use same name)
```
**Problem:** Overwrites static pose

### ❌ Wrong: Wrong suffix
```
agent-taunt.json
agent-taunt_animation.json  (underscore instead of dash)
```
**Problem:** System looks for `-animation`, not `_animation`

### ✅ Correct: Proper naming
```
agent-taunt.json
agent-taunt-animation.json
```
**Result:** Both files load correctly!

---

## 🔧 File Naming Rules

### Pattern
```
{pose-id}.json              ← Static pose (required)
{pose-id}-animation.json    ← Animation (optional)
```

### Valid Pose IDs
- Use kebab-case: `agent-taunt`, `stand-tall`, `typing`
- No spaces: ❌ `agent taunt` ✅ `agent-taunt`
- No underscores: ❌ `agent_taunt` ✅ `agent-taunt`
- Lowercase: ❌ `AgentTaunt` ✅ `agent-taunt`

---

## 📊 File Size Reference

**Static Pose Files:**
- Typical: 15-30 KB
- Contains: ~50-60 bone rotations (single frame)

**Animation Files:**
- Short (1-2s): 50-100 KB
- Medium (2-4s): 100-200 KB
- Long (4-8s): 200-400 KB
- Contains: ~50-60 bones × multiple frames

---

## 🎭 Animation System Priority

```
User selects "Loop Animation"
  ↓
1. Check: agent-taunt-animation.json exists?
   YES → Use FBX animation ✨
   NO ↓
2. Check: Procedural animation defined in animatedPoses.ts?
   YES → Use procedural animation
   NO ↓
3. Use simple transition (smooth fade)
```

---

## 🗂️ FBX Source Files

The `fbx/` folder stores raw Mixamo exports:

```
src/poses/fbx/
├── Taunt.fbx                 ← Agent Taunt source
├── Male Crouch Pose.fbx
├── Male Dance Pose.fbx
├── Male Dynamic Pose.fbx
├── Male Locomotion Pose.fbx
├── Male Sitting Pose.fbx
└── Male Standing Pose.fbx
```

**These are source files only** - not used directly by the app.
Use Pose Lab to convert them to JSON format.

---

## ✅ Checklist: Adding New Animated Pose

- [ ] Get Mixamo FBX file
- [ ] Place in `src/poses/fbx/` (optional, for reference)
- [ ] Open Pose Lab
- [ ] Upload VRM
- [ ] Drop FBX file
- [ ] Click "Export Pose"
- [ ] Rename `pose.json` → `{pose-id}.json`
- [ ] Rename `pose-animation.json` → `{pose-id}-animation.json`
- [ ] Move both to `src/poses/`
- [ ] Add to `src/types/reactions.ts` (if new pose)
- [ ] Import in `src/poses/index.ts`
- [ ] Add preset in `src/data/reactions.ts`
- [ ] Refresh browser
- [ ] Test with "Loop Animation"

---

## 🎯 Summary

**Two files, two purposes:**
1. **`{pose-id}.json`** - Static pose (always needed)
2. **`{pose-id}-animation.json`** - FBX animation (optional)

**The system automatically:**
- Loads static pose for static display
- Loads animation file when animation mode is active
- Falls back to procedural if no animation file

**Simple rule:** Match the names exactly with `-animation` suffix!

---

**Built with 💜 for Project 89**

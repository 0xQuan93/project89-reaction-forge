# Pose Assets

## 📁 File Structure

Each pose can have **two files**:

### 1. Static Pose (Required)
**Format:** `{pose-id}.json`
**Example:** `agent-taunt.json`
**Contains:** Static pose data (first frame of animation)
**Used for:** Static display, base for procedural animations

### 2. Animation Data (Optional)
**Format:** `{pose-id}-animation.json`
**Example:** `agent-taunt-animation.json`
**Contains:** Full FBX animation data (all frames)
**Used for:** Real Mixamo animations when "Loop" or "Play Once" is selected

---

## 🎯 Naming Convention

| Pose ID | Static Pose File | Animation File |
|---------|-----------------|----------------|
| agent-taunt | `agent-taunt.json` | `agent-taunt-animation.json` |
| typing | `typing.json` | `typing-animation.json` |
| stand-tall | `stand-tall.json` | `stand-tall-animation.json` |

**Rule:** Animation file = pose file name + `-animation` suffix

---

## 📤 Exporting from Pose Lab

### Step 1: Export Files

1. Open Pose Lab: http://localhost:5173/?mode=pose-lab
2. Upload VRM avatar
3. Drop Mixamo FBX file (e.g., `Taunt.fbx`)
4. Click "Export Pose"
5. **Two files download:**
   - `pose.json` - Static pose
   - `pose-animation.json` - Animation data

### Step 2: Rename Files

**For pose ID "agent-taunt":**
```bash
pose.json → agent-taunt.json
pose-animation.json → agent-taunt-animation.json
```

**For pose ID "typing":**
```bash
pose.json → typing.json
pose-animation.json → typing-animation.json
```

### Step 3: Place in src/poses/

Move both renamed files to this folder.

### Step 4: Register in index.ts

If it's a new pose, add to `src/poses/index.ts`:
```typescript
import agentTaunt from './agent-taunt.json';

const poseLibrary: Record<PoseId, PoseDefinition> = {
  'agent-taunt': agentTaunt as PoseDefinition,
  // ...
};
```

---

## 🎬 Animation Priority

When "Loop" or "Play Once" is selected:

1. **Check for FBX animation** (`{pose-id}-animation.json`)
   - If exists: Use real Mixamo animation ✨
   
2. **Check for procedural animation** (`animatedPoses.ts`)
   - If defined: Use code-generated animation
   
3. **Fallback to simple transition**
   - Smooth fade to static pose

---

## 📊 Current Poses

| Pose | Static File | Animation File | Status |
|------|-------------|----------------|--------|
| Dawn Runner | ✅ dawn-runner.json | ❌ | Procedural |
| Sunset Call | ✅ sunset-call.json | ❌ | Procedural |
| Cipher Whisper | ✅ cipher-whisper.json | ❌ | Procedural |
| Nebula Drift | ✅ nebula-drift.json | ❌ | Procedural |
| Signal Reverie | ✅ signal-reverie.json | ❌ | Procedural |
| Typing | ✅ typing.json | ❌ | Procedural |
| Agent Taunt | ✅ agent-taunt.json | ✅ agent-taunt-animation.json | **FBX Animation!** ✨ |
| Agent Dance | ✅ agent-dance.json | ✅ agent-dance-animation.json | **FBX Animation!** ✨ |

---

## 🗂️ FBX Source Files

The `fbx/` folder stores raw Mixamo exports:

- `Taunt.fbx` - Agent Taunt animation source
- `Male Crouch Pose.fbx`
- `Male Dance Pose.fbx`
- `Male Dynamic Pose.fbx`
- `Male Locomotion Pose.fbx`
- `Male Sitting Pose.fbx`
- `Male Standing Pose.fbx`

These are reference files. Use Pose Lab to convert them to VRM format.

---

## ✅ Quick Reference

**To add FBX animation to existing pose:**
1. Export from Pose Lab → Get 2 files
2. Rename: `pose-animation.json` → `{pose-id}-animation.json`
3. Place in `src/poses/`
4. Refresh browser
5. Select pose + "Loop Animation"
6. Done! 🎭

**File size guidelines:**
- Static pose: 10-50 KB
- Animation: 50-200 KB (depends on duration)

---

**For more details, see:** `HYBRID-ANIMATION-SYSTEM.md` in project root


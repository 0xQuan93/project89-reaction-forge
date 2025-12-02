# Pose Cleanup Plan

## 🎯 Current Situation

You have **12 poses**, but several are likely duplicates from the same Mixamo source files with different names.

---

## 📊 Pose Analysis

### Original Mixamo Sources
Based on the FBX files listed in README:
- `Male Crouch Pose.fbx`
- `Male Dance Pose.fbx`
- `Male Dynamic Pose.fbx`
- `Male Locomotion Pose.fbx`
- `Male Sitting Pose.fbx`
- `Male Standing Pose.fbx`
- `Taunt.fbx` (custom)

### Current Poses (Likely Mapping)

| Pose | Source FBX | Keep? |
|------|-----------|-------|
| **Dawn Runner** | Male Dynamic Pose | ✅ Keep (unique) |
| **Green Loom** | Male Dance Pose | ⚠️ Duplicate with Agent Dance? |
| **Sunset Call** | Male Standing Pose | ⚠️ Duplicate with Loom Vanguard/Stand Tall? |
| **Cipher Whisper** | Male Sitting Pose | ✅ Keep (unique) |
| **Nebula Drift** | Male Locomotion Pose | ⚠️ Duplicate with Protocol Enforcer? |
| **Loom Vanguard** | Male Standing Pose | ⚠️ Duplicate with Sunset Call/Stand Tall? |
| **Signal Reverie** | Male Crouch Pose | ✅ Keep (unique) |
| **Protocol Enforcer** | Male Locomotion Pose | ⚠️ Duplicate with Nebula Drift? |
| **Stand Tall** | Male Standing Pose | ⚠️ Duplicate with Sunset Call/Loom Vanguard? |
| **Typing** | Custom | ✅ Keep (unique) |
| **Agent Taunt** | Taunt.fbx | ✅ Keep (unique, has animation) |
| **Agent Dance** | Male Dance Pose? | ⚠️ Duplicate with Green Loom? |

---

## 🎨 Recommended Streamlined Set

### Option A: Keep 8 Core Poses (Minimal)

**One pose per Mixamo source:**
1. **Dawn Runner** - Dynamic action pose
2. **Cipher Whisper** - Sitting/thinking pose
3. **Signal Reverie** - Crouching pose
4. **Sunset Call** - Standing pose (pick best name)
5. **Nebula Drift** - Walking/locomotion pose (pick best name)
6. **Green Loom** OR **Agent Dance** - Dance pose (pick one)
7. **Typing** - Custom typing animation
8. **Agent Taunt** - Taunt animation (has FBX)

**Remove:**
- Loom Vanguard (duplicate of Sunset Call/Stand Tall)
- Stand Tall (duplicate of Sunset Call/Loom Vanguard)
- Protocol Enforcer (duplicate of Nebula Drift)
- Either Green Loom OR Agent Dance (both are dance poses)

### Option B: Keep 10 Poses (Balanced)

Keep Option A + 2 variations:
- Keep both standing poses (different expressions/backgrounds)
- Keep both dance poses (different vibes)

---

## 🔍 How to Verify Duplicates

### Check File Sizes
Duplicates will have similar file sizes:
```bash
dir src\poses\*.json
```

### Compare First Few Lines
```bash
# Compare two suspected duplicates
head -20 src/poses/sunset-call.json
head -20 src/poses/loom-vanguard.json
```

If the `vrmPose` data is identical or very similar, they're duplicates.

---

## 🗑️ Cleanup Steps

### Step 1: Identify Duplicates

**Check these pairs:**
1. `sunset-call.json` vs `loom-vanguard.json` vs `stand-tall.json`
2. `nebula-drift.json` vs `protocol-enforcer.json`
3. `green-loom.json` vs `agent-dance.json`

### Step 2: Decide Which to Keep

**Criteria:**
- Better name (more descriptive)
- Better description
- Has animation file
- Better expression/background combo

### Step 3: Remove Files

**For each duplicate to remove:**
1. Delete `{pose-id}.json`
2. Delete `{pose-id}-animation.json` (if exists)
3. Remove from `src/types/reactions.ts`
4. Remove from `src/poses/index.ts`
5. Remove from `src/data/reactions.ts`

### Step 4: Update Documentation

Update `src/poses/README.md` with final pose list.

---

## 🎯 My Recommendation

### Keep These 8 Poses:

1. **Dawn Runner** (dynamic action)
   - Expression: Calm
   - Background: Midnight
   - Source: Male Dynamic Pose

2. **Cipher Whisper** (sitting/thinking)
   - Expression: Calm
   - Background: Midnight
   - Source: Male Sitting Pose

3. **Signal Reverie** (crouching)
   - Expression: Surprise
   - Background: Midnight
   - Source: Male Crouch Pose

4. **Sunset Call** (standing - keep this one, best name)
   - Expression: Surprise
   - Background: Sunset
   - Source: Male Standing Pose

5. **Nebula Drift** (locomotion - keep this one, best name)
   - Expression: Joy
   - Background: Matrix
   - Source: Male Locomotion Pose

6. **Agent Dance** (dance - keep this one, has animation!)
   - Expression: Joy
   - Background: Matrix
   - Source: Male Dance Pose (has FBX animation)

7. **Typing** (custom typing)
   - Expression: Calm
   - Background: Matrix
   - Custom animation

8. **Agent Taunt** (taunt)
   - Expression: Joy
   - Background: Sunset
   - Source: Taunt.fbx (has FBX animation)

### Remove These 4 Poses:

1. **Green Loom** - Duplicate of Agent Dance
2. **Loom Vanguard** - Duplicate of Sunset Call
3. **Stand Tall** - Duplicate of Sunset Call
4. **Protocol Enforcer** - Duplicate of Nebula Drift

---

## 📝 Removal Commands

### Files to Delete:
```bash
# Remove duplicate pose files
rm src/poses/green-loom.json
rm src/poses/loom-vanguard.json
rm src/poses/stand-tall.json
rm src/poses/protocol-enforcer.json
rm src/poses/taunt1.json  # Also remove this orphan file
```

### Code Changes:

**src/types/reactions.ts:**
```typescript
export type PoseId =
  | 'dawn-runner'
  | 'sunset-call'
  | 'cipher-whisper'
  | 'nebula-drift'
  | 'signal-reverie'
  | 'typing'
  | 'agent-taunt'
  | 'agent-dance';
```

**src/poses/index.ts:**
Remove imports and library entries for:
- greenLoom
- loomVanguard
- standTall
- protocolEnforcer

**src/data/reactions.ts:**
Remove preset objects for the 4 removed poses.

---

## ✅ Benefits of Cleanup

**Before:** 12 poses (with duplicates)
**After:** 8 poses (all unique)

**Benefits:**
- ✅ Clearer choices for users
- ✅ Less confusion
- ✅ Smaller bundle size
- ✅ Easier to maintain
- ✅ Each pose is distinct
- ✅ Better organized

---

## 🎭 Final Pose Set

After cleanup, you'll have **8 distinct poses**:

| # | Pose | Type | Animation |
|---|------|------|-----------|
| 1 | Dawn Runner | Action | Procedural |
| 2 | Cipher Whisper | Sitting | Procedural |
| 3 | Signal Reverie | Crouching | Procedural |
| 4 | Sunset Call | Standing | Procedural |
| 5 | Nebula Drift | Walking | Procedural |
| 6 | Agent Dance | Dancing | ✨ FBX Animation |
| 7 | Typing | Custom | Procedural |
| 8 | Agent Taunt | Taunting | ✨ FBX Animation |

**2 poses with real FBX animations!** 🎬

---

## 🚀 Ready to Clean Up?

Let me know which poses you want to keep, and I'll:
1. Delete the duplicate files
2. Update all the code
3. Test that everything works
4. Update documentation

**Or I can proceed with my recommendation above?**

---

**Built with 💜 for Project 89** 🎭✨


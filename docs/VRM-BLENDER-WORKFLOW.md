# VRM ↔ Blender Workflow Guide

## 🎯 Question: Can VRM Pose JSON work in Blender?

**Short answer:** Not directly, but yes with conversion!

**Long answer:** VRM pose JSON uses VRM-specific bone names and coordinate systems. Blender needs conversion to work with these poses.

---

## 🔄 Two-Way Workflow Options

### Option 1: VRM JSON → Blender (Import Poses)

**Use case:** You have VRM poses from Pose Lab and want to use them in Blender

**How:**
1. Use the provided Python script
2. Maps VRM bones to Blender bones
3. Applies rotations to armature

**See:** `scripts/blender_import_vrm_pose.py`

---

### Option 2: Blender → VRM (Export Poses)

**Use case:** Create animations in Blender and use them in Reaction Forge

**How:**
1. Create animation in Blender
2. Export as FBX
3. Import to Pose Lab
4. Export as VRM JSON
5. Use in Reaction Forge

**This is the recommended workflow!**

---

## 📝 Method 1: Import VRM Pose to Blender

### Requirements

- Blender 3.0+
- VRM model imported (or compatible armature)
- VRM pose JSON file from Pose Lab

### Step-by-Step

**1. Install VRM Addon (Optional but Recommended)**

Download from: https://github.com/saturday06/VRM-Addon-for-Blender

This addon helps with:
- Importing VRM models
- Proper bone structure
- VRM-specific features

**2. Import Your VRM Model**

```
File → Import → VRM (.vrm)
```

Or use any armature with humanoid bone structure.

**3. Prepare the Script**

Open `scripts/blender_import_vrm_pose.py` and update:

```python
JSON_PATH = "C:/Users/Chris/project89-reaction-forge/src/poses/agent-dance.json"
ARMATURE_NAME = "Armature"  # Your armature name
```

**4. Run the Script**

1. Open Blender Scripting workspace
2. Open the script file
3. Click "Run Script"
4. Check console for results

**5. Adjust Bone Mapping**

If bones don't match, update `VRM_TO_BLENDER_BONES` dictionary:

```python
VRM_TO_BLENDER_BONES = {
    "hips": "Hips",           # VRM name: Blender name
    "spine": "Spine",
    "leftUpperArm": "LeftArm",  # Adjust to match your rig
    # ... etc
}
```

---

## 🎨 Method 2: Create Animations in Blender (Recommended)

This is the **better workflow** because:
- Full Blender animation tools
- No conversion issues
- Professional results
- Easy to iterate

### Workflow

**1. Create Animation in Blender**

```
1. Import VRM model (or use any humanoid rig)
2. Pose the character
3. Add keyframes
4. Create animation
5. Preview and refine
```

**2. Export as FBX**

```
File → Export → FBX (.fbx)

Settings:
- ☑ Selected Objects
- ☑ Armature
- ☑ Bake Animation
- Frame Range: Your animation
```

**3. Import to Pose Lab**

```
1. Open: http://localhost:5173/?mode=pose-lab
2. Upload your VRM model
3. Drop your FBX file
4. Click "Export Pose"
```

**4. Get Two Files**

```
pose.json → Rename to {pose-id}.json
pose-animation.json → Rename to {pose-id}-animation.json
```

**5. Add to Reaction Forge**

```
1. Place files in src/poses/
2. Register in src/poses/index.ts
3. Add to src/types/reactions.ts
4. Create preset in src/data/reactions.ts
5. Refresh browser
```

---

## 🔧 Bone Mapping Reference

### VRM Standard Bones

**Core:**
- hips, spine, chest, upperChest, neck, head

**Arms:**
- leftShoulder, leftUpperArm, leftLowerArm, leftHand
- rightShoulder, rightUpperArm, rightLowerArm, rightHand

**Legs:**
- leftUpperLeg, leftLowerLeg, leftFoot, leftToes
- rightUpperLeg, rightLowerLeg, rightFoot, rightToes

**Fingers:**
- leftThumbProximal, leftThumbIntermediate, leftThumbDistal
- leftIndexProximal, leftIndexIntermediate, leftIndexDistal
- (etc for middle, ring, little)

### Common Blender Bone Names

**Mixamo Rig:**
- Hips, Spine, Spine1, Spine2, Neck, Head
- LeftShoulder, LeftArm, LeftForeArm, LeftHand
- RightShoulder, RightArm, RightForeArm, RightHand
- LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase
- RightUpLeg, RightLeg, RightFoot, RightToeBase

**Rigify:**
- hips, spine, spine.001, spine.002, neck, head
- shoulder.L, upper_arm.L, forearm.L, hand.L
- shoulder.R, upper_arm.R, forearm.R, hand.R
- thigh.L, shin.L, foot.L, toe.L
- thigh.R, shin.R, foot.R, toe.R

---

## 💡 Practical Examples

### Example 1: Import Agent Dance Pose

```python
# In blender_import_vrm_pose.py
JSON_PATH = "C:/Users/Chris/project89-reaction-forge/src/poses/agent-dance.json"
ARMATURE_NAME = "Armature"

# Run script in Blender
# Result: Your VRM model in dance pose!
```

### Example 2: Create Custom Pose in Blender

```
1. Blender: Create "victory" pose
2. Export: victory.fbx
3. Pose Lab: Import victory.fbx
4. Export: victory.json + victory-animation.json
5. Reaction Forge: Add as new preset
6. Result: Custom victory reaction! 🎉
```

### Example 3: Animate in Blender

```
1. Blender: Create 3-second wave animation
2. Export: wave-animation.fbx (30 fps, 90 frames)
3. Pose Lab: Import wave-animation.fbx
4. Export: wave.json + wave-animation.json
5. Reaction Forge: Add as animated preset
6. Result: Smooth waving animation! 👋
```

---

## 🎯 Which Method to Use?

### Use VRM → Blender When:
- ✅ You have existing VRM poses
- ✅ Want to refine poses in Blender
- ✅ Need to combine multiple poses
- ✅ Want to add Blender-specific effects

### Use Blender → VRM When:
- ✅ Creating new animations (recommended!)
- ✅ Want full Blender animation tools
- ✅ Professional animation workflow
- ✅ Complex character animation

**Recommendation:** Use **Blender → VRM** for best results!

---

## 🚀 Advanced: Full Animation Pipeline

### Professional Workflow

```
1. Concept → Sketch out animation idea
2. Blender → Create animation (full timeline)
3. Preview → Test in Blender viewport
4. Export FBX → Baked animation
5. Pose Lab → Convert to VRM format
6. Reaction Forge → Test with VRM avatar
7. Iterate → Refine in Blender if needed
8. Export → Share as WebM/GIF
```

### Tips for Best Results

**In Blender:**
- Use 30 FPS for smooth animation
- Keep animations 2-5 seconds
- Test with VRM-compatible rig
- Bake all animations before export
- Use humanoid bone structure

**In Pose Lab:**
- Use same VRM model as target
- Check console for conversion logs
- Verify bone mapping is correct
- Export both static + animation

**In Reaction Forge:**
- Test with "Loop" mode first
- Check all bones animate correctly
- Verify timing is correct
- Export and share!

---

## 📊 Format Comparison

| Format | Use Case | Pros | Cons |
|--------|----------|------|------|
| **VRM JSON** | Reaction Forge | Fast, web-native | VRM-specific |
| **FBX** | Blender ↔ Pose Lab | Universal, full data | Large files |
| **Blender Pose** | Blender only | Full control | Not portable |

---

## 🐛 Troubleshooting

### "Bone not found" Error

**Problem:** Blender bone names don't match VRM names

**Solution:** Update `VRM_TO_BLENDER_BONES` mapping in script

### Pose Looks Wrong

**Problem:** Coordinate system differences

**Solution:** 
- Check scene rotation in JSON
- Adjust coordinate conversion in script
- May need to flip axes

### Animation Doesn't Export

**Problem:** Animation not baked in Blender

**Solution:**
- Enable "Bake Animation" in FBX export
- Set correct frame range
- Include armature in export

---

## 📚 Resources

**VRM Specification:**
- https://vrm.dev/en/

**VRM Blender Addon:**
- https://github.com/saturday06/VRM-Addon-for-Blender

**Mixamo (Free Animations):**
- https://www.mixamo.com/

**Blender Documentation:**
- https://docs.blender.org/manual/en/latest/animation/

---

## ✅ Summary

**Can VRM JSON work in Blender?**
- ✅ Yes, with Python script conversion
- ✅ Better: Create in Blender, export to VRM
- ✅ Best workflow: Blender → FBX → Pose Lab → VRM

**Recommended Pipeline:**
```
Blender Animation → FBX → Pose Lab → VRM JSON → Reaction Forge
```

**Script provided:**
- `scripts/blender_import_vrm_pose.py`
- Import VRM poses into Blender
- Customize bone mapping as needed

---

**Built with 💜 for Project 89** 🎭✨


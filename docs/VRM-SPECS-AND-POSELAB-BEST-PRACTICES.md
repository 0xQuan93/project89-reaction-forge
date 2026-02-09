# VRM Specs & PoseLab Best Practices

This document summarizes VRM specification details relevant to PoseLab and recommended practices for avatars, Mixamo/FBX workflows, motion capture, and export.

---

## VRM Specification Summary

### Versions

| Version | Basis | PoseLab Support | Notes |
|--------|--------|------------------|--------|
| **VRM 0.0** | glTF 2.0 (JSON) | ✅ Yes | Legacy; expressions and scaling can differ from 1.0. |
| **VRM 1.0** | glTF 2.0 (binary `.glb` / `.vrm`) | ✅ Yes | Preferred for mocap and consistent behavior. |

PoseLab uses `@pixiv/three-vrm` (and `@pixiv/three-vrm-animation`), which support both 0.0 and 1.0. The runtime detects version and adjusts retargeting and expressions accordingly.

### Humanoid Bones (VRM 1.0)

The humanoid extension defines a standard skeleton. PoseLab expects these **VRM humanoid bone names** for retargeting, mocap, and IK:

**Core**
- `hips`, `spine`, `chest`, `upperChest`, `neck`, `head`

**Arms**
- `leftShoulder`, `leftUpperArm`, `leftLowerArm`, `leftHand`
- `rightShoulder`, `rightUpperArm`, `rightLowerArm`, `rightHand`

**Legs**
- `leftUpperLeg`, `leftLowerLeg`, `leftFoot`, `leftToes`
- `rightUpperLeg`, `rightLowerLeg`, `rightFoot`, `rightToes`

**Fingers (optional but recommended for hand poses)**
- Thumb: `leftThumbMetacarpal`, `leftThumbProximal`, `leftThumbDistal` (and `right*`)
- Index/Middle/Ring/Little: `leftIndexProximal`, `leftIndexIntermediate`, `leftIndexDistal`, etc.

Mandatory bones for a valid humanoid are typically: **hips, spine, chest, neck, head**, and the **left/right** arm and leg chains. Missing optional bones (e.g. fingers, upperChest) may limit hand poses or spine nuance but won’t prevent loading.

### Materials & MToon

- **VRM 0.x**: MToon was bundled with the main VRM extension.
- **VRM 1.0**: MToon is a separate extension `VRMC_materials_mtoon` on materials.

PoseLab’s toon shader controls (outlines, rim, emissive) apply to **MToon** materials only. Non-MToon VRMs will load but won’t get those extra toon tweaks in the UI.

### Other Extensions (PoseLab-relevant)

- **VRMC_vrm** – Humanoid, meta, expressions.
- **VRMC_springBone** – Spring/collider bones; supported for physics.
- **VRMC_node_constraint** – Node constraints; supported where the runtime implements them.

### File Format

- **Extension**: `.vrm`
- **Internals**: Binary glTF (GLB) with VRM extensions. Can be validated with [VRM Validator](https://vrm-validator.pixiv.net/).

---

## Best Practices for PoseLab

### 1. Avatar preparation

- **Prefer VRM 1.0** for motion capture and consistent scaling/expressions.
- **Validate** with [VRM Validator](https://vrm-validator.pixiv.net/) and fix humanoid mapping and blend shape names.
- **T-pose**: Model should be in a correct T-pose at rest. Twisted limbs in-app often come from an incorrect rest pose in the source VRM.
- **Expressions**: Use standard blend shape names (e.g. `Blink`, `Joy`, `A`, `I`, `U`, `E`, `O`) so PoseLab’s expression UI and lip-sync can drive them. See [VRM-VALIDATION-GUIDE.md](./VRM-VALIDATION-GUIDE.md).

### 2. Mixamo → PoseLab (FBX retargeting)

- **Rig**: PoseLab’s retargeter is built for **Mixamo-style** naming (`mixamorigHips`, `mixamorigSpine`, etc.). The map lives in `VRMRigMapMixamo.ts` (e.g. `mixamorigHips` → `hips`, `mixamorigLeftArm` → `leftUpperArm`). Non-Mixamo FBX may need custom mapping or renaming.
- **Export from Mixamo**: Download FBX with “Without Skin” if you only need animation; use the same skeleton as the one in the map for best results.
- **Frame rate**: 30 FPS is a safe choice for import/export and matches many guides (e.g. Blender workflow).
- **Batch retarget**: Load your **target VRM** in PoseLab first, then use Pose Lab’s batch FBX import. Retargeting is done to the current avatar’s skeleton, so using the same VRM you use in Reaction Forge avoids mismatches.
- **Export**: Save both “pose” (static snapshot) and “animation” JSON when you need a clip for the timeline or Reaction Forge.

### 3. Motion capture (webcam / VMC)

- **VRM 1.0** avatars are recommended; 0.0 can have different scale/offset and cause drift.
- **Calibration**: Use the in-app T-pose calibration for your setup so landmark → bone mapping matches your camera and pose.
- **Lighting**: Stable lighting improves MediaPipe tracking and reduces jitter (smoothing is applied, but good input helps).
- **Camera**: Prefer the same camera device for calibration and use (e.g. “Virtual Camera” for OBS) so the pipeline is consistent.

### 4. Expressions and lip-sync

- **Blend shapes**: Ensure the VRM has the expression blend shapes you want (e.g. visemes A, I, U, E, O and optional Blink, Joy, etc.). Missing names mean those sliders won’t do anything.
- **Mocap + expressions**: If you use both mocap and expression/lip-sync, test with your target VRM; some models need expression limits or tuning to avoid clipping.

### 5. Performance and export

- **Poly count**: Large VRMs and complex scenes can slow real-time preview and export. For streaming or batch export, consider optimized avatars and closing unneeded tabs.
- **Export formats**: PNG for stills, WebM for video. For interop (Blender, Unity), use **GLB export** with baked animation when available.
- **Project files**: Use **.pose** project save/load to keep avatar reference, timeline, and presets together and to recover after crashes (autosave).

### 6. Blender ↔ PoseLab

- **Recommended path**: **Blender → FBX → Pose Lab → VRM JSON / Reaction Forge.** Create and bake animation in Blender, export FBX, retarget in Pose Lab with your VRM, then use in Reaction Forge or export GLB. See [VRM-BLENDER-WORKFLOW.md](./VRM-BLENDER-WORKFLOW.md).
- **Bone names**: If you author in Blender with a non-Mixamo rig, either match the VRM humanoid names or the Mixamo names used in `VRMRigMapMixamo.ts` so retargeting finds the bones.

### 7. Multiplayer and streaming

- **VRM transfer**: When using multiplayer, VRMs are sent in chunks. Large files take longer; reasonable poly/texture size improves sync.
- **Stream mode**: Use “Stream Mode” (clean UI + transparent background) with OBS Browser Source for virtual camera output.

---

## Quick reference: PoseLab-friendly VRM checklist

- [ ] VRM 1.0 (or validated 0.0)
- [ ] All mandatory humanoid bones mapped
- [ ] Correct T-pose at rest
- [ ] Standard expression blend shape names if using expressions/lip-sync
- [ ] MToon materials if you want toon shader controls in PoseLab
- [ ] Validated with [VRM Validator](https://vrm-validator.pixiv.net/) before heavy use in PoseLab

---

## See also

- [VRM-VALIDATION-GUIDE.md](./VRM-VALIDATION-GUIDE.md) – Validation steps and common issues
- [VRM-BLENDER-WORKFLOW.md](./VRM-BLENDER-WORKFLOW.md) – Blender ↔ Pose Lab workflows and bone mapping
- [MOTION-CAPTURE-GUIDE.md](./MOTION-CAPTURE-GUIDE.md) – Mocap setup and usage
- [EXPORT-FORMATS-GUIDE.md](./EXPORT-FORMATS-GUIDE.md) – Export options and formats
- Official VRM spec: [vrm.dev](https://vrm.dev/en/) / [vrm-c/vrm-specification](https://github.com/vrm-c/vrm-specification)

# VRM 1.0 & Validation Guide

PoseLab primarily uses `@pixiv/three-vrm` which supports both VRM 0.0 and VRM 1.0 specifications. However, ensuring your avatar is compliant can save hours of debugging (especially for retargeting and expressions).

## 🕵️ How to Validate Your Avatar

If your avatar isn't loading or behaving correctly in PoseLab, follow these steps:

### 1. Official VRM Validator
Use the official validator to check for spec compliance.
*   **Link:** [VRM Validator](https://vrm-validator.pixiv.net/)
*   **What to check:**
    *   Humanoid bone mapping (Are mandatory bones mapped?)
    *   BlendShape group names (Are they using standard names like `Blink`, `Joy`?)
    *   Version (Is it 0.0 or 1.0?)

### 2. Blender <> Unity Workflow
If you need to fix your avatar, the standard pipeline is:

**Blender:**
1.  Import your model using the **VRM Add-on for Blender**.
    *   [Download Add-on](https://github.com/saturday06/VRM_Addon_for_Blender)
2.  Use the "Validate" button in the VRM tab.
3.  Ensure your armature follows the VRM Humanoid naming convention.
4.  Export as `.vrm`.

**Unity (UniVRM):**
1.  Import the **UniVRM** package into a new Unity project.
    *   [Download UniVRM](https://github.com/vrm-c/UniVRM)
2.  Drag your FBX/model into the scene.
3.  Add the `VRM Humanoid` component and configure bones.
4.  Add `VRM BlendShapeProxy` for expressions.
5.  Export via `VRM > Export to VRM 1.0`.

## 🔄 Common Issues in PoseLab

*   **"Twisted Limbs"**: Usually caused by incorrect T-Pose in the base model. Open in Blender and apply "Rest Pose" as T-Pose.
*   **"Face not moving"**: The avatar might be missing standard blendshape clips (`Blink`, `A`, `I`, `U`, `E`, `O`). Check your BlendShapeProxy in Unity or Blender.
*   **"Mocap drift"**: VRM 0.0 models sometimes have different scaling references than VRM 1.0. We try to normalize this, but 1.0 is generally more stable.

## 🛠️ PoseLab Support
PoseLab automatically detects VRM 0.0 vs 1.0 and adjusts the retargeting engine accordingly. However, for best results with **Motion Capture**, we recommend **VRM 1.0** avatars.


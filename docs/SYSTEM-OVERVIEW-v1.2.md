# 🏗️ PoseLab System Overview (v1.2)

**Date:** December 9, 2025
**Status:** Production Ready (Green Loom Phase 1)

This document provides a comprehensive technical overview of the current state of PoseLab (formerly Reaction Forge). It supersedes previous implementation summaries.

---

## 1. Core Architecture

PoseLab is built on a modern web stack designed for "Local-First" processing and privacy.

*   **Framework:** React 19 + TypeScript + Vite
*   **3D Engine:** Three.js + @pixiv/three-vrm
*   **State Management:** Zustand (Persisted stores for settings/poses)
*   **AI/ML:** Google Gemini (Text-to-Pose) + MediaPipe Holistic (Motion Capture)

### Key Managers (Singleton Pattern)
*   **`SceneManager`**: Handles the Three.js scene, camera, renderer, and background composition.
*   **`AvatarManager`**: Manages VRM loading, bone manipulation, blendshapes, and pose application.
*   **`AnimationManager`**: Handles the `AnimationMixer`, clip playback, looping, and blending.
*   **`MotionCaptureManager`**: Bridges MediaPipe Holistic results to VRM bone rotations via Kalidokit (currently main-thread; worker migration planned).
*   **`Live2DManager`**: Manages PixiJS application and Live2D Cubism model loading/rendering.

---

## 2. Feature Modules

### 🎭 Reactions Mode
*   **Presets**: One-click application of predefined poses + expressions + backgrounds.
*   **Scene Control**: Support for Images, Videos (MP4/WebM), and GIFs as backgrounds.
*   **Smart Export**: presets for Social Media (TikTok 9:16, YouTube 16:9, Square 1:1).
*   **Live2D Support (New!)**: Overlay layer for rendering 2D Cubism models (`.moc3`) alongside 3D content.

### 🛠️ Pose Lab Mode
*   **Timeline Editor**: Keyframe-based animation sequencer with linear interpolation.
*   **AI Generator**: Text-to-Pose using Gemini API. Generates JSON pose data.
*   **Manual Posing**: FK (Forward Kinematics) gizmos for precise joint rotation.
*   **Animation Import**: Mixamo FBX -> VRM Retargeting engine.
*   **Motion Capture (New!)**: Real-time webcam tracking for body and face.

---

## 3. Data Formats & Interop

### Internal Formats
*   **`.json` (Pose)**: Custom format storing `vrmPose` (normalized bone rotations), `expressions`, and `sceneRotation`.
*   **`.json` (Library)**: Array of saved poses for bulk import/export.

### Export Formats
*   **`.png`**: High-res static captures (with optional transparency).
*   **`.webm`**: High-quality video export for animations (using `CanvasCapture` / `MediaRecorder`).
*   **`.glb` (New!)**: Binary GLTF export containing the VRM mesh **baked with the active animation clip**. Compatible with Blender, Unity, and Godot.

---

## 4. Privacy & Security

*   **Local-First**: VRM files are loaded into browser memory via `blob:` URLs. No server uploads.
*   **Secure Context**: Webcam access requires HTTPS (or localhost). Explicit permission handling with user guidance.
*   **API Keys**: Gemini API keys are stored in `localStorage` or `.env`.

---

## 5. Recent Upgrades (v1.2)

*   **Holistic Mocap**: Simultaneous Body + Face tracking.
*   **GLB Baking**: Export your animations to standard 3D tools.
*   **Toast Notifications**: Replaced intrusive alerts with a non-blocking UI system.
*   **Performance Settings**: Quality toggle (High/Medium/Low) and Shadow toggle for lower-end devices.
*   **Branding**: Fully migrated to "PoseLab" identity while retaining "Reaction Forge" codebase roots.

---

## 6. Known Constraints

*   **Multi-Avatar**: Currently supports single avatar only (Singleton `AvatarManager`).
*   **Mocap Precision**: Web-based IK (Kalidokit) is an approximation. Rapid movements may drift.
*   **Mobile Mocap**: Heavy on performance; recommended for Desktop use.

---

*Verified by Harmon Vox / Project 89*

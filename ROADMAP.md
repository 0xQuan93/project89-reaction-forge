# 🗺️ PoseLab Roadmap

This document outlines the planned upgrades and feature requests for PoseLab, focusing on making the tool more robust, professional, and versatile for the VRM community.

---

## 📅 Short-Term Goals (v1.2)

### 1. 🎞️ Animated Backgrounds (GIF & Video Support)
**Goal:** Allow users to upload animated content for backgrounds to create dynamic scenes.
- [x] **Video Support (.mp4, .webm):** Implement `THREE.VideoTexture` to handle video files natively.
- [x] **GIF Support (.gif):** Integrate a GIF decoder (e.g., `omggif` or `gif.js`) to support animated GIF textures in the 3D scene.
- [x] **Export Logic:** Ensure `MediaRecorder` captures the animated background frame-by-frame during export.

### 2. 🎬 Timeline & Keyframing (Basic)
**Goal:** Move beyond static poses and simple loops to custom sequences.
- [x] **Keyframe Editor:** A simple timeline interface to set poses at specific timestamps. (Implemented v1.2)
- [x] **Interpolation Control:** Basic Linear interpolation between poses. (Implemented v1.2)
- [x] **Sequence Export:** Export the full timeline as a `.json` animation clip or `.webm` video. (Implemented v1.2)

### 3. 🕹️ Advanced IK Controls
**Goal:** Provide more precise control over limbs without relying solely on presets.
- [x] **Transform Gizmos:** Interactive Translate/Rotate gizmos attached to hands, feet, and hips. (Implemented v1.2)
- [ ] **IK Solver Upgrade:** Integrate a more robust IK solver (e.g., `three-ik` or `closed-chain-ik`) for better joint constraints.
- [ ] **Finger Poser:** A dedicated UI for individual finger phalanx control.

### 4. 📤 Advanced Export & Interop (New!)
**Goal:** Ensure assets created in PoseLab can be used in other tools (Blender, Unity).
- [x] **GLB Export:** Export the VRM with baked animation data as a standard `.glb` file. (Implemented v1.2)
- [x] **Asset Packs:** Shareable JSON libraries of custom poses. (Implemented v1.2)

---

## 🚀 Mid-Term Goals (v2.0)

### 5. 📸 Webcam Motion Capture (New!)
**Goal:** Real-time pose tracking using MediaPipe.
- [x] **Webcam Input:** Integrate `@mediapipe/pose` or `@mediapipe/tasks-vision`. (Implemented v1.2)
- [x] **Real-time Retargeting:** Map MediaPipe landmarks to VRM humanoid bones. (Implemented v1.2)
- [ ] **Recording:** Record mocap sessions to the timeline. (Pending)

### 6. 💾 Project Persistence
**Goal:** Allow users to save their entire workspace state.
- [ ] **Project Files (.pose):** Save a JSON file containing the Avatar (ref), Scene Settings, Background, and Timeline.
- [ ] **Auto-Save:** LocalStorage backup of the current session to prevent data loss.

### 7. 👥 Multi-Avatar Composition
**Goal:** Create interactions between multiple characters.
- [ ] **Multiple Loaders:** Support loading and managing multiple VRM models in one scene.
- [ ] **Interaction Poses:** Presets designed for two actors (e.g., high-five, hug, battle).

### 8. 🌤️ Advanced Lighting & Environment
**Goal:** Professional rendering quality.
- [ ] **HDRI Support:** Allow uploading `.hdr` / `.exr` environment maps for realistic lighting.
- [ ] **Light Controls:** Adjustable 3-point lighting (Key, Fill, Rim) with color and intensity sliders.
- [ ] **Post-Processing:** Bloom, Color Grading, and Ambient Occlusion effects.

---

## 🔮 Long-Term Vision (v3.0+)

### 9. 🤖 AI Motion Director
**Goal:** Expand Gemini integration for full motion synthesis.
- [ ] **Text-to-Animation:** "Make the avatar dance excitedly for 10 seconds."
- [ ] **Motion Style Transfer:** Apply the "mood" of a text prompt to an existing animation.

### 10. 📦 Asset Library Integration
**Goal:** Direct access to cloud assets.
- [ ] **VRoid Hub Integration:** Direct import of avatars.
- [ ] **Sketchfab Integration:** Import props and environments.

---

## 📝 User Feedback Tracking

| Request | Status | Priority |
|---------|--------|----------|
| GIF/Video Background Uploads | ✅ Done (v1.1) | High |
| Export Content (Video/GIF) | ✅ Done (WebM) | High |
| Mobile Uploads | ✅ Done | High |
| Smart Export Presets | ✅ Done | High |
| Better IK/Gizmos | ✅ Done (Basic FK) | Medium |
| Expressions UI | ✅ Done | High |
| AI Pose Gen (Gemini) | ✅ Done | High |
| GLB Export (Baked Animation) | ✅ Done (v1.2) | High |
| Webcam Mocap (MediaPipe) | ✅ Done (v1.2) | High |
| Motion Engine (Procedural) | ✅ Done (v1.2) | High |
| Multi-Avatar Scenes | 🚧 Planned | Medium |

# 🎭 PoseLab

**A Project 89 Initiative**

**PoseLab** (formerly Reaction Forge) is a browser-based studio for VRM avatar animation, posing, and content creation. It runs locally in your browser with no installs or accounts required.

[![Live Demo](https://img.shields.io/badge/Live-Demo-00ffd6?style=for-the-badge)](https://poselab.studio)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Privacy](https://img.shields.io/badge/Privacy-Local--First-green.svg?style=for-the-badge)](PRIVACY.md)

---

## 🌌 Why PoseLab

* **Local-first**: Your avatar stays on your machine. Rendering and exports run in-browser.
* **Creator-ready**: Fast presets, a full Pose Lab, and timeline tools for real content workflows.
* **Extensible**: Built on Three.js and React so you can extend or automate your pipeline.

---

## ✨ Features

### 🎨 **Reaction Studio**
*Create instant content with one click.*
- **Smart Presets**: Pre-made reactions with scene/lighting pairings.
- **Expression Control**: Fine-tune emotions with blendshape sliders.
- **Dynamic Backgrounds**: Theme gallery + **Green Screen** + **GIF/Video uploads** for animated scenes.
- **Auto-Looping**: Seamless animation loops for overlays and shorts.

### 🛠️ **Pose Lab**
*Deep dive into character posing and animation.*
- **Batch Export**: One-click regeneration of all pose JSONs using your custom avatar.
- **AI Pose Gen**: Describe a pose and let Gemini generate it.
- **Webcam Mocap**: Real-time body + face tracking with calibration and smoothing.
- **Manual Posing**: Fine-tune joints with **Gizmos** (Rotate/Translate).
- **Full Expression Control**: Blendshape editing for facial expressions.
- **Project Persistence**: Save and load your entire workspace (`.pose` files).
- **Live2D Support**: Load Live2D models and adjust expressions.

### 🚀 **Production Ready**
- **Smart Exports**: Presets for YouTube thumbnails (720p), TikTok (9:16), and Square (1:1).
- **Video Codec Detection**: VP9/VP8 fallbacks for broader WebM support.
- **Interactive Tutorial**: Guided onboarding for first-time users.
- **Command Palette**: Press `Cmd/Ctrl+K` for fast actions.
- **Design System**: Unified UI with consistent tokens and dark mode.
- **Performance Mode**: Auto-tunes quality for smooth framerates.
- **Transparent PNGs**: Export clean cutouts for Photoshop or OBS.
- **Privacy First**: [Read our Privacy Policy](PRIVACY.md). All processing happens locally.
- **Multiplayer Sessions**: Host or join a co-op room with scene syncing.

---

## 👩‍🍳 Quickstart Recipes

### 🎬 **For Animators**
**Goal: Retarget custom animations.**
1.  **Pose Lab**: Open **Save** tab.
2.  **Load Avatar**: Ensure your VRM is loaded.
3.  **Batch Export**: Click "Batch Export All Poses" to retarget the library to your avatar.

### 📸 **For YouTubers & Streamers**
**Goal: Create a clean thumbnail asset.**
1.  **Load Avatar**: Click "Load VRM" or use the sample.
2.  **Pose**: Go to **Pose Lab** → **AI Gen** → Type "shocked pointing finger".
3.  **Refine**: Switch to **Reactions** tab, adjust "Surprise" slider to 1.0.
4.  **Export**: Press `Cmd/Ctrl+K` -> **Export PNG**, or use the Export tab.

### 💃 **For VTubers**
**Goal: Create a "BRB" screen loop.**
1.  **Scene**: Go to **Scene** tab → Upload a looping `.mp4` background.
2.  **Action**: Select the **Simple Wave** preset.
3.  **Camera**: Set camera to **¾ View**.
4.  **Export**: Go to **Export** → Select **WebM** → Click **Vertical (9:16)**.

### 🎥 **For Mocap Performers**
**Goal: Record a custom motion.**
1.  **Mocap Tab**: Click "Start Camera".
2.  **Calibrate**: Stand in T-Pose and click "Calibrate".
3.  **Record**: Click "Record", perform your action, then "Stop".
4.  **Use**: The recording is automatically added to your Animations list.

### 🤝 **For Co-op Sessions**
**Goal: Share a live scene with a teammate.**
1.  **Multiplayer Tab**: Create a room.
2.  **Invite**: Share the join code or link.
3.  **Sync**: Scene settings, avatars, and backgrounds update in real time.

---

## ⚙️ Installation & Development

### Prerequisites
- Node.js 18+
- npm / yarn / pnpm

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/0xQuan93/project89-reaction-forge.git
cd project89-reaction-forge

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

### Run Modes
PoseLab has two primary routes:
- **Main app** (default): `http://localhost:5173/`
- **Pose Lab mode**: `http://localhost:5173/?mode=pose-lab`

### Environment Variables
Create a `.env` file in the root for AI features:
```env
VITE_GEMINI_API_KEY=your_api_key_here
VITE_ENABLE_VMC_BRIDGE=true
VITE_ENABLE_POSE_EXPORT=true
```

> [!NOTE]
> `VITE_ENABLE_VMC_BRIDGE` and `VITE_ENABLE_POSE_EXPORT` are **off by default**. Enable them only for trusted local development.

---

## 🧭 Repository Overview

### Core Entry Points
- `src/main.tsx`: App bootstrap and mode routing.
- `src/App.tsx`: Main PoseLab experience (reactions, exports, scene UI).
- `src/pose-lab/PoseLab.tsx`: Dedicated Pose Lab and retargeting workflow.

### Key Directories
- `src/three/`: Three.js/VRM engine (scene, avatar, materials, lighting, post-processing).
- `src/components/`: UI tabs, panels, modals, and shared widgets.
- `src/state/`: Zustand stores for app, scene, AI, and multiplayer state.
- `src/ai/` + `src/services/`: Gemini AI orchestration, prompt plumbing, and proxy calls.
- `src/export/`: PNG/WebM export helpers and render capture.
- `src/poses/`: Built-in pose JSON files and animation helpers.
- `src/pose-lab/`: Mixamo retargeting and pose capture utilities.
- `src/multiplayer/` + `src/bridge/`: Multiplayer sync and external avatar bridge.

---

## 🗺️ Roadmap & Vision

We are building the standard open-source tool for VRM content creation. Check out **[ROADMAP.md](ROADMAP.md)** to see what's coming next.

---

## 🤝 Contributing

We welcome contributions from developers, animators, and AI researchers!
Please read our **[CONTRIBUTING.md](CONTRIBUTING.md)** for details on how to submit pull requests, report issues, and shape the future of PoseLab.

---

## 🙏 Acknowledgments

- **[three-vrm](https://github.com/pixiv/three-vrm)**: The backbone of VRM on the web.
- **[Mixamo](https://www.mixamo.com/)**: For the animation library support.
- **[Google Gemini](https://deepmind.google/technologies/gemini/)**: Powering our text-to-pose engine.
- **[MediaPipe](https://developers.google.com/mediapipe)**: Powering our Holistic motion capture.

---

<div align="center">
  <p>Built with 💚 by <strong>Project 89</strong></p>
  <p>
    <a href="https://github.com/0xQuan93/project89-reaction-forge/issues">Report Bug</a> ·
    <a href="https://github.com/0xQuan93/project89-reaction-forge/discussions">Request Feature</a>
  </p>
</div>

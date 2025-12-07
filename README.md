# 🎭 PoseLab

**The ultimate browser-based toolkit for VRM avatar animation, posing, and reaction generation.**

Turn your 3D avatar into endless content—thumbnails, reaction GIFs, and animation clips—directly in your browser. Powered by procedural motion synthesis and AI.

[![Live Demo](https://img.shields.io/badge/Live-Demo-00ffd6?style=for-the-badge)](https://poselab.project89.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

---

## ✨ Features

### 🎨 **Reaction Studio**
*Create instant content with one click.*
- **Smart Presets**: 13+ pre-made reactions like "Dawn Runner", "Victory", and "Silly Dance".
- **Expression Control**: Fine-tune emotions with "Joy", "Surprise", and "Calm" sliders.
- **Dynamic Backgrounds**: 8 themes + **GIF/Video Uploads** for animated scenes.
- **Auto-Looping**: Perfectly seamless animation loops for streaming overlays.

### 🛠️ **Pose Lab**
*Deep dive into character posing and animation.*
- **Timeline Editor**: Create sequences by capturing keyframes and interpolating between them.
- **AI Pose Gen**: Describe a pose ("ninja landing", "thinking hard") and let Gemini AI create it.
- **Manual Posing**: Fine-tune joints with interactive Gizmos (Rotate/Translate).
- **Full Expression Control**: Access every blendshape your avatar supports (A, I, U, E, O, Blink, etc.).
- **Retargeting Engine**: Import Mixamo FBX animations and automatically retarget them to your VRM.
- **Keyframe Export**: Save poses and animations as lightweight JSON files.

### 🚀 **Production Ready**
- **Smart Exports**: One-click presets for YouTube Thumbnails (720p), TikToks (9:16), and Square (1:1).
- **Transparent PNGs**: Export clean cutouts for Photoshop or OBS.
- **Mobile Optimized**: Fully responsive UI for creating content on the go.
- **Privacy First**: All processing happens locally in your browser. No avatars are uploaded to a server.

---

## 👩‍🍳 Quickstart Recipes

### 🎬 **For Animators (New!)**
**Goal: Create a custom emote.**
1.  **Pose Lab**: Open **Timeline** tab.
2.  **Frame 0**: Use AI to generate "start pose", click **Add Keyframe**.
3.  **Frame 1.0**: Move scrubber to 1s, use Gizmos to change pose, click **Add Keyframe**.
4.  **Preview**: Hit **Play** to see the smooth transition.
5.  **Export**: Click **Export** to save the animation JSON.

### 📸 **For YouTubers & Streamers**
**Goal: Create a clean thumbnail asset.**
1.  **Load Avatar**: Click "Load VRM" or use the sample.
2.  **Pose**: Go to **Pose Lab** → **AI Gen** → Type "shocked pointing finger".
3.  **Refine**: Switch to **Reactions** tab, adjust "Surprise" slider to 1.0.
4.  **Export**: Go to **Export** → Select **Transparent Background** → Click **Thumbnail (HD)**.

### 💃 **For VTubers**
**Goal: Create a "BRB" screen loop.**
1.  **Scene**: Go to **Scene** tab → Upload a looping `.mp4` background.
2.  **Action**: Select the **Simple Wave** preset.
3.  **Camera**: Set camera to **¾ View**.
4.  **Export**: Go to **Export** → Select **WebM** → Click **Vertical (9:16)**.

### 👨‍💻 **For Developers**
**Goal: Extract animation data for a game.**
1.  **Import**: Drag & drop a Mixamo FBX file into **Pose Lab**.
2.  **Preview**: Check the retargeting in the viewport.
3.  **Export**: Click **Export Animation JSON** to get raw track data compatible with `three-vrm`.

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

### Environment Variables
Create a `.env` file in the root for AI features:
```env
VITE_GEMINI_API_KEY=your_api_key_here
```

---

## 🗺️ Roadmap & Vision

We are building the standard open-source tool for VRM content creation. Check out our **[ROADMAP.md](ROADMAP.md)** to see what's coming next:
- 🎬 **Timeline Editor**: Keyframe animation support.
- 🕹️ **Advanced IK**: Interactive gizmos for precise posing.
- 👥 **Multi-Avatar**: Scenes with multiple characters.

---

## 🤝 Contributing

We welcome contributions from developers, animators, and AI researchers!
Please read our **[CONTRIBUTING.md](CONTRIBUTING.md)** for details on how to submit pull requests, report issues, and shape the future of PoseLab.

---

## 🙏 Acknowledgments

- **[three-vrm](https://github.com/pixiv/three-vrm)**: The backbone of VRM on the web.
- **[Mixamo](https://www.mixamo.com/)**: For the animation library support.
- **[Google Gemini](https://deepmind.google/technologies/gemini/)**: Powering our text-to-pose engine.

---

<div align="center">
  <p>Built with 💚 by <strong>Project 89</strong></p>
  <p>
    <a href="https://github.com/0xQuan93/project89-reaction-forge/issues">Report Bug</a> ·
    <a href="https://github.com/0xQuan93/project89-reaction-forge/discussions">Request Feature</a>
  </p>
</div>

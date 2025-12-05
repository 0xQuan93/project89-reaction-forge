# 🎭 PoseLab

**Create custom VRM avatar reactions with poses, expressions, and animations**

A powerful web-based tool for creating and exporting VRM avatar reactions. Perfect for content creators, VTubers, and developers working with VRM models. Now featuring the **Motion Engine**, a procedural animation synthesis system, and **AI-Driven Pose Generation**.

---

## ✨ Features

### 🧠 **Motion Engine & AI** (New!)
- **AI Pose Generation**: Generate poses from text descriptions using Google Gemini.
- **Procedural Synthesis**: Generates natural animations on the fly using bio-mechanical constraints.
- **Kinetic Lag**: Simulates realistic body mechanics with core-to-extremity propagation.
- **Hand Synergy**: Automatic finger articulation based on grip/relax patterns.

### 🎨 **Reaction** - Create & Export Reactions
- Load custom VRM avatars (VRM 0.0 & 1.0 supported)
- 13 pre-made reaction presets (including new procedural poses)
- Custom pose/animation JSON support
- Expression controls (Joy, Surprise, Calm)
- 8 themed backgrounds + **Custom Background Upload**
- Export PNG images with logo overlay (hidden in UI, visible in export)
- Export WebM animations
- Real-time 3D preview with orbit controls
- **Mobile Optimized**: Fully responsive layout for creating on the go.

### 🛠️ **Pose Lab** - Create Custom Poses
- Retarget Mixamo FBX animations to VRM format
- Real-time animation preview
- Export pose JSON files
- Export animation JSON files
- Batch export multiple poses
- Playback controls (play/pause/loop)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/0xQuan93/project89-reaction-forge.git
cd project89-reaction-forge

# Install dependencies
npm install

# Start development server
npm run dev
```

### Open in Browser
- **PoseLab**: http://localhost:5173/
- **Pose Lab (Dev Mode)**: http://localhost:5173/?mode=pose-lab

---

## 📖 Usage Guide

### PoseLab

#### **Step 1: Load Avatar**
1. Click **"Load VRM Avatar"**
2. Select your `.vrm` file
3. Avatar loads in 3D viewport

#### **Step 2: Choose Reaction**
- **Option A**: Select from presets (Dawn Runner, Simple Wave, etc.)
- **Option B**: Drag & drop custom pose JSON from Pose Lab
- **Option C**: Use **AI Gen** to create a pose from text.

#### **Step 3: Customize**
- **Animation Mode**: Static / Loop / Play Once
- Adjust camera with mouse (orbit, zoom)
- Use camera presets (Front, Face, ¾ View)
- **Backgrounds**: Select a preset or upload your own image.

#### **Step 4: Export**
- **PNG**: Click "Save PNG" for static image (includes watermark)
- **WebM**: Click "Export Animation" for video
- **Share**: Click "Share" to open in new tab

---

## 📁 Project Structure

```
poselab/
├── src/
│   ├── components/          # React components
│   │   ├── AboutModal.tsx   # Project info
│   │   ├── CanvasStage.tsx  # 3D viewport
│   │   └── ControlPanel.tsx # Main UI controller
│   ├── pose-lab/            # Pose Lab tool
│   ├── poses/               # Pose definitions & Motion Engine
│   │   ├── motionEngine.ts  # Procedural animation solver
│   │   ├── skeleton_*.json  # Bio-mechanical data
│   │   └── *.json           # Pose/Animation files
│   ├── three/               # Three.js managers
│   ├── state/               # Zustand stores
│   └── utils/               # Utilities
├── public/
│   ├── backgrounds/         # SVG backgrounds
│   ├── logo/                # App branding
│   └── vrm/                 # Sample VRM files
├── docs/                    # Documentation
└── scripts/                 # Analysis & Generation scripts
```

---

## 🎨 Available Presets

| Preset | Pose | Expression | Background |
|--------|------|------------|------------|
| **Dawn Runner** | Dynamic stance | Joy | Protocol Sunset |
| **Sunset Call** | Standing wave | Joy | Protocol Sunset |
| **Cipher Whisper** | Sitting pose | Calm | Neural Grid |
| **Nebula Drift** | Walking | Calm | Quantum Field |
| **Signal Reverie** | Crouching | Surprise | Signal Breach |
| **Agent Dance** | Dancing | Joy | Cyber Waves |
| **Agent Taunt** | Taunting | Joy | Signal Breach |
| **Silly Agent** | Silly dance | Joy | Protocol Dawn |
| **Victory** | V-Sign | Joy | Midnight Circuit |
| **Simple Wave** | Procedural Wave | Joy | Protocol Sunset |
| **Point** | Procedural Point | Calm | Neural Grid |

---

## 🔧 Development

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Type Checking
```bash
npm run type-check
```

---

## 📚 Documentation

- **[CHANGELOG.md](CHANGELOG.md)** - Version history
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues
- **[ROADMAP.md](ROADMAP.md)** - Future features
- **[docs/](docs/)** - Technical guides

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[three-vrm](https://github.com/pixiv/three-vrm)** - VRM support for Three.js
- **[Mixamo](https://www.mixamo.com/)** - Free character animations
- **[VRoid Studio](https://vroid.com/)** - VRM avatar creation

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/0xQuan93/project89-reaction-forge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/0xQuan93/project89-reaction-forge/discussions)

---

## 🌟 Show Your Support

If this project helped you, please give it a ⭐️!

---

**Made with 💚 for the VRM community**

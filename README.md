# 🎭 Reaction Forge

**Create custom VRM avatar reactions with poses, expressions, and animations**

A powerful web-based tool for creating and exporting VRM avatar reactions. Perfect for content creators, VTubers, and developers working with VRM models.

---

## ✨ Features

### 🎨 **Reaction Forge** - Create & Export Reactions
- Load custom VRM avatars
- 8 pre-made reaction presets
- Custom pose/animation JSON support
- Expression controls (Joy, Surprise, Calm)
- 8 themed backgrounds
- Export PNG images with logo overlay
- Export WebM animations
- Real-time 3D preview with orbit controls

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
git clone https://github.com/yourusername/reaction-forge.git
cd reaction-forge

# Install dependencies
npm install

# Start development server
npm run dev
```

### Open in Browser
- **Reaction Forge**: http://localhost:5173/
- **Pose Lab**: http://localhost:5173/?mode=pose-lab

---

## 📖 Usage Guide

### Reaction Forge

#### **Step 1: Load Avatar**
1. Click **"📦 Load VRM Avatar"**
2. Select your `.vrm` file
3. Avatar loads in 3D viewport

#### **Step 2: Choose Reaction**
- **Option A**: Select from 8 presets (Dawn Runner, Sunset Call, etc.)
- **Option B**: Drag & drop custom pose JSON from Pose Lab

#### **Step 3: Customize**
- Set **Animation Mode**: Static / Loop / Play Once
- Adjust camera with mouse (orbit, zoom)

#### **Step 4: Export**
- **PNG**: Click "Save PNG" for static image
- **WebM**: Click "Export Animation" for video
- **Share**: Click "Share" to open in new tab

---

### Pose Lab

#### **Step 1: Load VRM**
1. Drag & drop `.vrm` file into **Step 1** zone
2. Avatar appears facing forward

#### **Step 2: Load Animation**
1. Download FBX from [Mixamo](https://www.mixamo.com/)
2. Drag & drop `.fbx` file into **Step 2** zone
3. Animation retargets to VRM automatically

#### **Step 3: Preview**
- Use playback controls: ▶️ Play, ⏸️ Pause, ⏹️ Stop, 🔄 Restart
- Toggle 🔁 Loop or 1️⃣ Play Once
- Adjust camera with mouse

#### **Step 4: Export**
- **Export Pose JSON**: Static pose data
- **Export Animation JSON**: Full animation clip
- Save both files for use in Reaction Forge

---

## 📁 Project Structure

```
reaction-forge/
├── src/
│   ├── components/          # React components
│   │   ├── CanvasStage.tsx  # 3D viewport
│   │   └── ReactionPanel.tsx # Control panel
│   ├── pose-lab/            # Pose Lab tool
│   │   └── PoseLab.tsx      # Main component
│   ├── poses/               # Pose definitions
│   │   ├── *.json           # Static poses
│   │   ├── *-animation.json # Animation clips
│   │   └── fbx/             # Source FBX files
│   ├── three/               # Three.js managers
│   │   ├── sceneManager.ts  # Scene & rendering
│   │   ├── avatarManager.ts # VRM loading & posing
│   │   └── animationManager.ts # Animation playback
│   ├── state/               # Zustand stores
│   └── utils/               # Utilities
├── public/
│   ├── backgrounds/         # SVG backgrounds
│   ├── logo/                # Logo files
│   └── vrm/                 # Sample VRM files
├── docs/                    # Documentation
└── scripts/                 # Build scripts
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

---

## 🎯 Workflows

### **Create Custom Reaction**
```
1. Pose Lab: Load VRM + Mixamo FBX
2. Pose Lab: Export pose.json + animation.json
3. Reaction Forge: Load VRM
4. Reaction Forge: Drag animation.json
5. Reaction Forge: Export WebM
```

### **Quick Content Creation**
```
1. Reaction Forge: Load VRM
2. Reaction Forge: Select preset
3. Reaction Forge: Export PNG/WebM
4. Share on social media!
```

### **Batch Export Poses**
```
1. Pose Lab: Load VRM
2. Pose Lab: Click "Batch Export All Poses"
3. All 8 poses export automatically
4. Use in your own projects
```

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

- **Issues**: [GitHub Issues](https://github.com/yourusername/reaction-forge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/reaction-forge/discussions)

---

## 🌟 Show Your Support

If this project helped you, please give it a ⭐️!

---

**Made with 💚 for the VRM community**

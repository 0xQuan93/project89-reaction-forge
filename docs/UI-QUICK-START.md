# Reaction Forge - New UI Quick Start Guide

## 🚀 Getting Started

```bash
npm run dev
# Navigate to http://localhost:5174/
```

---

## 🎯 Layout Overview

```
┌──────────────────────────────────────────────────────────┐
│  [Logo] Reaction Forge  [Reactions|Pose Lab]  [Avatar]  │  ← Header
├────────────────────────────┬─────────────────────────────┤
│                            │  [PRESETS] [POSE] [SCENE]   │
│                            │                              │
│         3D Canvas          │     Control Panel            │
│       (WebGL View)         │      (Active Tab)            │
│                            │                              │
│  [🎥]              [Logo]  │     [Tab Content...]         │
└────────────────────────────┴─────────────────────────────┘
```

---

## 📱 Two Modes

### 1. **Reactions Mode** (Create reaction images/animations)
**Tabs:**
- **Presets** - Quick preset selection
- **Pose & Expression** - Custom poses and animation modes
- **Scene** - Background selection and overlays
- **Export** - PNG/WebM export options

### 2. **Pose Lab Mode** (Import and manage animations)
**Tabs:**
- **Animations** - Import FBX/GLTF files
- **Poses** - Capture and manage poses
- **Export** - Export pose/animation JSON

---

## 🎨 Quick Actions

### Load an Avatar
1. Click **"Load VRM Avatar"** in header
2. Select a `.vrm` file
3. Wait for avatar to load (status indicator shows progress)

### Apply a Reaction Preset
1. Switch to **Reactions** mode (if not already)
2. Go to **Presets** tab
3. Click any preset card (e.g., "Dawn Runner", "Sunset Call")
4. Preset applies instantly to avatar

### Use a Custom Pose
1. Go to **Pose & Expression** tab
2. Drag & drop a pose JSON file (or click to browse)
3. Pose applies automatically

### Change Background
1. Go to **Scene** tab
2. Click any background thumbnail
3. Background changes in real-time

### Export Your Work
1. Go to **Export** tab
2. Choose format: PNG (static) or WebM (animation)
3. Select resolution: HD, Full HD, or Square
4. Toggle options (logo overlay, transparency)
5. Click **"Export PNG"** or **"Export Animation"**

---

## ⌨️ Tips & Tricks

### Switching Modes
- Click **"Reactions"** or **"Pose Lab"** in the header
- Mode switch is instant and preserves your avatar

### Animation Modes
- **Static Pose** - Frozen frame
- **Play Once** - Play animation once
- **Loop** - Continuous loop

### Status Indicator
- 🟢 **Green dot** = Avatar ready
- 🟠 **Orange dot** = Loading/processing

### Camera Control
- Click **🎥** button in top-left to reset camera
- Use mouse to orbit around avatar (Three.js OrbitControls)

---

## 📱 Mobile Usage

On screens < 960px wide:
1. Canvas takes full width
2. Tap **"Controls"** button at bottom
3. Control panel slides up from bottom
4. Tap again to close

---

## 🎭 Workflow Examples

### Create a Quick Reaction Image
```
1. Load VRM Avatar
2. Go to Presets tab
3. Click "Dawn Runner"
4. Go to Export tab
5. Click "Export PNG"
```

### Create an Animated Reaction
```
1. Load VRM Avatar
2. Go to Presets tab
3. Click "Agent Dance"
4. Go to Pose & Expression tab
5. Select "Loop Animation"
6. Go to Export tab
7. Select "WebM (Animation)"
8. Click "Export Animation"
```

### Use Custom Pose with Background
```
1. Load VRM Avatar
2. Go to Pose & Expression tab
3. Drop your pose JSON file
4. Go to Scene tab
5. Select "Green Loom Matrix" background
6. Go to Export tab
7. Export as PNG
```

### Import Mixamo Animation (Pose Lab)
```
1. Switch to Pose Lab mode
2. Load VRM Avatar (if not loaded)
3. Go to Animations tab
4. Drop FBX file from Mixamo
5. Animation plays automatically
6. Go to Poses tab to capture frames
7. Export pose JSON
```

---

## 🎨 Available Backgrounds

1. **Midnight Circuit** - Dark blue/black tech grid
2. **Protocol Sunset** - Warm sunset gradient
3. **Green Loom Matrix** - Signature green matrix
4. **Neural Grid** - Dark purple neural network
5. **Cyber Waves** - Blue cyberpunk waves
6. **Signal Breach** - Red alert theme
7. **Quantum Field** - Purple quantum effect
8. **Protocol Dawn** - Blue dawn gradient

---

## 📦 Export Options

### PNG Export
- **Best for:** Static images, social media posts
- **Supports:** Transparent background
- **Formats:** HD (1280×720), Full HD (1920×1080), Square (1080×1080)

### WebM Export
- **Best for:** Animated reactions, GIFs
- **Duration:** 3 seconds (default)
- **Note:** Convert to GIF at ezgif.com for Twitter
- **Requires:** Animation mode (Loop or Play Once)

---

## 🐛 Troubleshooting

**Avatar not loading?**
- Check file is `.vrm` format
- Try a different VRM file
- Check console for errors

**Animation not playing?**
- Select "Loop" or "Play Once" in Pose & Expression tab
- Check preset has animation (Agent Dance, Agent Taunt)
- Click "Stop Animation" then reselect preset

**Export button disabled?**
- Make sure avatar is loaded (green status dot)
- For WebM: ensure animation mode is not "Static"

**Background not changing?**
- Click background thumbnail directly (not just hover)
- Wait a moment for texture to load

---

## 💡 Pro Tips

1. **Preset + Custom Background:** Apply a preset, then change just the background in Scene tab
2. **Quick Export:** Keep Export tab open for rapid iterations
3. **Multiple Exports:** Export same scene in different resolutions for various platforms
4. **Pose Library:** Build a library of custom poses in Pose Lab for reuse
5. **Animation Preview:** Use "Play Once" to preview before exporting

---

## 🎉 Have Fun!

The new UI makes creating avatar reactions faster and more intuitive. Experiment with different combinations of poses, expressions, and backgrounds to create unique content!

**Questions or issues?** Check the full documentation in `docs/UI-REDESIGN-SUMMARY.md`

---

**Reaction Forge** - Project 89
*Powered by Claude Sonnet 4.5 (Harmon Vox)*


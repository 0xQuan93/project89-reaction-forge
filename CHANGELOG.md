# Changelog

All notable changes to the Project 89 Reaction Forge will be documented in this file.

## [1.2.1] - 2026-01-12

### 🚀 New Features
- **Batch Export Tool**: 
  - Integrated a "Batch Export All Poses" button in the Pose Lab Save tab.
  - Automatically retargets all 14+ system animations to your current VRM avatar in one click.
  - Generates updated JSON pose files instantly.
- **Expanded Pose Library**:
  - Added 9 new reaction presets: **Defeat, Focus, Rope Climb, Climb Top, Thumbs Up, Offensive Idle, Waking, Treading Water, Cheering**.
  - Refreshed animations for **Wave** and **Point** to fix jankiness.
- **Audio Recording**:
  - Video exports now capture microphone audio if available (perfect for voiceovers).

### 🐛 Bug Fixes & Improvements
- **Motion Capture Reliability**:
  - Fixed an issue where "Upper Body" mode would incorrectly allow hip translation, looking like full body mode.
  - Fixed "Upper Body" / "Full Body" toggle reverting to default when switching tabs.
  - Fixed Green Screen toggle resetting the background to default instead of the previous choice.
- **UI Polish**:
  - Updated recording button style and position.
  - Added Phosphor icons to new batch tools.

---

## [1.1.0] - 2025-12-18

### 🌟 Major Improvements
- **Motion Capture v2.0**:
  - **Smoothing Engine**: New interpolation system for jitter-free face and body tracking.
  - **Rotation Constraints**: Natural bone limits prevent impossible joints.
  - **Enhanced Smile Detection**: Custom MediaPipe landmark calculation for responsive smiling.
  - **ARKit Integration**: Better mapping for standard ARKit blendshapes.
- **Green Screen Support**: 
  - New "Green Screen" background option for easy chroma keying.
  - Dedicated toggle in Mocap tab.
- **Interactive Tutorial**:
  - Step-by-step onboarding overlay for new users.
  - Highlights key UI elements (Load Avatar, Modes, Tools).

### ✨ Enhancements
- **Dynamic Blendshapes**: Mocap system now auto-detects avatar capabilities.
- **Performance**: Optimized render loop for tracking updates.

---

## [1.0.0] - 2025-12-01

### 🎉 Initial Release

#### ✨ Features
- **VRM Avatar Support**: Full VRoid/VRM 1.0 compatibility with `@pixiv/three-vrm`
- **8 Custom Poses**: Project 89-themed poses retargeted from Mixamo
  - Dawn Runner, Green Loom, Sunset Call, Cipher Whisper
  - Nebula Drift, Loom Vanguard, Signal Reverie, Protocol Enforcer
- **Fixed Camera System**: Consistent framing with zero drift
- **Randomize Function**: Generate random reaction combinations
- **PNG Export**: Save reactions as images
- **Pose Lab Tool**: In-browser Mixamo → VRM pose retargeting
- **Portal Bridge**: Integration API for beta.project89.org

#### 🏗️ Architecture
- React 18 + TypeScript 5
- Three.js WebGL rendering
- Zustand state management
- Vite build system
- Custom VRM pose pipeline

#### 🛠️ Technical Highlights
- **Rotation-Only Poses**: Pure quaternion data, no position drift
- **Scene Rotation System**: Automatic camera-facing orientation
- **VRM Humanoid API**: Native pose application via `setNormalizedPose()`
- **Custom Retargeting**: Mixamo → VRM bone mapping system
- **Batch Processing**: Multi-pose export workflow

#### 📁 Project Structure
- Organized component architecture
- Centralized state management
- Modular Three.js managers
- Documented custom scripts
- Proprietary asset protection

#### 🔐 Security
- `.gitignore` configured for proprietary assets
- Mixamo FBX files excluded from version control
- Custom scripts documented and organized

### 🐛 Bug Fixes
- Fixed avatar drift issue by removing position data from poses
- Fixed pose not changing visually by adding `vrm.update(0)` call
- Fixed inconsistent facing direction with scene rotation system
- Fixed camera framing drift by switching to fixed camera position

### 📚 Documentation
- Comprehensive README with quick start guide
- Scripts documentation in `scripts/README.md`
- Pose format documentation in `src/poses/README.md`
- Inline TypeScript documentation
- Architecture diagrams and technical details

### 🚀 Deployment
- Production build optimized
- Asset bundling configured
- Development and production environments
- Pose Lab accessible via query parameter

---

## [Unreleased]

### 🗺️ Planned Features
- Custom Project 89 backgrounds
- Logo overlays and watermarking
- Facial expression system
- UI/UX polish and branding
- Wallet-gated avatar fetching
- Social sharing integration
- Reaction history/gallery
- Animation support (multi-frame)
- Pose blending and transitions
- Custom hand pose library
- Video export capability

---

## Version History

- **1.0.0** (2025-12-01): Initial production release
- **0.1.0** (2025-11-30): Development prototype with basic pose system
- **0.0.1** (2025-11-29): Project scaffolding and architecture setup

---

**Maintained by**: Project 89 Development Team  
**License**: Proprietary


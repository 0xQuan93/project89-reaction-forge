# PoseLab v1.2.1 - Complete Platform Overview

> **The Future of Avatar Interaction is Here**

PoseLab is a browser-based VRM avatar studio that combines posing, real-time motion capture, multiplayer collaboration, and voice communication - all running peer-to-peer with zero server infrastructure.

---

## 🎯 Executive Summary

| Aspect | Description |
|--------|-------------|
| **What** | Browser-based VRM avatar posing, animation, and collaboration platform |
| **Who** | Content creators, VTubers, developers, artists, and communities |
| **Why** | Avatar tools without downloads, accounts, or servers |
| **How** | WebGL (Three.js) + WebRTC (PeerJS) + MediaPipe ML |
| **Current Version** | v1.2.1 (January 2026) |

**Note on Transparency:** For a detailed breakdown of system limitations and technical architecture constraints, please refer to [TECHNICAL-AUDIT.md](./TECHNICAL-AUDIT.md).

---

## 🚀 Current Capabilities (v1.2.1)

### Core Avatar Features

| Feature | Description | Technology |
|---------|-------------|------------|
| **VRM Loading** | Load VRM 0.x and 1.0 avatars | @pixiv/three-vrm |
| **Pose Presets** | Library of preset poses (Action, Emotes, Idle) | Three.js AnimationMixer |
| **Live2D Support** | Display Live2D models (via Overlay layer) | PixiJS + Cubism |
| **Expressions** | Facial expression control (Joy, Calm, Surprise) | VRM ExpressionManager |
| **Batch Export** | Retarget Mixamo library to any VRM | BatchFBXConverter |

### Visual & Rendering

| Feature | Description |
|---------|-------------|
| **3-Point Lighting** | Key/fill/rim lighting system |
| **6 Lighting Presets** | Studio, Dramatic, Soft, Neon, Sunset, Moonlight |
| **Post-Processing** | Bloom, color grading, vignette, film grain, glitch, scanlines |
| **Custom Backgrounds** | Upload images, videos (MP4/WebM), or use presets |
| **CSS Overlays** | CRT, Glitch, and Vignette effects applied post-render |

### Motion Capture

| Feature | Description |
|---------|-------------|
| **Face Tracking** | Real-time facial expression capture (Webcam) |
| **Full Body Tracking** | Upper body + face tracking (Webcam) |
| **VMC Input** | External tracking via WebSocket bridge (JSON-OSC) |
| **Voice Lip Sync** | Microphone-driven mouth animation |
| **Recording** | Record mocap to animation clips (internal JSON format) |

### Multiplayer / Co-op

| Feature | Description |
|---------|-------------|
| **P2P Sessions** | Create/join rooms via shareable links (Mesh Network) |
| **Avatar Sync** | Real-time pose, expression, and animation sync |
| **VRM Transfer** | Automatic avatar file sharing between peers (max 6KB chunks) |
| **Voice Chat** | Built-in peer-to-peer voice communication |
| **Max Peers** | Hard limit of **8 peers** for performance stability |

### Export Options

| Format | Capability | Limitation |
|--------|------------|------------|
| **PNG** | High-quality snapshot | - |
| **WebM** | **Offline Render** (Perfect 60fps) | Slower processing time (rendering frame-by-frame) |
| **GLB** | 3D model export | - |
| **JSON** | Pose library export | Internal format only |

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PoseLab v1.2.1                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React     │  │   Zustand   │  │      Three.js           │  │
│  │   (UI)      │◄─┤   (State)   │◄─┤   (3D Rendering)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │                │                      │               │
│         │         ┌──────▼──────┐               │               │
│         │         │   Manager   │               │               │
│         │         │   Pattern   │◄──────────────┘               │
│         │         └──────┬──────┘                               │
│         │                │                                      │
│  ┌──────▼────────────────▼──────────────────────────────────┐   │
│  │                    Managers                               │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │   │
│  │  │SceneManager │ │AvatarManager│ │Live2DManager        │ │   │
│  │  │(Renderer)   │ │(VRM Logic)  │ │(2D Overlay)         │ │   │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │   │
│  │  │Environment  │ │MotionCapture│ │  AIManager          │ │   │
│  │  │Manager      │ │Manager      │ │  (Gemini Service)   │ │   │
│  │  └─────────────┘ └──────┬──────┘ └─────────────────────┘ │   │
│  │                         │                                │   │
│  │                  ┌──────▼──────┐                         │   │
│  │                  │ MocapWorker │ (planned)               │   │
│  │                  └─────────────┘                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Multiplayer Layer (P2P)                 │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │   │
│  │  │PeerManager  │ │SyncManager  │ │VoiceChatManager     │ │   │
│  │  │(WebRTC Data)│ │(State Sync) │ │(WebRTC Audio)       │ │   │
│  │  └──────┬──────┘ └──────┬──────┘ └──────────┬──────────┘ │   │
│  │         │               │                    │            │   │
│  │         └───────────────┼────────────────────┘            │   │
│  │                         │                                 │   │
│  │                    ┌────▼────┐                            │   │
│  │                    │ PeerJS  │                            │   │
│  │                    │(Mesh Net)│                            │   │
│  │                    └─────────┘                            │   │
│  └──────────────────────────────────────────────────────────┘   │
```

---

## 🔮 Future Roadmap

### Near-Term
*   **Video Export:** (✅ Done) Implement offline frame-by-frame rendering for smooth 60fps.
*   **Performance:** (🛠️ In progress) Move MediaPipe to Web Worker.
*   **Retargeting:** Improved IK solver for non-standard avatars.

### Long-Term
*   **True 3D Live2D:** Render Live2D to texture for full scene integration.
*   **Native GIF:** Client-side WASM GIF generation.

---

## 🎓 User Guide & Best Practices

### Performance
*   **Heavy Load:** Full body mocap + Post-processing + 8 Peers.
*   **Optimization:** Disable "Bloom" and "Shadows" on lower-end devices. Use "Face Only" tracking if full body is not needed.

### Mocap Setup
*   **Lighting:** Ensure your face is well-lit (front-facing light).
*   **Position:** Keep your upper body visible in the camera frame.
*   **Calibration:** Always run the "Calibrate" sequence when changing avatars or camera position.

### Multiplayer
*   **Bandwidth:** P2P meshes are bandwidth-intensive. Limit to 4-5 peers for best results on standard connections.
*   **Voice:** Use headphones to prevent echo (browser echo cancellation varies).

---

## 🛡️ Privacy & Security

| Aspect | Implementation |
|--------|----------------|
| **Data Storage** | Browser localStorage only |
| **Server** | None - pure P2P (Signaling via PeerJS cloud) |
| **VRM Files** | Transferred P2P, never stored on a server |
| **Voice Chat** | Direct peer connection (WebRTC) |
| **AI Processing** | Google Gemini API (Data subject to Google's AI terms) |

---

*Built with ❤️ by Project89*

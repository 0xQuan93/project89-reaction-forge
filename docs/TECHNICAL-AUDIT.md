# Technical Audit: Project89 Reaction Forge

> **Status:** Current as of v1.2.1
> **Date:** January 2026
> **Purpose:** Transparent analysis of system capabilities, limitations, and architectural health.

## 1. Core Architecture Analysis

### System Overview
Reaction Forge is a client-side heavy application relying on browser technologies for high-performance 3D rendering and machine learning.

*   **Render Pipeline:** `Three.js` (WebGL 2.0) with `@pixiv/three-vrm`.
*   **State Management:** `Zustand` stores (highly decoupled, good for performance).
*   **Motion Capture:** `MediaPipe Holistic` running on the main thread.
*   **Networking:** `PeerJS` (WebRTC) mesh network.

### Architectural Health
*   **"God Object" Risk:** `AvatarManager` (src/three/avatarManager.ts) has grown significantly. It currently handles loading, posing, animation playback, expression management, and transitions. Refactoring this into `AnimationController`, `PoseController`, and `LoaderService` is recommended to prevent regression bugs.
*   **Circular Dependencies:** Hints of circular dependencies exist between `AvatarManager` and `useSceneSettingsStore`, solved via lazy loading/dynamic imports. This is a fragile pattern that should be refactored using an event bus or strictly hierarchical state.

## 2. Capabilities & Limitations (The "Truth")

### A. Video Export
*   **Capability:** Real-time canvas capture to WebM.
*   **Limitation:** This is **not** offline rendering.
    *   **Frame Drops:** If the scene lags during recording, the video will have dropped frames.
    *   **Browser Support:** Relies on `MediaRecorder` API. Safari support is limited compared to Chrome/Firefox.
    *   **GIF:** There is no native GIF engine. The app exports WebM and suggests using external tools (ezgif) for conversion. This avoids shipping a heavy WASM GIF encoder but creates user friction.

### B. Live2D Integration
*   **Capability:** Display Live2D models alongside VRM avatars.
*   **Limitation:** **Overlay Only.**
    *   The Live2D model lives on a separate `PixiJS` canvas layer sitting *on top* of the 3D scene.
    *   It does not exist in the 3D world space (cannot walk behind 3D objects, lighting doesn't affect it).
    *   Depth sorting is binary: Live2D is always in front or always behind.

### C. Motion Capture (Mocap)
*   **Capability:** Full upper-body and face tracking via webcam.
*   **Limitation:** **Heavy Compute Load.**
    *   Running MediaPipe + Three.js + React on the main thread is demanding.
    *   **Retargeting:** The current implementation uses direct rotational mapping with constraints. It lacks a sophisticated retargeting solver (like IK-based limb scaling), meaning avatars with proportions significantly different from a human may look distorted (arms clipping into body).
    *   **VMC:** The VMC implementation acts as a WebSocket listener for JSON-wrapped OSC messages. It is not a native UDP OSC receiver (browsers limitation), requiring a specific bridge setup.

### D. Multiplayer
*   **Capability:** P2P room-based collaboration with voice and pose sync.
*   **Limitation:** **Mesh Network Scaling.**
    *   Using a full mesh topology (everyone connected to everyone) means bandwidth usage scales quadratically ($N \times (N-1)$).
    *   **Max Peers:** Hardcapped at 8 to prevent browser crash/network saturation.
    *   **Consistency:** There is no authoritative server. If two users change the background simultaneously, race conditions can occur.

### E. AI / Generative Features
*   **Capability:** Chat with avatar, command-based control (`[GESTURE]`), pose generation.
*   **Limitation:** **Latency.**
    *   AI responses are request/response based (HTTP). There is a noticeable delay between user input and avatar reaction. It is not a streaming, real-time conversational interrupt model.

## 3. Areas for Improvement

### High Priority (✅ Implemented)
1.  **Video Export Upgrade:** Implemented offline frame-by-frame rendering with `ffmpeg.wasm` stitching. This ensures smooth 60fps export regardless of device power.
2.  **Performance Optimization:** **In progress.** MediaPipe Holistic is currently processed on the main thread. A worker-based approach is planned but not active.
3.  **Error Handling:** Improved error recovery for PeerJS disconnections with robust auto-reconnect logic.

### Medium Priority
1.  **Avatar Retargeting:** Implement an IK-based solver (like `kalidokit`'s solver but tuned for VRM constraints) to handle non-standard avatar proportions better.
2.  **Architecture Refactor:** Split `AvatarManager` into smaller, testable services.
3.  **Live2D Integration:** Explore rendering Live2D to a `Three.js` texture (render-to-texture) to allow true 3D integration (lighting, depth).

### Low Priority
1.  **Native GIF:** Add `ffmpeg.wasm` for client-side high-quality GIF generation (trade-off: huge download size). (Note: FFmpeg is now integrated for WebM, GIF is a logical next step).
2.  **Server-Authoritative Mode:** Optional server for larger rooms (>8 peers).

## 4. Transparency Statement
This software is provided "as is". While it utilizes advanced web technologies, it is bound by the constraints of the browser sandbox (memory limits, single-threaded default, network security). It is a powerful tool for creators but not a replacement for native desktop industry-standard mocap suites for high-end production pipelines.

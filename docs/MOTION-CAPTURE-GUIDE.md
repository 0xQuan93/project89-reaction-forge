# 🎥 Motion Capture Guide (v3.0 - System Animator Parity)

> "Motion is the language of the soul, translated into digital form."

The **Motion Capture** system has been radically upgraded in version 3.0 to match the robustness of *SystemAnimatorOnline*. We have rebuilt the core loop to ensure physics synchronization and added professional-grade adaptive smoothing.

---

## ✨ Major Upgrades in v3.0

### 1. 🧠 Adaptive Smoothing Engine (The "Sticky/Snappy" Feel)
We have replaced the old static smoothing with a dynamic **Adaptive Velocity Filter**.
- **When you are still**: The system locks your avatar in place (Smoothing: 95%). No more jittery hands or shaking heads while idle.
- **When you move**: The system instantly drops smoothing to track fast movements (Smoothing: 40%).
- **Result**: You get the precision of raw tracking for action, with the stability of a statue for stillness.

### 2. 🧶 Physics Rail Synchronization
Previously, the webcam loop ran independently of the 3D rendering loop, causing hair and clothes to "lag" or vibrate.
- **New Architecture**: The motion capture system now rides on the main `SceneManager` "Tick" loop.
- **Benefit**: Every bone movement is perfectly synchronized with the physics engine (SpringBone).
- **Visuals**: Hair sways naturally; clothes react instantly to your body.

### 3. 👓 WebXR / AR Mode
You can now bring your avatar into the real world.
- **Supported Devices**: Android Phones (Chrome), Meta Quest, Vision Pro.
- **Usage**: Click the **"Enter AR Mode"** button in the Mocap tab.
- **Function**: The background becomes your camera feed, and the avatar stands on your floor/desk.

---

## 🛠️ How to Use

### Setup
1. **Lighting**: Ensure your face is well-lit. Avoid strong backlighting.
2. **Camera Position**: Place camera at eye level.
3. **Distance**: Stand/sit where your head and shoulders are clearly visible.

### Modes
- **Full Body**: Tracks body + face + fingers. Best for full performance.
- **Face Only**: Tracks face/head rotation. Body plays idle animation (e.g., "Sunset Call").
- **AR Mode**: (New) Projects avatar into your room. Requires HTTPS and a compatible device.

### Troubleshooting

| Issue | Solution |
|-------|----------|
| **Jittery Hands** | The new Adaptive Engine handles this. If still jittery, improve lighting. |
| **Physics Lag** | If hair looks "floaty", check your frame rate. The system expects >30fps. |
| **AR Button Missing** | Only appears on WebXR-compatible browsers (Chrome Android, Quest Browser). |

---

## 🔧 Technical Architecture (The "Rail" System)

For developers, the system has moved from a `requestAnimationFrame` loop to a synchronized `SceneManager.registerTick` pattern.

### The Update Loop
1. **MediaPipe** captures landmarks (async).
2. **Kalidokit** solves the pose.
3. **MotionCaptureManager** calculates target rotations.
4. **SceneManager** calls `tick(delta)`.
5. **MotionCaptureManager** updates bones using `delta` time.
6. **AvatarManager** updates Physics/SpringBones.
7. **Renderer** draws the frame.

This ensures `Bone Update` -> `Physics Update` -> `Render` always happens in that exact order, every frame.

### Adaptive Lerp Formula
```typescript
// Slower movement = Higher smoothing (Low Lerp)
// Faster movement = Lower smoothing (High Lerp)
lerp = map(velocity, 0, max_speed, 0.05, 0.4);
```

### Files
- `src/utils/motionCapture.ts`: Core logic and adaptive engine.
- `src/utils/webXRManager.ts`: AR session handling.
- `src/three/sceneManager.ts`: Main render loop and XR support.

# 🎥 Motion Capture Guide (v2.0)

> "Motion is the language of the soul, translated into digital form."

The **Motion Capture** system in PoseLab has been significantly upgraded in version 2.0 to provide professional-grade tracking using just a webcam. This guide covers the new features and how to get the best results.

---

## ✨ New Features in v2.0

### 1. Smoothing Engine
We've introduced a sophisticated **Smoothing Engine** that eliminates the jitter common in webcam-based mocap.
- **Interpolation**: Movements are smoothed over time (using `slerp` for rotations and `lerp` for blendshapes).
- **Result**: Fluid, organic motion even if your camera drops frames.

### 2. Rotation Constraints
Bones now obey natural human limits.
- **Joint Limits**: Elbows, knees, and neck have defined ranges of motion.
- **Safety**: Prevents "broken" joints or impossible poses during tracking glitches.

### 3. Enhanced Smile Detection
Standard tracking often misses subtle smiles. We've added a custom **Landmark Calculation** algorithm:
- Measures the relationship between mouth corners and face height.
- Accurately detects smiles even without full "Joy" blendshape activation.
- Maps to multiple smile blendshapes (`Joy`, `Happy`, `mouthSmile`) for maximum compatibility.

### 4. ARKit Integration
Improved support for ARKit-standard blendshapes (often found in iPhone-ready avatars).
- **Eye Tracking**: Mapped `eyeLookIn`/`eyeLookOut` for precise gaze.
- **Mouth Shapes**: Full support for `mouthFunnel`, `mouthPucker`, and more.

### 5. Hand Tracking (3D + 2D)
PoseLab now tracks both hands with stabilized finger rotations.
- **3D Hand Rig**: Finger joints are retargeted to VRM hand bones for live mocap.
- **2D Landmarks**: Hand landmarks are captured for overlays or gesture-driven UI.

### 6. Green Screen Mode
A dedicated toggle for easy compositing.
- **Toggle**: Switch instantly between your selected background and a pure green screen.
- **Workflow**: Record your motion against green, then key it out in OBS, Premiere, or After Effects.

### 7. Tracking Modes
- **Full Body**: Tracks both body and face. Requires full view of the user.
- **Face Only**: Tracks only facial expressions and head rotation. 
  - **Body Behavior**: Automatically loops the "Sunset Call" idle animation (or your currently playing animation) so the body stays alive while you talk.
  - **Ideal For**: VTubing, streaming, or when space is limited.

---

## 🛠️ How to Use

### Setup
1. **Lighting**: Ensure your face is well-lit. Avoid strong backlighting.
2. **Camera Position**: Place camera at eye level.
3. **Distance**: Stand/sit where your head and shoulders are clearly visible. For full body, stand back to show your whole body.

### Workflow
1. **Load Avatar**: Open PoseLab and load your VRM.
2. **Open Mocap Tab**: Click on the **Motion Capture** tab.
3. **Start Camera**: Click "Start Camera". Allow browser permissions.
4. **Calibrate**:
   - Stand in a **T-Pose** (arms out, straight).
   - Click **"Calibrate"**.
   - *Tip: Calibration sets the baseline for your skeleton. Do this every time you change position.*
5. **Record**:
   - Click **"Start Recording"**.
   - Perform your motion.
   - Click **"Stop Recording"**.
   - The animation is automatically saved to your **Animations** list in Pose Lab.

### Green Screen Usage
1. In the Mocap tab, toggle the **"Green Screen"** switch.
2. The background will turn bright green (#00FF00).
3. Use your screen recording software (OBS) to capture the preview window.
4. Apply a "Chroma Key" filter to remove the green background.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Jittery Hands** | Ensure hands are visible and not overlapping with body. Move slower. |
| **Wrong Head Angle** | Click "Calibrate" while looking straight ahead. |
| **Mouth not opening** | Check if your avatar supports `A`, `I`, `U`, `E`, `O` blendshapes. |
| **Eyes not blinking** | Ensure your room is bright enough for eye detection. |

---

## 🔧 Technical Details

The system uses **MediaPipe Holistic** for tracking and **Kalidokit** for solving IK.
- **Smoothing Factor**: Default is `0.25` (responsive yet smooth).
- **Smile Threshold**: Detects ratio changes > 0.02.
- **Update Loop**: Runs on `requestAnimationFrame` for 60fps tracking.

For developers, see `src/utils/motionCapture.ts`.

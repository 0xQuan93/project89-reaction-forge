# 📖 PoseLab User Guide

> **Version 1.5** | Browser-based VRM avatar posing, animation, motion capture, and **multiplayer collaboration** tool

---

## 🎯 What is PoseLab?

PoseLab is a powerful browser-based tool for:
- **Loading and posing VRM avatars** in 3D
- **Playing and recording animations** from files or webcam motion capture
- **Creating professional renders** with advanced lighting and effects
- **Multiplayer co-op sessions** with real-time avatar sync and voice chat
- **Exporting** images, videos, and GLB files

No installation required - works entirely in your browser, including on **mobile devices**!

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Load an Avatar
1. Open PoseLab in your browser
2. Go to **Scene** tab (left panel)
3. Click **"📦 Load VRM Avatar"**
4. Select a `.vrm` file from your computer

> 💡 **Don't have a VRM?** Get free avatars from [VRoid Hub](https://hub.vroid.com/) or create one with [VRoid Studio](https://vroid.com/en/studio)

### Step 2: Apply a Pose
1. Go to **Pose/Expression** tab
2. Click any pose preset (Wave, Point, Dance, etc.)
3. Watch your avatar strike the pose!

### Step 3: Take a Screenshot
1. Go to **Export** tab
2. Click **"📸 Capture PNG"**
3. Your image downloads automatically with the Project89 watermark

---

## 📑 Complete Feature Guide

## 🎭 Scene Tab

### Avatar Management
| Feature | Description |
|---------|-------------|
| **Load VRM Avatar** | Import any VRM 0.x or 1.0 file |
| **Change Avatar** | Swap to a different VRM at any time |
| **Fit Avatar to Screen** | Auto-frame the camera to show the full avatar |
| **Rotation Lock** | Lock avatar rotation so poses/animations don't override manual adjustments |

### 💡 Lighting System
Professional 3-point lighting with 6 presets:

| Preset | Description |
|--------|-------------|
| 🎬 **Studio** | Clean, balanced lighting for general use |
| 🎭 **Dramatic** | High contrast with warm/cool color contrast |
| ☁️ **Soft** | Gentle, diffused lighting for portraits |
| 💜 **Neon** | Vibrant cyan/magenta/yellow for cyberpunk looks |
| 🌅 **Sunset** | Warm orange key light with cool fill |
| 🌙 **Moonlight** | Cool blue night-time atmosphere |

**Manual Controls:**
- Toggle individual lights (Key, Fill, Rim, Ambient)
- Adjust intensity per light

### 🎨 Toon Shader
Customize VRM MToon material properties:

| Preset | Effect |
|--------|--------|
| 🎨 **Default** | Standard VRM appearance |
| 🌸 **Anime** | Enhanced outlines, softer shading |
| ✒️ **Bold Outline** | Thick black outlines |
| 🌫️ **Subtle** | Thin outlines, soft look |
| 🔲 **No Outline** | Disable outlines completely |
| ✨ **Glowing** | Emissive glow effect |

> ⚠️ **Note:** Toon Shader only works with VRMs that use MToon materials (most VRoid Studio exports). PBR/Standard material VRMs won't show changes.

### ✨ Post-Processing Effects
Cinematic post-processing with 6 presets:

| Preset | Description |
|--------|-------------|
| 🚫 **None** | Raw render, no effects |
| 🎬 **Cinematic** | Subtle bloom, slight desaturation, vignette |
| 🌈 **Vibrant** | Boosted saturation and bloom |
| 🎩 **Noir** | Desaturated, high contrast, film grain |
| ✨ **Dreamy** | Heavy bloom, soft glow |
| 📼 **Retro** | Vintage look with grain |

**Manual Controls:**
- **Bloom:** Intensity, threshold, radius
- **Color Grading:** Brightness, contrast, saturation
- **Vignette:** Edge darkening
- **Film Grain:** Animated noise

### 🌍 HDRI Environments
Realistic lighting and reflections from environment maps:

| Preset | Scene |
|--------|-------|
| 🎬 **Studio** | Photography studio |
| 🌳 **Outdoor** | Clear sky landscape |
| 🌅 **Sunset** | Venice sunset |
| 🌙 **Night** | Night sky |
| 🏙️ **Urban** | City plaza |

**Controls:**
- Upload custom `.hdr` or `.exr` files
- Adjust intensity and background blur
- Rotate environment

### 🎨 Backgrounds
Choose from built-in backgrounds or upload your own:
- **Solid colors** and **gradients**
- **Static images** (PNG, JPG)
- **Animated backgrounds** (GIF, MP4, WebM)
- **Background Lock** - Prevent poses/animations from changing your background

### 🧊 3D Environments
Load 3D GLB models as immersive environments:
- **Upload GLB**: Click to load 3D environment files
- **Scale**: Adjust environment size relative to avatar
- **Position**: Move environment on X, Y, Z axes
- **Rotation**: Rotate environment around the Y axis
- **Visibility**: Toggle environment on/off
- **Shadows**: Enable shadow receiving for realism
- **Multiple Environments**: Load and manage multiple GLB files

### 🎞️ FX Overlays
CSS-based visual effects:
- **Scanlines** - Retro CRT lines
- **Vignette** - Edge darkening
- **Glitch** - Digital distortion
- **CRT** - Old monitor look

### 📐 Aspect Ratio
Set canvas dimensions for export (also available in viewport controls):
- **16:9** - Widescreen (YouTube, desktop)
- **1:1** - Square (Instagram, profile pics)
- **9:16** - Vertical (TikTok, Stories)

---

## 🌐 Co-op / Multiplayer

PoseLab supports **real-time multiplayer sessions** where multiple users can:
- See each other's avatars in the same scene
- Sync poses, animations, and expressions live
- Use voice chat to communicate
- Share scenes and backgrounds

### Creating a Session
1. Go to **Scene** tab → **Co-op Session**
2. Click **"🚀 Create Session"**
3. Click **"📋 Copy Invite Link"**
4. Share the link with others

### Joining a Session
1. Open the invite link in your browser
2. Enter your display name
3. Click **Join**
4. Load your avatar

### What Syncs Automatically
| Feature | Synced? |
|---------|---------|
| Avatar positions | ✅ |
| Pose/animations | ✅ |
| Facial expressions | ✅ |
| Motion capture | ✅ |
| Backgrounds | ✅ (host → guests) |
| Aspect ratio | ✅ (host → guests) |

### 🎤 Voice Chat
Talk to other users in real-time:

1. **Enable:** Click the **🎤** mic button in the viewport (top-right) or in the Co-op panel
2. **Grant Permission:** Allow microphone access when prompted
3. **Mute/Unmute:** Click mic button again to toggle mute
4. **Volume:** Adjust incoming audio volume with the slider

**Voice Chat Features:**
- Speaking indicator shows when you're talking
- Peer count shows connected voice users
- Echo cancellation & noise suppression
- Works on mobile devices

### Mobile Multiplayer
Multiplayer works on mobile browsers:
- **Android:** Chrome ✅
- **iOS:** Safari ✅

**Tips for Mobile:**
- Keep the browser tab in foreground (backgrounding may disconnect)
- Use headphones to prevent echo
- Grant microphone permission when prompted
- Tap the screen if you don't hear audio (iOS requirement)

---

## 🎭 Pose/Expression Tab

### Pose Presets
Click any preset to apply instantly:
- **Wave** - Friendly greeting
- **Point** - Pointing gesture
- **Dance** - Dance pose
- **Victory** - Celebration
- **Taunt** - Playful taunt
- **Defeat** - Sad/defeated
- **Silly** - Goofy pose
- **Clapping** - Applause

### Expressions
Control facial expressions:
- **Calm** - Neutral face
- **Joy** - Happy/smiling
- **Surprise** - Shocked expression

### Manual Posing (Gizmo)
1. Click **"Enable Gizmo"** button
2. Click bones on the avatar to select them
3. Use the transform handles to rotate/move
4. Rotation lock is automatically enabled to preserve your adjustments

### Animation Controls
- **Play/Pause** - Toggle animation playback
- **Stop** - Freeze on current frame
- **Loop** - Continuous playback

---

## 🎬 Animations Tab

### Importing Animations
1. Click **"📁 Import Animation"**
2. Select a `.fbx`, `.glb`, or `.json` animation file
3. Animation appears in the list

### Playback
- Click ▶️ to play an animation
- Use viewport controls for pause/stop
- Animations automatically retarget to your VRM's skeleton

### Recording to Pose
1. Play an animation to desired frame
2. Go to **Poses** tab
3. Click **"📸 Capture Current Pose"**
4. Pose is saved for later use

---

## 🎥 Motion Capture Tab

### Face Tracking Mode
Track facial expressions only:
1. Select **"Face Only"** mode
2. Click **"▶️ Start Capture"**
3. Allow webcam access
4. Your expressions mirror to the avatar

### Full Body Mode
Track face + upper body:
1. Select **"Full Body"** mode
2. Position yourself in frame
3. Movements translate to avatar

### Recording
1. Start capture
2. Click **"🔴 Record"**
3. Perform your motion
4. Click **"⏹️ Stop"**
5. Recording saved as animation clip

### T-Pose Calibration
For better tracking accuracy:
1. Stand in T-pose (arms out)
2. Click **"Calibrate T-Pose"**
3. System learns your proportions

### 🎤 Voice Lip Sync
Drive mouth movements from your microphone:

1. Click **"🎤 Start Voice Sync"**
2. Grant microphone permission
3. Speak - your avatar's mouth moves accordingly
4. Adjust **Sensitivity** slider for your voice level

**Features:**
- Vowel detection (A, E, I, O, U shapes)
- Volume-based mouth opening
- Smoothed, natural-looking animation
- Works with or without webcam mocap

> 💡 **Pro Tip:** Use Voice Lip Sync + Face-only mocap together for the best results - webcam handles expressions while microphone handles precise mouth movements.

---

## 💾 Poses Tab

### Capturing Poses
1. Position avatar (manually or via animation)
2. Click **"📸 Capture Current Pose"**
3. Enter a name
4. Pose saved to library

### Managing Poses
- **Apply (✓)** - Load saved pose
- **Export (💾)** - Download as JSON
- **Delete (🗑️)** - Remove pose

### Exporting
- **Export All Poses** - Download entire library as JSON
- **Import** - Load previously exported poses

---

## 📤 Export Tab

### Image Export
| Format | Description |
|--------|-------------|
| **PNG** | Lossless, transparent background option |
| **JPG** | Smaller file size |

Options:
- **Transparent Background** - Remove background (PNG only)
- **Include Logo** - Add Project89 watermark

### Video Export
| Format | Description |
|--------|-------------|
| **WebM (VP9)** | High quality, smaller size |
| **WebM (VP8)** | Better compatibility |

Settings:
- **Duration** - 1-30 seconds
- **Resolution** - Match canvas or custom

### 3D Export
| Format | Description |
|--------|-------------|
| **GLB** | Avatar with current pose, usable in Blender/Unity |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open Command Palette |
| `Space` | Play/Pause animation |
| `Escape` | Close dialogs |

### Command Palette
Press `Cmd/Ctrl + K` for quick access to:
- Load/Save project
- Switch poses
- Toggle effects
- Export options

---

## 💾 Project Files

### Saving Projects
1. Press `Cmd/Ctrl + K`
2. Type "Save Project"
3. Downloads `.pose` file containing:
   - Avatar reference
   - Current pose
   - All settings
   - Saved poses

### Loading Projects
1. Press `Cmd/Ctrl + K`
2. Type "Load Project"
3. Select `.pose` file
4. Everything restores

---

## 🖥️ Viewport Controls

### Camera Controls
| Action | Mouse/Touch |
|--------|-------------|
| **Orbit** | Left-click + drag / One finger drag |
| **Pan** | Right-click + drag / Two finger drag |
| **Zoom** | Scroll wheel / Pinch |

### Viewport Buttons (Top-Left)
| Button | Action |
|--------|--------|
| 🏠 | Reset camera to default |
| 👤 | Front view |
| 📐 | 3/4 angle view |
| 👁️ | Side view |
| 🖥️/🖼️/📱 | Aspect ratio (16:9 / 1:1 / 9:16) |

### Viewport Buttons (Top-Right)
| Button | Action |
|--------|--------|
| 👥 | Create/view multiplayer session |
| 🎤 | Voice chat (when in session) |

### Manual Posing (IK Mode)
1. Enable IK mode in Pose tab
2. Click a bone (hand, foot, etc.)
3. Use transform gizmo to move/rotate
4. Click background to deselect

---

## 📱 Mobile Support

PoseLab works on mobile devices with some considerations:

### Supported Browsers
| Platform | Browser | Status |
|----------|---------|--------|
| Android | Chrome | ✅ Full support |
| Android | Firefox | ✅ Full support |
| iOS | Safari | ✅ Full support |
| iOS | Chrome | ✅ (uses Safari engine) |

### Mobile Features
| Feature | Mobile Support |
|---------|---------------|
| Avatar loading | ✅ |
| Poses & animations | ✅ |
| Motion capture | ✅ (requires camera permission) |
| Voice lip sync | ✅ (requires mic permission) |
| Multiplayer | ✅ |
| Voice chat | ✅ |
| Image export | ✅ |
| Video export | ⚠️ Limited on some devices |
| AI Agent | ✅ |

### Tips for Best Mobile Experience
1. **Use landscape mode** for better viewport visibility
2. **Grant permissions** when prompted (camera, microphone)
3. **Keep screen on** - enable "Keep awake" if available
4. **Use headphones** for voice chat to prevent echo
5. **Tap screen** if audio doesn't play (iOS autoplay policy)
6. **Don't switch apps** during multiplayer - may disconnect

---

## 🎯 Tutorials

### Tutorial 1: Create a Profile Picture

1. **Load Avatar**
   - Scene → Load VRM Avatar

2. **Set Aspect Ratio**
   - Click 🖼️ in viewport → 1:1

3. **Apply Pose**
   - Pose/Expression → Wave

4. **Set Background**
   - Scene → Backgrounds → Choose gradient

5. **Add Effects**
   - Scene → Effects → Cinematic preset

6. **Adjust Lighting**
   - Scene → Lighting → Studio preset

7. **Export**
   - Export → Capture PNG

---

### Tutorial 2: Record a Dance Video

1. **Load Avatar & Animation**
   - Load VRM
   - Animations → Import dance FBX

2. **Set Duration**
   - Export → Duration: 10 seconds

3. **Set Background**
   - Upload animated background (GIF/MP4)

4. **Add Effects**
   - Effects → Vibrant preset
   - Enable Bloom

5. **Record**
   - Export → Record WebM
   - Wait for recording to complete

---

### Tutorial 3: Multiplayer Avatar Call

1. **Host Creates Session**
   - Scene → Co-op Session → Create Session
   - Copy and share the invite link

2. **Guest Joins**
   - Open invite link
   - Enter display name → Join
   - Load VRM avatar

3. **Enable Voice Chat**
   - Both users click 🎤 mic button
   - Grant microphone permission

4. **Start Mocap (Optional)**
   - Mocap → Face Only → Start Capture
   - Your expressions sync to the other user!

5. **Talk & Pose Together**
   - Use poses and animations
   - Everything syncs in real-time

---

### Tutorial 4: Professional Render

1. **Environment Setup**
   - Scene → Environment → Studio HDRI
   - Adjust intensity and blur

2. **Lighting**
   - Lighting → Dramatic preset
   - Fine-tune key light intensity

3. **Post-Processing**
   - Effects → Cinematic
   - Increase bloom slightly
   - Add subtle vignette

4. **Composition**
   - Frame avatar with camera controls
   - Use 16:9 for cinematic ratio

5. **Export**
   - High-res PNG export
   - Enable logo watermark

---

## ❓ Troubleshooting

### Avatar Not Loading
- Ensure file is `.vrm` format
- Check file isn't corrupted
- Try a different VRM

### Toon Shader Not Working
- Your VRM uses PBR materials, not MToon
- Only MToon-based VRMs support outline controls
- VRoid Studio exports include MToon by default

### Animation Glitches
- Some FBX animations may not retarget perfectly
- Try different animation files
- Humanoid-rigged animations work best

### Performance Issues
- Reduce Effects (disable post-processing)
- Use lower resolution backgrounds
- Close other browser tabs

### Export Failed
- Check browser supports WebM recording
- Try shorter duration
- Ensure enough disk space

### Multiplayer Issues
| Issue | Solution |
|-------|----------|
| Can't connect | Check internet connection, try refreshing |
| Avatar not syncing | Ensure VRM is loaded after joining |
| Voice not working | Check microphone permissions in browser |
| No audio on iOS | Tap screen to trigger audio playback |
| Disconnects often | Keep browser tab in foreground |

### Motion Capture Issues
| Issue | Solution |
|-------|----------|
| Tracking jittery | Improve lighting, reduce background clutter |
| Expressions not detected | Ensure face is well-lit and visible |
| Permission denied | Check browser settings for camera access |

---

## 🔧 Technical Requirements

### Browser Support
| Browser | Status |
|---------|--------|
| Chrome 90+ | ✅ Full support |
| Firefox 90+ | ✅ Full support |
| Safari 15+ | ⚠️ Limited WebM export |
| Edge 90+ | ✅ Full support |
| Mobile Chrome | ✅ Full support |
| Mobile Safari | ✅ Full support |

### Hardware
- **Minimum:** Any device with WebGL 2.0
- **Recommended:** Dedicated GPU for smooth performance
- **Webcam:** Required for motion capture
- **Microphone:** Required for voice lip sync and voice chat

### Network (for Multiplayer)
- **Connection:** Peer-to-peer (no server required)
- **Bandwidth:** ~50-100 KB/s per peer for avatar sync
- **Voice Chat:** ~30 KB/s per connected user
- **Ports:** Uses standard WebRTC ports (automatic)

---

## 📚 Glossary

| Term | Definition |
|------|------------|
| **VRM** | Virtual Reality Model - 3D avatar format |
| **MToon** | Toon/cel shader for VRM models |
| **HDRI** | High Dynamic Range Image - 360° environment map |
| **IK** | Inverse Kinematics - drag limbs to pose |
| **Retargeting** | Mapping animation to different skeleton |
| **Bloom** | Glowing effect on bright areas |
| **Vignette** | Darkened edges effect |
| **WebRTC** | Technology for real-time peer-to-peer communication |
| **Mocap** | Motion Capture - tracking body/face movement |

---

## 🔗 Resources

- **VRoid Hub:** https://hub.vroid.com/ - Free VRM avatars
- **VRoid Studio:** https://vroid.com/en/studio - Create VRM avatars
- **Mixamo:** https://mixamo.com/ - Free animations
- **Polyhaven:** https://polyhaven.com/ - Free HDRIs

---

## 📝 Version History

### v1.6 (Current)
- ✅ **3D GLB Environments** - Load immersive 3D scenes
- ✅ Environment controls (position, rotation, scale)
- ✅ Multiple environment support
- ✅ Shadow configuration per environment

### v1.5
- ✅ **Multiplayer co-op sessions** (peer-to-peer)
- ✅ **Voice chat** between users
- ✅ **Voice lip sync** (microphone-driven mouth animation)
- ✅ **Mobile optimization** and support
- ✅ **Background lock** (persist custom backgrounds)
- ✅ **Rotation lock** (persist manual avatar rotations)
- ✅ **Viewport aspect ratio controls**
- ✅ Live facial expression sync in multiplayer
- ✅ Avatar translation via gizmo

### v1.4
- Advanced 3-point lighting system
- Post-processing effects (Bloom, Color Grading)
- HDRI environment support
- Toon shader customization

### v1.2
- Motion capture (face + body)
- Project save/load
- Command palette
- GLB export

### v1.0
- Core posing functionality
- Animation playback
- Image/video export

---

*Built with ❤️ by Project89*

*Version 1.6 | January 2026*

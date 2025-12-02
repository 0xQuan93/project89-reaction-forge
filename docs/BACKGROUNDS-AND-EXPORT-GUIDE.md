# Backgrounds, Logo & Animation Export Guide

## 📁 File Structure

```
public/
├── backgrounds/          ← Place background images here
│   ├── midnight-circuit.svg
│   ├── protocol-sunset.png
│   └── green-loom.jpg
├── logo/                 ← Place logo files here
│   ├── logo.png
│   ├── logo.svg
│   └── watermark.png
└── vrm/
    └── HarmonVox_519.vrm
```

---

## 🎨 Adding Custom Backgrounds

### Step 1: Prepare Your Images

**Supported Formats:**
- SVG (vector, scalable, recommended)
- PNG (with transparency support)
- JPG (solid backgrounds)
- WebP (modern, good compression)

**Recommended Sizes:**
- **1920×1080** (Full HD)
- **2560×1440** (2K)
- **3840×2160** (4K) for high-quality exports

**File Size Tips:**
- SVG: Usually < 100 KB (best for gradients/patterns)
- PNG: 200-500 KB (good for detailed images)
- JPG: 100-300 KB (best for photos)

### Step 2: Name Your Files

Use kebab-case naming:
```
✅ midnight-circuit.svg
✅ protocol-sunset.png
✅ green-loom.jpg
✅ neural-grid.webp

❌ Midnight Circuit.svg (spaces)
❌ protocolSunset.png (camelCase)
❌ green_loom.jpg (underscores)
```

### Step 3: Upload to `public/backgrounds/`

Place your image files in:
```
C:\Users\Chris\project89-reaction-forge\public\backgrounds\
```

### Step 4: Register in `src/three/backgrounds.ts`

```typescript
const backgroundDefinitions: BackgroundDefinition[] = [
  {
    id: 'midnight',
    label: 'Midnight Circuit',
    color: '#05060c', // Fallback color
    image: '/backgrounds/midnight-circuit.svg', // Your image
  },
  {
    id: 'sunset',
    label: 'Protocol Sunset',
    color: '#ff6f61',
    image: '/backgrounds/protocol-sunset.png',
  },
  {
    id: 'matrix',
    label: 'Green Loom',
    color: '#0b3d2e',
    image: '/backgrounds/green-loom.jpg',
  },
  // Add new background:
  {
    id: 'neural',
    label: 'Neural Grid',
    color: '#1a1a2e',
    image: '/backgrounds/neural-grid.svg',
  },
];
```

### Step 5: Add to TypeScript Types

Update `src/types/reactions.ts`:
```typescript
export type BackgroundId = 
  | 'midnight' 
  | 'sunset' 
  | 'matrix'
  | 'neural'; // Add your new background ID
```

### Step 6: Use in Reactions

Update `src/data/reactions.ts`:
```typescript
{
  id: 'neural-agent',
  label: 'Neural Agent',
  description: 'Connected to the grid',
  pose: 'stand-tall',
  expression: 'calm',
  background: 'neural', // Use your new background
},
```

---

## 🏷️ Adding Logo Overlay

### Step 1: Prepare Logo Files

**Recommended Files:**
- `logo.png` - Main logo with transparency (200-400px wide)
- `logo.svg` - Vector version (scalable)
- `logo-white.png` - White version for dark backgrounds
- `watermark.png` - Small corner watermark (80-120px wide)

**Tips:**
- Use PNG with transparency
- Keep file size < 50 KB
- Use high resolution (2x for retina displays)

### Step 2: Upload to `public/logo/`

Place your logo files in:
```
C:\Users\Chris\project89-reaction-forge\public\logo\
```

### Step 3: Configure in `src/three/sceneManager.ts`

The logo overlay is configured at the top of the file:
```typescript
const LOGO_CONFIG = {
  path: '/logo/logo.png', // Path to your logo
  position: 'bottom-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  size: 0.15, // 15% of canvas width
  opacity: 0.8, // 0-1
};
```

### Step 4: Implement Logo Rendering

**Option A: Canvas 2D Overlay** (Simplest)
- Draw logo on top of canvas after WebGL render
- Good for static logos
- Easy to implement

**Option B: WebGL Sprite** (Advanced)
- Render logo as textured quad in 3D scene
- Better performance
- More complex

**Option C: HTML Overlay** (Easiest)
- Position logo as HTML element over canvas
- CSS-based positioning
- No WebGL code needed

---

## 🎬 Exporting Animations

### GIF Export

**When to use:**
- Social media posts (Twitter, Discord)
- Memes and reactions
- Universal compatibility

**Pros:**
- ✅ Works everywhere
- ✅ Auto-plays in browsers
- ✅ Small file size (with optimization)

**Cons:**
- ❌ Limited to 256 colors
- ❌ Larger than video for long animations
- ❌ No audio support

**How to export:**
1. Select a pose
2. Set Animation Mode to "Loop" or "Play Once"
3. Click "Generate reaction"
4. Click "Export GIF"
5. Wait for encoding (3-10 seconds)
6. GIF downloads automatically

**Settings:**
```typescript
{
  duration: 3,      // 3 seconds
  fps: 15,          // 15 frames per second
  quality: 10,      // 1-20, lower = better quality
  repeat: 0,        // 0 = loop forever
}
```

**File sizes:**
- 3 seconds @ 15 fps: ~500-800 KB
- 5 seconds @ 15 fps: ~800-1200 KB
- 3 seconds @ 30 fps: ~1-1.5 MB

### WebM Video Export

**When to use:**
- High-quality animations
- Longer durations
- Modern web platforms

**Pros:**
- ✅ Better quality
- ✅ Smaller file size
- ✅ Smooth playback
- ✅ Supports transparency

**Cons:**
- ❌ Not supported on older browsers
- ❌ May not auto-play everywhere
- ❌ Requires video player

**How to export:**
1. Select a pose
2. Set Animation Mode to "Loop" or "Play Once"
3. Click "Generate reaction"
4. Click "Export Video (WebM)"
5. Wait for recording (3 seconds)
6. Video downloads automatically

**Settings:**
- Codec: VP9 (best quality) or VP8 (fallback)
- Bitrate: 2.5 Mbps
- FPS: 30 (smooth)

**File sizes:**
- 3 seconds @ 30 fps: ~300-500 KB
- 5 seconds @ 30 fps: ~500-800 KB
- 10 seconds @ 30 fps: ~1-1.5 MB

---

## 🎨 Background Design Tips

### For SVG Backgrounds

**Gradients:**
```svg
<svg width="1920" height="1080">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#05060c;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0b3d2e;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#grad)" />
</svg>
```

**Patterns:**
```svg
<svg width="1920" height="1080">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0f0" stroke-width="0.5" opacity="0.2"/>
    </pattern>
  </defs>
  <rect width="1920" height="1080" fill="#000"/>
  <rect width="1920" height="1080" fill="url(#grid)"/>
</svg>
```

### For PNG/JPG Backgrounds

**Photoshop/GIMP:**
1. Create 1920×1080 canvas
2. Add gradients, textures, or images
3. Export as PNG (with transparency) or JPG

**Online Tools:**
- [Coolors.co](https://coolors.co/) - Gradient generator
- [BGJar](https://bgjar.com/) - SVG background generator
- [Hero Patterns](https://heropatterns.com/) - SVG patterns

---

## 🚀 Advanced Features

### Dynamic Backgrounds

Add animated backgrounds using Three.js:

```typescript
// In backgrounds.ts
export function createAnimatedBackground(scene: THREE.Scene) {
  const geometry = new THREE.PlaneGeometry(10, 10);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: `...`,
    fragmentShader: `...`,
  });
  const plane = new THREE.Mesh(geometry, material);
  scene.add(plane);
  
  // Update in render loop
  material.uniforms.time.value += delta;
}
```

### Logo Animation

Animate logo opacity or position:

```typescript
// Fade in logo
let logoOpacity = 0;
function animateLogo(delta: number) {
  logoOpacity = Math.min(logoOpacity + delta, 1.0);
  // Apply to logo element
}
```

### Custom Export Formats

**MP4 Export:**
- Use FFmpeg.wasm in browser
- Convert WebM → MP4
- Better compatibility

**APNG Export:**
- Animated PNG (like GIF but better)
- Supports transparency
- Smaller file size

---

## 📊 File Size Optimization

### GIF Optimization

**Reduce colors:**
```typescript
{
  quality: 20, // Use fewer colors (1-20)
}
```

**Lower FPS:**
```typescript
{
  fps: 10, // 10 fps instead of 15
}
```

**Shorter duration:**
```typescript
{
  duration: 2, // 2 seconds instead of 3
}
```

### WebM Optimization

**Lower bitrate:**
```typescript
{
  videoBitsPerSecond: 1500000, // 1.5 Mbps instead of 2.5
}
```

**Reduce resolution:**
```typescript
// Capture at lower resolution
canvas.width = 1280;
canvas.height = 720;
```

---

## 🎯 Best Practices

### Backgrounds

1. **Use SVG when possible** - Scalable, small file size
2. **Provide fallback colors** - In case image fails to load
3. **Test on different devices** - Check mobile/desktop
4. **Keep it simple** - Don't distract from avatar
5. **Match the theme** - Align with Project 89 aesthetic

### Logo

1. **Use transparency** - PNG with alpha channel
2. **Keep it subtle** - Don't overpower the avatar
3. **Position carefully** - Bottom-right is standard
4. **Test contrast** - Ensure visible on all backgrounds
5. **Optimize file size** - Keep < 50 KB

### Export

1. **GIF for social media** - Best compatibility
2. **WebM for web** - Better quality, smaller size
3. **Test exports** - Verify quality before sharing
4. **Consider file size** - Optimize for fast loading
5. **Add watermark** - Protect your content

---

## 🐛 Troubleshooting

### Background Not Loading

**Check:**
- File path is correct (`/backgrounds/filename.ext`)
- File exists in `public/backgrounds/`
- File extension matches (`.svg`, `.png`, `.jpg`)
- No typos in filename

**Console errors:**
```
[Background] Failed to load image: /backgrounds/missing.svg
[Background] Image load failed, using color fallback
```

### GIF Export Fails

**Possible causes:**
- Animation not playing (select Loop/Once mode)
- gif.js worker not found
- Browser out of memory (reduce duration/fps)

**Solutions:**
- Ensure animation is active before exporting
- Check browser console for errors
- Try lower quality settings
- Use WebM export instead

### WebM Export Not Available

**Check:**
- Browser supports MediaRecorder API
- Canvas.captureStream() is available
- Not in private/incognito mode (may be restricted)

**Supported browsers:**
- ✅ Chrome/Edge (full support)
- ✅ Firefox (full support)
- ⚠️ Safari (limited support)
- ❌ IE (not supported)

---

## 📚 Resources

### Background Assets

- [Unsplash](https://unsplash.com/) - Free high-quality photos
- [Pexels](https://www.pexels.com/) - Free stock photos/videos
- [SVG Backgrounds](https://www.svgbackgrounds.com/) - Free SVG patterns

### Logo Design

- [Figma](https://www.figma.com/) - Design tool
- [Canva](https://www.canva.com/) - Easy logo maker
- [LogoMakr](https://logomakr.com/) - Free logo creator

### GIF Optimization

- [Ezgif](https://ezgif.com/) - Online GIF optimizer
- [Gifsicle](https://www.lcdf.org/gifsicle/) - Command-line tool
- [GIF Compressor](https://gifcompressor.com/) - Reduce file size

---

## ✅ Quick Checklist

**Adding Backgrounds:**
- [ ] Prepare image (1920×1080, < 500 KB)
- [ ] Name file in kebab-case
- [ ] Upload to `public/backgrounds/`
- [ ] Register in `backgrounds.ts`
- [ ] Add to TypeScript types
- [ ] Test in browser

**Adding Logo:**
- [ ] Prepare PNG with transparency (< 50 KB)
- [ ] Upload to `public/logo/`
- [ ] Configure in `sceneManager.ts`
- [ ] Test visibility on all backgrounds

**Exporting Animations:**
- [ ] Select animated pose
- [ ] Set to Loop or Play Once mode
- [ ] Click Generate reaction
- [ ] Choose GIF or WebM export
- [ ] Wait for processing
- [ ] Verify exported file

---

**Built with 💜 for Project 89**


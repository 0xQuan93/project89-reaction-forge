# 🎨 Adding Custom SVG Backgrounds - Step by Step

## 📋 Overview

This guide walks you through adding your custom SVG backgrounds to the Reaction Forge.

---

## 🎯 Step 1: Prepare Your SVG Files

### File Requirements

**Format:** SVG (Scalable Vector Graphics)
**Recommended dimensions:** 1920×1080 (Full HD)
**File size:** Keep under 500 KB for fast loading

### Naming Convention

Use **kebab-case** (lowercase with hyphens):

```
✅ GOOD:
- midnight-circuit.svg
- protocol-sunset.svg
- green-loom.svg
- neural-grid.svg
- cyber-waves.svg

❌ BAD:
- Midnight Circuit.svg (spaces)
- protocolSunset.svg (camelCase)
- midnight_circuit.svg (underscores)
- MIDNIGHT-CIRCUIT.svg (uppercase)
```

### Example SVG Template

If you're creating SVGs from scratch, here's a simple template:

```xml
<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <!-- Gradient background -->
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#05060c;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background rectangle -->
  <rect width="1920" height="1080" fill="url(#grad1)" />
  
  <!-- Add your custom elements here -->
  <!-- Patterns, shapes, text, etc. -->
</svg>
```

---

## 📁 Step 2: Upload Files to Project

### Location

Upload your SVG files to:
```
C:\Users\Chris\project89-reaction-forge\public\backgrounds\
```

### Example Structure

After uploading, your folder should look like:
```
public/backgrounds/
├── midnight-circuit.svg
├── protocol-sunset.svg
└── green-loom.svg
```

**Note:** The files will be accessible at `/backgrounds/{filename}.svg` in the browser.

---

## 🔧 Step 3: Register Backgrounds in Code

### 3A: Add Background IDs to Types

**File:** `src/types/reactions.ts`

**Current:**
```typescript
export type BackgroundId = 'midnight' | 'sunset' | 'matrix';
```

**Add your new backgrounds:**
```typescript
export type BackgroundId = 
  | 'midnight' 
  | 'sunset' 
  | 'matrix'
  | 'neural-grid'      // Add new ID
  | 'cyber-waves';     // Add new ID
```

**Rules:**
- Use the same name as your file (without `.svg`)
- Use kebab-case
- Add one per line with `|`

---

### 3B: Register in Background Definitions

**File:** `src/three/backgrounds.ts`

**Find this array:**
```typescript
const backgroundDefinitions: BackgroundDefinition[] = [
  {
    id: 'midnight',
    label: 'Midnight Circuit',
    color: '#05060c',
    image: '/backgrounds/midnight-circuit.svg',
  },
  // ... existing backgrounds
];
```

**Add your new backgrounds:**
```typescript
const backgroundDefinitions: BackgroundDefinition[] = [
  {
    id: 'midnight',
    label: 'Midnight Circuit',
    color: '#05060c',
    image: '/backgrounds/midnight-circuit.svg',
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
  // ✨ ADD YOUR NEW BACKGROUNDS HERE:
  {
    id: 'neural-grid',              // Must match TypeScript type
    label: 'Neural Grid',           // Display name in UI
    color: '#1a1a2e',               // Fallback color if image fails
    image: '/backgrounds/neural-grid.svg',  // Path to your SVG
  },
  {
    id: 'cyber-waves',
    label: 'Cyber Waves',
    color: '#0d1b2a',
    image: '/backgrounds/cyber-waves.svg',
  },
];
```

**Field Definitions:**
- **`id`**: Unique identifier (must match TypeScript type)
- **`label`**: Human-readable name shown in UI
- **`color`**: Fallback color (hex code) if SVG fails to load
- **`image`**: Path to your SVG file (always starts with `/backgrounds/`)

---

### 3C: Use in Reaction Presets (Optional)

**File:** `src/data/reactions.ts`

If you want to use your new backgrounds in specific reactions:

```typescript
{
  id: 'neural-agent',
  label: 'Neural Agent',
  description: 'Connected to the neural grid.',
  pose: 'dawn-runner',
  expression: 'calm',
  background: 'neural-grid',  // Use your new background
},
```

---

## ✅ Step 4: Test Your Backgrounds

### 4A: Restart Dev Server

If the dev server is running, restart it to pick up new files:

```bash
# Stop current server (Ctrl+C)
# Start again
npm run dev
```

### 4B: Test in Browser

1. **Open:** http://localhost:5173
2. **Open browser console** (F12)
3. **Select a reaction preset** that uses your background
4. **Check console logs:**
   ```
   [Background] Loading image: /backgrounds/neural-grid.svg
   [Background] Applied image: /backgrounds/neural-grid.svg
   ```

### 4C: Verify Visually

- Background should display behind the avatar
- Should be crisp and clear (SVG scales perfectly)
- Should fill the entire canvas

---

## 🐛 Troubleshooting

### Background Not Showing

**Check console for errors:**
```
[Background] Failed to load image: /backgrounds/neural-grid.svg
```

**Possible causes:**
1. **File not uploaded** - Check `public/backgrounds/` folder
2. **Wrong filename** - Must match exactly (case-sensitive)
3. **Wrong path** - Must start with `/backgrounds/`
4. **SVG syntax error** - Validate your SVG file

**Solutions:**
1. Verify file exists in `public/backgrounds/`
2. Check filename spelling and case
3. Ensure path starts with `/backgrounds/` (not `./backgrounds/`)
4. Validate SVG at https://www.svgviewer.dev/

### Background Shows Solid Color

**This means:**
- SVG failed to load
- Fallback color is being used

**Check:**
1. File path is correct
2. SVG file is valid
3. No syntax errors in SVG
4. Browser console for specific error

### Background Looks Distorted

**SVG should never distort** (it's vector)

**If it does:**
1. Check SVG `viewBox` attribute
2. Ensure `preserveAspectRatio` is set correctly
3. Use `viewBox="0 0 1920 1080"` for 16:9 aspect ratio

---

## 📝 Example: Adding "Neural Grid" Background

### Step 1: Create SVG

**File:** `neural-grid.svg`
```xml
<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="neuralGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f0f1e;stop-opacity:1" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4a5568" stroke-width="0.5" opacity="0.3"/>
    </pattern>
  </defs>
  
  <rect width="1920" height="1080" fill="url(#neuralGrad)" />
  <rect width="1920" height="1080" fill="url(#grid)" />
</svg>
```

### Step 2: Upload

Place in: `public/backgrounds/neural-grid.svg`

### Step 3: Update Types

**`src/types/reactions.ts`:**
```typescript
export type BackgroundId = 
  | 'midnight' 
  | 'sunset' 
  | 'matrix'
  | 'neural-grid';  // ✨ Add this
```

### Step 4: Register Background

**`src/three/backgrounds.ts`:**
```typescript
{
  id: 'neural-grid',
  label: 'Neural Grid',
  color: '#1a1a2e',
  image: '/backgrounds/neural-grid.svg',
},
```

### Step 5: Use in Preset (Optional)

**`src/data/reactions.ts`:**
```typescript
{
  id: 'neural-agent',
  label: 'Neural Agent',
  description: 'Connected to the grid.',
  pose: 'dawn-runner',
  expression: 'calm',
  background: 'neural-grid',  // ✨ Use it
},
```

### Step 6: Test

Refresh browser → Select preset → See your background! ✨

---

## 🎨 SVG Design Tips

### Gradients

**Linear gradient (top to bottom):**
```xml
<linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
  <stop offset="0%" style="stop-color:#05060c" />
  <stop offset="100%" style="stop-color:#1a1a2e" />
</linearGradient>
```

**Radial gradient (center outward):**
```xml
<radialGradient id="grad2" cx="50%" cy="50%" r="50%">
  <stop offset="0%" style="stop-color:#1a1a2e" />
  <stop offset="100%" style="stop-color:#05060c" />
</radialGradient>
```

### Patterns

**Grid pattern:**
```xml
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4a5568" stroke-width="0.5"/>
</pattern>
```

**Dots pattern:**
```xml
<pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
  <circle cx="10" cy="10" r="2" fill="#4a5568" opacity="0.3"/>
</pattern>
```

### Effects

**Glow effect:**
```xml
<filter id="glow">
  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
  <feMerge>
    <feMergeNode in="coloredBlur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>
```

---

## 📊 Quick Reference

### File Checklist

- [ ] SVG file created (1920×1080)
- [ ] Named in kebab-case
- [ ] Uploaded to `public/backgrounds/`
- [ ] Background ID added to `src/types/reactions.ts`
- [ ] Background registered in `src/three/backgrounds.ts`
- [ ] (Optional) Used in preset in `src/data/reactions.ts`
- [ ] Tested in browser
- [ ] No console errors

### Common Paths

```
SVG file location:
C:\Users\Chris\project89-reaction-forge\public\backgrounds\{filename}.svg

Browser URL:
http://localhost:5173/backgrounds/{filename}.svg

Code reference:
/backgrounds/{filename}.svg
```

---

## 🚀 Next Steps

Once you've added your backgrounds:

1. **Test all presets** - Make sure they look good
2. **Export reactions** - Test with different backgrounds
3. **Share examples** - Show off your custom backgrounds!

---

## 💡 Pro Tips

1. **Keep SVGs simple** - Complex SVGs = larger file size
2. **Use gradients** - Better than solid colors
3. **Test on different screens** - SVGs scale perfectly
4. **Use opacity** - Subtle patterns work best
5. **Match Project 89 aesthetic** - Dark, tech, cyber themes

---

**Ready to add your backgrounds?** Let me know when you've uploaded your SVG files and I'll help you register them! 🎨✨

---

**Built with 💜 for Project 89**


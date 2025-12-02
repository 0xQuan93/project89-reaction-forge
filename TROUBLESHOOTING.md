# Troubleshooting: Blank Page Issue

## Quick Fixes

### 1. Hard Refresh Browser
The most common cause of blank pages after code changes is stale browser cache:

**Windows/Linux:** `Ctrl + Shift + R` or `Ctrl + F5`  
**Mac:** `Cmd + Shift + R`

### 2. Clear Browser Cache & Reload
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### 3. Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Look for errors (red text)
4. Look for our debug logs:
   - `[main] Starting Project 89 Reaction Forge`
   - `[main] Render mode: main-app`
   - `[App] Rendering App component`
   - `[CanvasStage] Loading avatar from: /vrm/HarmonVox_519.vrm`

### 4. Restart Dev Server
Sometimes Vite's HMR needs a fresh start:

```bash
# Stop the server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

### 5. Clear Vite Cache
```bash
# Stop the server first, then:
rm -rf node_modules/.vite
npm run dev
```

### 6. Full Clean Restart
```bash
# Stop the server
rm -rf node_modules/.vite
rm -rf dist
npm run dev
```

## What to Check

### Browser Console Logs
You should see these logs if the app is loading correctly:

```
[main] Starting Project 89 Reaction Forge
[main] Render mode: main-app
[App] Rendering App component
[CanvasStage] Loading avatar from: /vrm/HarmonVox_519.vrm
[AvatarManager] Loading VRM from: /vrm/HarmonVox_519.vrm
[AvatarManager] Fetching GLTF...
[AvatarManager] VRM extracted, optimizing...
[AvatarManager] VRM added to scene
[CanvasStage] Avatar loaded successfully
[CanvasStage] Applying initial preset: dawn-runner
[AvatarManager] Applying pose: dawn-runner
```

### Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Check if `/vrm/HarmonVox_519.vrm` loads (should be ~10-20MB)
5. Check if all JS/CSS files load successfully

### Common Errors

#### "Failed to fetch VRM"
- VRM file not found at `/vrm/HarmonVox_519.vrm`
- Check that `public/vrm/HarmonVox_519.vrm` exists
- Try using the full path: `http://localhost:5173/vrm/HarmonVox_519.vrm`

#### "Root element not found"
- The HTML isn't loading
- Check `index.html` has `<div id="root"></div>`
- Hard refresh browser

#### Blank page, no errors
- HMR cache issue
- Hard refresh: `Ctrl + Shift + R`
- Or restart dev server

## Current Configuration

- **Default Avatar:** `/vrm/HarmonVox_519.vrm` (local file)
- **Dev Server:** http://localhost:5173/
- **Pose Lab:** http://localhost:5173/?mode=pose-lab

## Recent Changes

1. Changed default avatar from remote URL to local file
2. Added comprehensive debug logging
3. Added loading status messages
4. Improved error handling

## If Still Blank

Try accessing the Pose Lab mode to see if it's a specific component issue:
http://localhost:5173/?mode=pose-lab

If Pose Lab loads but main app doesn't, the issue is in `App.tsx`, `CanvasStage.tsx`, or `ReactionPanel.tsx`.

If nothing loads at all, the issue is in `main.tsx` or `index.html`.


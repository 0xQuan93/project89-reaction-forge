
# PoseLab — UX/UI + Cutting-Edge Roadmap (vNext)

**Goals**

- Reduce time-to-first-export for new users (< 90s).

- Make power features discoverable (Cmd/Ctrl-K, shortcuts).

- Deliver smooth performance on mid-tier laptops.

- Keep “local-first, IP-safe” posture clear.

- Ship 2.5D scenes that feel 3D without FPS pain.

---

## UX Principles

- Progressive disclosure (simple first-run, pro tools on-demand).

- Keyboard-first: Cmd/Ctrl-K palette + cheatsheet (?).

- Accessible dark UI (WCAG AA; respects reduced motion).

- Design tokens drive colors/typography/spacing/elevation.

---

## Information Architecture

- **Modes**: Reactions (simple) / PoseLab (editor).

- **Studio layout**: Library (L) / Stage (C) / Inspector (R) / Timeline (B).

- **Global**: Cmd/Ctrl-K palette, ? shortcuts overlay, toast notifications.

---

## Feature Specs (vNext)

### A. Command Palette

**File(s)**: `src/ui/CommandPalette.tsx`, `src/ui/commands.ts`  

**Lib**: `kbar` (or headless equivalent)  

**Behavior**

- Open palette via `Cmd/Ctrl-K`. Type-to-filter actions.

- Scope-aware actions (Stage vs Timeline).

- Show shortcut in each item.

**Initial Actions (40)**

- Export: PNG, WebM, GLB; toggle alpha; pick preset res.

- Camera: Front / 3⁄4 / Full / Reset orbit.

- Gizmos: Toggle, Translate/Rotate/Scale (1/2/3).

- Timeline: Insert keyframe (I), Play/Pause (Space), Loop toggle (L).

- Backgrounds: Next/Prev, Open Parallax Scene chooser.

- Mocap: Start/Stop; Face only / Body only / Both; Smoothing ±.

- Presets: Apply {top 10} presets.

- System: Toggle Performance Mode, Open Settings, Open Shortcuts (?).

**Acceptance**

- `Cmd/Ctrl-K` always opens.

- Executing any action works from anywhere.

- Palette closes on selection/escape.

---

### B. Toast System (Accessible)

**File(s)**: `src/ui/Toast.tsx`, `src/ui/toastStore.ts`  

**Behavior**

- Non-blocking toasts (max 2 visible); auto-dismiss 3–5s.

- Aria live region for screen readers.

- Types: success / info / error.

**Acceptance**

- Replaces all `alert()` calls.

- Error toasts provide a “Learn more” link (Troubleshooting).

---

### C. 2.5D Parallax Backgrounds

**Files**:  

- `src/backgrounds/ParallaxScene.tsx`  

- `public/backgrounds/abandoned-broadcast-deck/manifest.json` (example)  

**Manifest format**

```json

{

  "id": "abandoned-broadcast-deck",

  "name": "Abandoned Broadcast Deck",

  "layers": [

    {"src": "back.webp", "depth": -300},

    {"src": "mid.webp", "depth": -150},

    {"src": "fore.webp", "depth": -40, "blur": 1}

  ],

  "fx": {"bloom": true, "fog": 0.08},

  "safeInteraction": ["desk", "rail", "terminal"]

}

```

**Behavior**

* Subtle parallax via `requestAnimationFrame` and pointer movement.

* Honor `prefers-reduced-motion: reduce` → parallax disabled.

* One demo scene shipped.

**Acceptance**

* Switching scenes < 200ms on mid-tier laptop.

* With reduced motion OS setting, all movement stops.

---

### D. Export Pipeline Polish

**Files**: `src/export/exportImage.ts`, `src/export/exportVideo.ts`, `src/export/filename.ts`

**Image**

* Presets: 1280×720, 1080×1080, 1080×1920, 1920×1080.

* Toggle: Transparent background (PNG only).

  **Video**

* Feature-detect codec via `MediaRecorder.isTypeSupported`.

* Try VP9 → VP8 → fallback gracefully with message.

  **Filenames**

* Pattern: `avatar_preset_mode_res_YYYYMMDD-HHMM.ext`.

**Acceptance**

* All presets export correctly; alpha respected for PNG.

* Video export shows selected codec; error toast if unsupported.

---

### E. Auto Performance Mode

**Files**: `src/perf/perfMonitor.ts`, `src/perf/settingsStore.ts`

**Behavior**

* Sample FPS for 2s after first render.

* If < 40 FPS → reduce pixelRatio, disable shadows, cap post FX.

* Manual override: High / Medium / Low in Settings.

**Acceptance**

* Toggling mode visibly changes FPS.

* Auto mode never flips repeatedly in a session.

---

### F. VRM Load Guardrails

**Files**: `src/vrm/loadVRM.ts`, `src/ui/toasts`

**Behavior**

* Try/catch with user-friendly errors; suggest Troubleshooting doc.

* Revoke blob URLs on unload; show “Incompatible VRM?” link.

**Acceptance**

* Bad VRM does not crash app; clear error toast appears.

---

### G. GLB Bake Export

**Files**: `src/export/exportGLB.ts`

**Behavior**

* Bake active animation clip into GLB.

* Options: Trim to clip duration; FPS select (e.g., 30).

* Include `/examples/export.glb` (sanity-checked in Blender/Unity).

**Acceptance**

* Sample opens in Blender/Unity with expected skin weights/materials.

---

### H. Deep-Linking & Share

**Files**: `src/share/encodeState.ts`, `src/share/decodeState.ts`

**Behavior**

* Encode tiny session state (`mode`, `bgId`, `presetId`, `camera`) in URL.

* “Copy Share Link” button; decode on load.

**Acceptance**

* Opening shared URL recreates scene reliably across machines.

---

### I. Design Tokens & Accessibility

**Files**: `tokens/tokens.json` (DTCG), `src/styles/tokens.css`

**Behavior**

* Colors/typography/space/elevation exported to CSS vars.

* Enforce WCAG AA contrast; use WebAIM checker during theme dev.

* Respect `prefers-reduced-motion`.

**Acceptance**

* Primary UI text contrast ≥ 4.5:1.

* Theme changes require editing tokens, not component CSS.

---

### J. OBS Quick Connect (Optional in vNext)

**Files**: `src/integrations/obs.ts`, `src/ui/ObsPanel.tsx`

**Behavior**

* Connect via obs-websocket: start/stop recording, scene switch.

* “Test connection” button; connection status indicator.

**Acceptance**

* Connection errors handled via toast; no UI freeze.

---

## Non-Goals (vNext)

* Multi-avatar scenes

* Full 3D room authoring

* Cloud accounts/sync

---

## Release Criteria

* New user can load sample VRM and export a PNG in < 90s.

* Palette covers 90% of common actions.

* Demo parallax scene ships and passes reduced-motion test.

* Exports stable on Chrome/Edge (current versions) on mid-tier laptop.


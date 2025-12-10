# PoseLab — UX/UI + Cutting-Edge Roadmap (v.Next)

## 1) Core UX pillars (what guides every screen)

* **Progressive disclosure, not overwhelm.** Keep Reactions simple; reveal PoseLab’s pro features only when the user reaches for them. This lowers cognitive load and error rates in complex tools.
* **Command palette (+ shortcuts) as the primary accelerator.** Add a Cmd/Ctrl-K palette to run any action (“Apply preset”, “Zero left arm”, “Export GLB”, etc.), surface shortcuts, and make dense feature sets discoverable. Ship with `kbar` for React.
* **Contextual onboarding, not tours.** Use inline tips, empty states, and first-use nudges instead of blocking walkthroughs.
* **Accessible dark UI.** Enforce WCAG AA color-contrast (≥4.5:1 for text) and respect `prefers-reduced-motion` in parallax/2.5D scenes.
* **Design tokens from day one.** Put color/typography/space/elevation in a DTCG-compatible token file so the brand can scale across web, OBS overlays, and docs.

## 2) Information architecture (fewer clicks, faster wins)

* **Top-level modes:** **Reactions** (one-click presets + export) and **PoseLab** (editor).
* **Studio layout:** Left **Library** (poses, animations, backgrounds), center **Stage**, right **Inspector** (avatar, bones, expressions), bottom **Timeline**.
* **Cmd/Ctrl-K** and **? overlay** (cheatsheet) available everywhere.

## 3) Interaction patterns that speed real work

* **Command palette (Cmd/Ctrl-K):** filterable actions, shows shortcut, scope-aware (Stage vs Timeline). Use `kbar` / Headless UI patterns.
* **Toast guidelines:** non-blocking, stack-limited, auto-dismiss; escalate to modal only for destructive ops. (Replaces all `alert()` code paths.)
* **First-class keyboarding:** `?` opens shortcuts; `G` = gizmo toggle; `1/2/3` = translate/rotate/scale; `I` = insert keyframe; `Space` = play/stop. (Expose via palette too.)

## 4) Rendering & performance (buttery on mid-tier laptops)

* **Three.js best practices:** render-on-demand when idle, limit draw calls, prefer instancing/LOD, compress assets.
* **glTF/VRM optimization:** Draco for geometry and **KTX2** Basis Universal for textures; integrate `glTF-Transform` in the build/export path. KTX2 keeps textures GPU-compressed → faster uploads & lower memory.
* **Web-export video:** Use `canvas.captureStream()` → `MediaRecorder` with codec detection (`isTypeSupported`) to choose VP9/VP8; fall back gracefully.

## 5) Backgrounds that feel 3D without the cost

* **2.5D parallax stacks:** layered PNG/WebP planes with CSS `perspective`, `translateZ`, `requestAnimationFrame` scroll updates, and `prefers-reduced-motion` override.
* Keep layers light; avoid `background-attachment: fixed` on large images; throttle scroll work.

## 6) Mocap + AI, but private by default

* **Holistic mocap:** MediaPipe Holistic (body+face+hands) → Kalidokit → VRM bones/blendshapes. Call out drift limits in fast motion and provide smoothing.
* **Local-first:** Run tracking on-device; no uploads by default (aligns with MediaPipe’s on-device privacy posture).

## 7) Avatar format & ecosystem interop

* **VRM 1.0 compliance everywhere.** @pixiv/three-vrm supports VRM 1.0 and has a v3 path compatible with Three.js **WebGPU** renderer; target v3 to future-proof.
* **Outbound workflows:**
  * **GLB/VRM** to **Blender** (VRM add-on) and **Unity** (UniVRM) for downstream editing/VTubing.

## 8) Streaming integrations (meet creators where they are)

* **OBS control** via obs-websocket (28+ ships it) for scene switching when exporting/recording; optional Streamlabs bridge.
* **VTube Studio ecosystem:** If users also drive Live2D models, link out or offer simple triggers via the VTS WebSocket API. (Nice cross-promo, even if PoseLab is VRM-first.)

## 9) Design system & accessibility

* **Tokenize** color/typography/spacing in DTCG JSON (so branding propagates to landing, docs, overlays).
* **Contrast & motion:** enforce WCAG 2.2 contrast rules; respect reduced-motion; test with WebAIM checker during theming.

---

## Immediate “Cursor agent” tasks (actionable, one-sitting)

1. **Add Cmd/Ctrl-K palette** with `kbar`; register top 40 actions (export, apply preset, add keyframe, mocap start/stop…).
2. **Replace alerts** with accessible toasts (queue, max 2 visible, ARIA live region).
3. **Export pipeline hardening:** add Draco+KTX2 + `glTF-Transform` in build & export; detect GPU format support at runtime.
4. **Video export guardrails:** feature-detect `MediaRecorder` MIME support (VP9→VP8→fallback), show codec in UI.
5. **Parallax background blueprint:** one reusable `<ParallaxScene>` with layered slots, RIC/Raf loop, reduced-motion off switch.
6. **OBS quick-connect:** toggle to fire WebSocket actions (start/stop recording, scene change). Ship with a tiny “Test connection” panel.
7. **Design tokens file:** create `/tokens/tokens.json` (DTCG schema), wire to CSS vars; add WCAG checks for dark theme.
8. **VRM 1.0 validator path:** document round-trip to Blender/Unity; link to VRM add-on + UniVRM in the Help menu.

---

## Stretch targets (near-term differentiation)

* **WebGPU track:** start testing Three.js **WebGPURenderer** with `three-vrm@^3` for higher poly avatars and better skin shading on supported GPUs.
* **Shareable deep-links:** encode scene/pose state into URLs for collab and tutorial posts (kept small via tokenized presets).
* **OBS “one-touch export”:** optional post-export macro (switch scene → play stinger → record N sec → stop).


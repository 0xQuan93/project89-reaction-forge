# AvatarManager Refactor Plan

## Goal
Reduce `AvatarManager` complexity by extracting focused services and removing circular dependencies while keeping behavior stable.

## Current Responsibilities (Inventory)
- **Loading & Scene Binding**
  - VRM loading via `GLTFLoader` + `VRMLoaderPlugin`.
  - Scene attachment, orientation, and framing.
  - Default hips position capture and tick-loop registration.
- **Tick & Update Loop**
  - Registers tick handler with `SceneManager`.
  - Drives blink updates, VRM updates, and animation mixer updates.
- **Pose Application**
  - Applies pose presets (static + animated).
  - Handles raw pose data (including expression overrides).
  - Transition clips, smoothing, and hips stabilization logic.
- **Animation Control**
  - Plays/pauses/stops/loops animations and adjusts speed/seek.
  - Coordinates with `AnimationManager` for mixer control.
- **Expression & Blink Management**
  - Expression mutators, available expressions, and per-expression weights.
  - Blink timing and per-frame blink updates.
- **Manual Posing / Interaction Flags**
  - Tracks `isManualPosing` / `isInteracting` flags affecting animation updates.
- **Cleanup**
  - Clears scene, stops ticks, resets state, and releases VRM.

## Proposed Service Boundaries
1. **LoaderService**
   - Load VRM, attach/detach from scene, initialize animation manager, capture default hips.
2. **PoseController**
   - Static pose application, pose transitions, raw pose handling, and pose capture.
3. **AnimationController**
   - Play/stop/pause/loop/speed/seek and related animation state.
4. **ExpressionController**
   - Expression mutators, weight setting, available expression list, blink state.
5. **TickController**
   - Owns the tick registration, calls into Expression + Animation controllers.

## Dependency Observations
- `AvatarManager` currently uses a lazy global store import to avoid circular deps with `useSceneSettingsStore`.
- `motionCapture.ts` and several UI tabs statically import `AvatarManager`, causing dynamic-import warnings.

## Execution Steps (Incremental)
1. **Introduce interfaces + service shells** (no behavior change) and have `AvatarManager` delegate to them.
2. **Move implementation** piece-by-piece (Loader → Animation → Pose → Expression → Tick).
3. **Break circular dependencies** by injecting stores or moving store logic to a boundary layer.
4. **Add regression coverage** for load/apply/pose/export flows.

## Acceptance Criteria
- Behavior parity (poses/animations/blinks/mocap export).
- No dynamic-import warnings for `AvatarManager` module.
- Clear ownership per controller with minimal cross-coupling.

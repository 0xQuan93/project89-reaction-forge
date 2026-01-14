# VMC Input (OSC → WebSocket) Integration

PoseLab accepts **VMC input** through a local OSC → WebSocket bridge because browsers cannot open UDP sockets directly.

## ✅ Recommended Bridge Behavior

1. **Listen for UDP OSC** on the standard VMC port (default: `39539`).
2. **Forward messages over WebSocket** to PoseLab (default: `ws://localhost:39540`).
3. Preserve **OSC addresses and arguments** to keep the browser implementation simple.

PoseLab expects JSON messages shaped like:

```json
{
  "address": "/VMC/Ext/Bone/Pos",
  "args": ["Hips", 0, 1, 0, 0, 0, 0, 1]
}
```

You can also send an array of messages:

```json
[
  { "address": "/VMC/Ext/Blend/Val", "args": ["Joy", 0.5] },
  { "address": "/VMC/Ext/Blend/Apply", "args": [] }
]
```

## ✅ Supported VMC Messages

| Address | Purpose |
| --- | --- |
| `/VMC/Ext/Bone/Pos` | Bone rotation (quaternion) + optional hips position |
| `/VMC/Ext/Root/Pos` | Root position + optional hips rotation |
| `/VMC/Ext/Blend/Val` | Expression / blendshape weights |
| `/VMC/Ext/Blend/Apply` | End-of-frame signal (optional) |

## ✅ Bone Naming

Bone names are mapped from **PascalCase → VRM** (e.g. `LeftUpperArm` → `leftUpperArm`).
If the bone does not exist on the avatar, it is ignored safely.

## ✅ Notes

- VMC input uses the same **render tick** as webcam mocap to avoid physics jitter.
- Expressions are only applied if the avatar exposes matching blendshape names.

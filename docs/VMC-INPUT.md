# VMC Input (OSC → WebSocket) Integration

PoseLab accepts **VMC input** through a local OSC → WebSocket bridge because browsers cannot open UDP sockets directly.

> [!IMPORTANT]
> **Deployment Note:** The built-in bridge only runs during local development (`npm run dev`). When using the deployed version of PoseLab, you must run a standalone bridge on your local machine to forward OSC data to the web app.

## 🚀 How it works

1.  **VMC Sender:** A tool like *XR Animator*, *Warudo*, or *VSeeFace* sends OSC data over UDP (usually port `39539`).
2.  **The Bridge:** Since browsers cannot listen to UDP, a "bridge" (WebSocket server) receives the OSC data and forwards it as JSON to PoseLab.
3.  **PoseLab:** Receives the WebSocket messages and applies the motion to your avatar.

## ✅ Local Development Bridge

In the development environment, PoseLab can start a bridge automatically on `ws://localhost:39540`.
This is **disabled by default**. Enable it with:

```bash
VITE_ENABLE_VMC_BRIDGE=true npm run dev
```

The built-in bridge binds to `127.0.0.1` only to avoid exposing ports on your LAN.

## ✅ Production / Deployed Usage

If you are using the hosted version of PoseLab (e.g., on Netlify), you must provide your own bridge. 

### Recommended Standalone Bridge (Node.js)

You can run a simple bridge using Node.js. Save this as `bridge.js` and run `node bridge.js`:

```javascript
import { WebSocketServer } from 'ws';
import { Server as OscServer } from 'node-osc';

const WS_PORT = 39540;
const OSC_PORT = 39539;

const wss = new WebSocketServer({ port: WS_PORT, host: '127.0.0.1' });
const oscServer = new OscServer(OSC_PORT, '127.0.0.1');

console.log(`VMC Bridge Active!`);
console.log(`Listening for OSC on UDP:${OSC_PORT}`);
console.log(`Forwarding to WebSocket on ws://localhost:${WS_PORT}`);

oscServer.on('message', (msg) => {
    const json = JSON.stringify({ address: msg[0], args: msg.slice(1) });
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(json);
    });
});
```

### Mixed Content (HTTPS)
When using the deployed `https://` version of PoseLab, some browsers may block the connection to `ws://localhost` due to security policies. If you encounter issues:
1. Try using `http://localhost:3000` (or your local port) if available.
2. Check browser settings to "Allow insecure content" for the site.

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

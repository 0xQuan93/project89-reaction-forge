# PoseLab Developer API Guide

> **⚠️ Status Note:** The AI Agent integration (Chat Widget & Remote Config) is currently **disabled by default** in the main application UI to streamline the user experience.
>
> **To Enable:**
> 1. Uncomment `<AIAgentWidget />` in `src/App.tsx`.
> 2. Uncomment the "AI Brain" section in `src/components/SettingsModal.tsx`.

This guide explains how to connect your own AI Agent (e.g., ElizaOS, OpenAI, LangChain) to drive the PoseLab 3D avatar.

## 1. Remote Agent Integration (HTTP)

PoseLab can send user messages to your HTTP endpoint and visualize your agent's response.

### **Request Format**
PoseLab sends a `POST` request to your configured Endpoint URL:

```json
POST /your-agent-endpoint
Content-Type: application/json

{
  "text": "Hello, can you wave?",
  "userId": "poselab-user",
  "userName": "User",
  "roomId": "poselab-default"
}
```

### **Response Format**
Your API must return JSON. We support multiple formats:

**Option A: ElizaOS Standard (Recommended)**
```json
[
  {
    "user": "Vee",
    "content": { 
      "text": "Sure! [GESTURE: wave] [EMOTION: happy]" 
    }
  }
]
```

**Option B: Simple Text**
```json
{
  "text": "Sure! [GESTURE: wave] [EMOTION: happy]"
}
```

**Option C: Generic Response**
```json
{
  "response": "Sure! [GESTURE: wave] [EMOTION: happy]"
}
```

---

## 2. Browser Console / Script Integration (Local)

If you are building a browser extension or a local script, you can drive the avatar directly via the global window object.

**Access Point:** `window.project89Reactor.control`

### **Methods**

#### `control.speak(text: string)`
Makes the avatar "speak" (using browser TTS) and moves the lips.
```javascript
window.project89Reactor.control.speak("Hello world!");
```

#### `control.emote(emotion: string, duration?: number)`
Sets a facial expression.
*   **Emotions:** `happy`, `sad`, `angry`, `surprised`, `thinking`, `excited`, `neutral`.
```javascript
window.project89Reactor.control.emote("happy");
```

#### `control.gesture(name: string, intensity?: number)`
Triggers a body animation.
*   **Gestures:** `wave`, `nod`, `shake`, `shrug`, `point`, `thumbsup`, `clap`, `bow`, `celebrate`, `think`, `listen`, `acknowledge`.
```javascript
window.project89Reactor.control.gesture("wave");
```

#### `control.setBackground(id: string)`
Changes the 3D scene background.
*   **IDs:** `midnight-circuit`, `green-screen`, `lush-forest`, `volcano`, `cyber-alley`, etc.
```javascript
window.project89Reactor.control.setBackground("green-screen");
```

---

## 3. Command Reference (For LLM System Prompts)

To make your LLM drive the body, include these instructions in its system prompt:

> You control a 3D avatar. Output these bracketed commands to move:
> 
> **Body:**
> - `[GESTURE: wave]`
> - `[GESTURE: nod]`
> - `[GESTURE: shake]`
> - `[POSE: dance]`
> 
> **Face:**
> - `[EMOTION: happy]`
> - `[EMOTION: surprised]`
> 
> **Scene:**
> - `[LIGHTING: studio]`
> - `[BACKGROUND: cyber-alley]`
> - `[EFFECTS: cinematic]`

**Example LLM Output:**
"I love that idea! [GESTURE: clap] [EMOTION: excited] Let's try it with some dramatic lighting. [LIGHTING: dramatic]"

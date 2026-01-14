import { VRMHumanBoneName } from '@pixiv/three-vrm';
import * as THREE from 'three';
import type { MotionCaptureManager } from './motionCapture';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type OscArgument = { type?: string; value: number | string };

type OscMessage = {
  address: string;
  args?: Array<OscArgument | number | string>;
};

type VmcPayload = OscMessage | OscMessage[];

const VMC_BONE_ADDRESS = '/VMC/Ext/Bone/Pos';
const VMC_ROOT_ADDRESS = '/VMC/Ext/Root/Pos';
const VMC_BLEND_ADDRESS = '/VMC/Ext/Blend/Val';
const VMC_BLEND_APPLY = '/VMC/Ext/Blend/Apply';

const VRM_BONE_NAMES = new Set(Object.values(VRMHumanBoneName));

const toVrmBoneName = (name: string): VRMHumanBoneName | null => {
  const candidate = `${name.charAt(0).toLowerCase()}${name.slice(1)}` as VRMHumanBoneName;
  if (VRM_BONE_NAMES.has(candidate)) {
    return candidate;
  }
  return null;
};

const normalizeArgs = (args?: Array<OscArgument | number | string>): Array<number | string> => {
  if (!args) return [];
  return args.map((arg) => {
    if (typeof arg === 'object' && arg !== null && 'value' in arg) {
      return arg.value;
    }
    return arg;
  });
};

class VmcInputManager {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private motionCaptureManager: MotionCaptureManager | null = null;
  private lastError: string | null = null;
  private hasActiveBlendFrame = false;

  setMotionCaptureManager(manager: MotionCaptureManager | null) {
    this.motionCaptureManager = manager;
  }

  getStatus() {
    return this.status;
  }

  getLastError() {
    return this.lastError;
  }

  subscribeStatus(listener: (status: ConnectionStatus) => void) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(status: ConnectionStatus, error?: string) {
    this.status = status;
    this.lastError = error ?? null;
    this.statusListeners.forEach((listener) => listener(status));
  }

  connect(url: string) {
    if (this.socket) {
      this.disconnect();
    }
    this.setStatus('connecting');
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.setStatus('connected');
      this.motionCaptureManager?.startExternalInput();
    };

    socket.onclose = () => {
      this.motionCaptureManager?.stopExternalInput();
      this.setStatus('disconnected');
    };

    socket.onerror = () => {
      this.motionCaptureManager?.stopExternalInput();
      this.setStatus('error', 'Failed to connect to VMC bridge.');
    };

    socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.motionCaptureManager?.stopExternalInput();
    this.setStatus('disconnected');
  }

  private handleMessage(data: string | ArrayBuffer | Blob) {
    if (!this.motionCaptureManager) return;
    if (typeof data !== 'string') {
      if (data instanceof Blob) {
        data.text().then((text) => this.handleMessage(text));
        return;
      }
      const decoded = new TextDecoder().decode(data);
      this.handleMessage(decoded);
      return;
    }

    let payload: VmcPayload | null = null;
    try {
      payload = JSON.parse(data) as VmcPayload;
    } catch {
      return;
    }

    if (Array.isArray(payload)) {
      payload.forEach((message) => this.applyOscMessage(message));
    } else if (payload && typeof payload === 'object') {
      this.applyOscMessage(payload);
    }
  }

  private applyOscMessage(message: OscMessage) {
    if (!this.motionCaptureManager) return;
    const args = normalizeArgs(message.args);
    if (message.address === VMC_BONE_ADDRESS) {
      const [name, px, py, pz, qx, qy, qz, qw] = args;
      if (typeof name !== 'string' || [qx, qy, qz, qw].some((v) => typeof v !== 'number')) return;
      const boneName = toVrmBoneName(name);
      if (!boneName) return;
      const rotation = new THREE.Quaternion(qx as number, qy as number, qz as number, qw as number);
      this.motionCaptureManager.applyExternalBoneRotation(boneName, rotation);
      if (boneName === 'hips' && [px, py, pz].every((v) => typeof v === 'number')) {
        this.motionCaptureManager.applyExternalRootPosition(new THREE.Vector3(px as number, py as number, pz as number));
      }
      return;
    }

    if (message.address === VMC_ROOT_ADDRESS) {
      const [name, px, py, pz, qx, qy, qz, qw] = args;
      if ([px, py, pz].every((v) => typeof v === 'number')) {
        this.motionCaptureManager.applyExternalRootPosition(new THREE.Vector3(px as number, py as number, pz as number));
      }
      if (typeof name === 'string' && [qx, qy, qz, qw].every((v) => typeof v === 'number')) {
        const boneName = toVrmBoneName(name) ?? 'hips';
        const rotation = new THREE.Quaternion(qx as number, qy as number, qz as number, qw as number);
        this.motionCaptureManager.applyExternalBoneRotation(boneName, rotation);
      }
      return;
    }

    if (message.address === VMC_BLEND_ADDRESS) {
      const [name, value] = args;
      if (typeof name !== 'string' || typeof value !== 'number') return;
      this.motionCaptureManager.applyExternalExpression(name, value);
      this.hasActiveBlendFrame = true;
      return;
    }

    if (message.address === VMC_BLEND_APPLY) {
      if (this.hasActiveBlendFrame) {
        this.hasActiveBlendFrame = false;
      }
    }
  }
}

export const vmcInputManager = new VmcInputManager();

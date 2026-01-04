/**
 * Global type declarations for PoseLab
 */

import type { AvatarBridge } from '../bridge/avatarBridge';

declare global {
  interface Window {
    /**
     * Project89 Reactor Avatar Bridge
     * Allows external scripts to control the avatar programmatically
     */
    project89Reactor?: AvatarBridge;
  }
}

export {};

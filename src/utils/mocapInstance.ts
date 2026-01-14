import type { MotionCaptureManager } from './motionCapture';

let _mocapManager: MotionCaptureManager | null = null;

export const setMocapManager = (manager: MotionCaptureManager) => {
    _mocapManager = manager;
};

export const getMocapManager = (): MotionCaptureManager | null => {
    return _mocapManager;
};

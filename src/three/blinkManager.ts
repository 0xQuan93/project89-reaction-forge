import type { VRM } from '@pixiv/three-vrm';

interface ExtendedExpressionManager {
  expressionMap?: Record<string, unknown>;
  expressions?: { expressionName?: string }[];
}

export class BlinkManager {
  private vrm?: VRM;
  private blinkState = {
    nextBlinkTime: 0,
    isBlinking: false,
    blinkDuration: 0.15, // seconds
    blinkStartTime: 0,
    minInterval: 2.0,
    maxInterval: 6.0,
  };

  constructor(vrm?: VRM) {
    if (vrm) {
      this.setVRM(vrm);
    }
  }

  setVRM(vrm: VRM) {
    this.vrm = vrm;
    this.blinkState.nextBlinkTime = (performance.now() / 1000) + 2.0;
  }

  update(_delta: number) {
    if (!this.vrm?.expressionManager) return;
    
    const available = this.getAvailableExpressions();
    const blinkKey = available.find(k => k.toLowerCase() === 'blink');
    const blinkLeftKey = available.find(k => k.toLowerCase() === 'blinkleft');
    const blinkRightKey = available.find(k => k.toLowerCase() === 'blinkright');
    
    const canBlink = !!blinkKey || (!!blinkLeftKey && !!blinkRightKey);
    
    if (!canBlink) return;

    const now = performance.now() / 1000;

    if (this.blinkState.isBlinking) {
      const elapsed = now - this.blinkState.blinkStartTime;
      const progress = elapsed / this.blinkState.blinkDuration;

      if (progress >= 1) {
        this.blinkState.isBlinking = false;
        
        if (blinkKey) {
          this.vrm.expressionManager.setValue(blinkKey, 0);
        } else {
          if (blinkLeftKey) this.vrm.expressionManager.setValue(blinkLeftKey, 0);
          if (blinkRightKey) this.vrm.expressionManager.setValue(blinkRightKey, 0);
        }
        
        const interval = this.blinkState.minInterval + Math.random() * (this.blinkState.maxInterval - this.blinkState.minInterval);
        this.blinkState.nextBlinkTime = now + interval;
      } else {
        const value = Math.sin(progress * Math.PI);
        
        if (blinkKey) {
          this.vrm.expressionManager.setValue(blinkKey, value);
        } else {
          if (blinkLeftKey) this.vrm.expressionManager.setValue(blinkLeftKey, value);
          if (blinkRightKey) this.vrm.expressionManager.setValue(blinkRightKey, value);
        }
      }
      this.vrm.expressionManager.update();
    } else {
      if (now >= this.blinkState.nextBlinkTime) {
        this.blinkState.isBlinking = true;
        this.blinkState.blinkStartTime = now;
      }
    }
  }

  private getAvailableExpressions(): string[] {
    if (!this.vrm?.expressionManager) return [];
    const names: string[] = [];
    const manager = this.vrm.expressionManager as unknown as ExtendedExpressionManager;
    if (manager.expressionMap) {
      Object.keys(manager.expressionMap).forEach(name => names.push(name));
    } else if (manager.expressions) {
      manager.expressions.forEach((expr) => { 
        if (expr.expressionName) names.push(expr.expressionName); 
      });
    }
    return names.sort();
  }
}

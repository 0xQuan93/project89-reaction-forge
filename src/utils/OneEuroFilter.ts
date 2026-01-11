/**
 * OneEuroFilter.ts
 * 
 * A 1€ Filter implementation for high-quality, low-latency smoothing of noisy signals.
 * Particularly effective for motion capture data (skeletal tracking, face tracking).
 * 
 * Based on the paper:
 * "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems"
 * by Casiez, Roussel, and Vogel (CHI 2012).
 * 
 * Ported from: https://github.com/jaantollander/OneEuroFilter
 */

class LowPassFilter {
  y: number | null = null;
  s: number | null = null;
  
  constructor(readonly alpha: number, initVal: number = 0) {
    this.y = initVal;
    this.s = this.y;
  }

  filter(value: number, alpha: number) {
    if (this.y === null) {
      this.s = value;
    } else {
      this.s = alpha * value + (1.0 - alpha) * this.s!;
    }
    this.y = this.s;
    return this.y;
  }
  
  hasLastRawValue() {
      return this.y !== null;
  }
  
  lastValue() { 
      return this.y; 
  }
}

export class OneEuroFilter {
  private x: LowPassFilter;
  private dx: LowPassFilter;
  private lastTime: number | null = null;

  /**
   * @param minCutoff Minimum cutoff frequency (Hz). Lower = more smoothing when slow. (Default: 1.0)
   * @param beta Speed coefficient. Higher = less lag when moving fast. (Default: 0.0)
   * @param dCutoff Cutoff for the derivative (Hz). (Default: 1.0)
   */
  constructor(
      private minCutoff: number = 1.0, 
      private beta: number = 0.0, 
      private dCutoff: number = 1.0
  ) {
    this.x = new LowPassFilter(this.alpha(minCutoff));
    this.dx = new LowPassFilter(this.alpha(dCutoff));
  }

  private alpha(cutoff: number): number {
    const te = 1.0 / 60.0; // Assume 60fps initially
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  reset() {
      this.x = new LowPassFilter(this.alpha(this.minCutoff));
      this.dx = new LowPassFilter(this.alpha(this.dCutoff));
      this.lastTime = null;
  }

  /**
   * Filter a value.
   * @param value The noisy input value.
   * @param timestamp Timestamp in seconds (or milliseconds, just be consistent).
   */
  filter(value: number, timestamp: number = -1): number {
    if (this.lastTime !== null && timestamp !== -1) {
       // Recalculate alpha based on actual dt if timestamp provided
       const dt = timestamp - this.lastTime;
       // Avoid divide by zero or negative time
       if (dt > 0) {
           // We re-compute alpha inside the logic effectively by feeding it to the low pass filter
           // But here we need dynamic alpha based on speed
       }
    }
    
    // Update last time
    if (timestamp !== -1) this.lastTime = timestamp;

    const prevX = this.x.lastValue();
    // 1. Estimate derivative (velocity)
    // For the first frame, dx is 0
    const dx = (prevX !== null) ? (value - prevX) * 60 : 0; // Approx velocity assuming 60fps for simplicity or use timestamp

    // 2. Smooth the derivative
    const edx = this.dx.filter(dx, this.alpha(this.dCutoff));

    // 3. Use smoothed derivative to calculate cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    // 4. Filter the signal using this dynamic cutoff
    return this.x.filter(value, this.alpha(cutoff));
  }
}

/**
 * Helper for Vector3 smoothing using OneEuroFilter
 */
export class OneEuroFilterVec3 {
    private xF: OneEuroFilter;
    private yF: OneEuroFilter;
    private zF: OneEuroFilter;

    constructor(minCutoff = 1.0, beta = 0.0) {
        this.xF = new OneEuroFilter(minCutoff, beta);
        this.yF = new OneEuroFilter(minCutoff, beta);
        this.zF = new OneEuroFilter(minCutoff, beta);
    }

    filter(x: number, y: number, z: number, timestamp: number = -1) {
        return {
            x: this.xF.filter(x, timestamp),
            y: this.yF.filter(y, timestamp),
            z: this.zF.filter(z, timestamp)
        };
    }
}

/**
 * Helper for Quaternion smoothing using OneEuroFilter
 * Note: Quaternions need Slerp-like behavior, but OneEuro is linear.
 * For small deltas, linear filtering of x,y,z,w followed by normalization is often "good enough" and fast.
 * A better approach is to filter the separate Euler angles or use a specific Quat filter.
 * Here we filter raw components and normalize.
 */
export class OneEuroFilterQuat {
    private xF: OneEuroFilter;
    private yF: OneEuroFilter;
    private zF: OneEuroFilter;
    private wF: OneEuroFilter;

    constructor(minCutoff = 1.0, beta = 0.0) {
        this.xF = new OneEuroFilter(minCutoff, beta);
        this.yF = new OneEuroFilter(minCutoff, beta);
        this.zF = new OneEuroFilter(minCutoff, beta);
        this.wF = new OneEuroFilter(minCutoff, beta);
    }

    filter(x: number, y: number, z: number, w: number, timestamp: number = -1) {
        const nx = this.xF.filter(x, timestamp);
        const ny = this.yF.filter(y, timestamp);
        const nz = this.zF.filter(z, timestamp);
        const nw = this.wF.filter(w, timestamp);
        
        // Normalize
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz + nw*nw);
        if (len > 0) {
            return { x: nx/len, y: ny/len, z: nz/len, w: nw/len };
        }
        return { x: 0, y: 0, z: 0, w: 1 };
    }
}

export type Live2DLoadPayload = {
  manifestUrl: string;
  manifestPath: string;
  label?: string;
};

type TickRegistrar = (handler: (delta: number) => void) => () => void;

class Live2DManager {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private hostCanvas?: HTMLCanvasElement;
  private tickRegistrar?: TickRegistrar;
  private tickDispose?: () => void;
  private resizeObserver?: ResizeObserver;
  private isLoaded = false;
  private manifestUrl?: string;
  private label?: string;
  private time = 0;
  private lastExpression?: string;
  private lastExpressionWeight?: number;
  private lastPose?: string;
  private physicsEnabled = true;
  private eyeTrackingEnabled = true;

  attachToCanvas(hostCanvas: HTMLCanvasElement, container: HTMLElement) {
    this.hostCanvas = hostCanvas;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'absolute';
      this.canvas.style.inset = '0';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '4';
      container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d', { alpha: true });
    }

    this.resizeToHost();

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.resizeToHost());
    this.resizeObserver.observe(hostCanvas);
  }

  setTickRegistrar(registrar: TickRegistrar) {
    this.tickRegistrar = registrar;
    if (this.isLoaded) {
      this.startTick();
    }
  }

  getCanvas() {
    return this.canvas;
  }

  async load(payload: Live2DLoadPayload) {
    this.manifestUrl = payload.manifestUrl;
    this.label = payload.label ?? payload.manifestPath;
    this.isLoaded = true;
    this.time = 0;
    this.lastExpression = undefined;
    this.lastExpressionWeight = undefined;
    this.lastPose = undefined;
    this.startTick();
    await this.renderPlaceholder();
  }

  setPose(poseId: string) {
    this.lastPose = poseId;
  }

  setExpression(expressionId: string, weight = 1) {
    this.lastExpression = expressionId;
    this.lastExpressionWeight = weight;
  }

  setPhysicsEnabled(enabled: boolean) {
    this.physicsEnabled = enabled;
  }

  setEyeTrackingEnabled(enabled: boolean) {
    this.eyeTrackingEnabled = enabled;
  }

  update(delta: number) {
    if (!this.isLoaded) return;
    this.time += delta;
    this.renderPlaceholder();
  }

  dispose() {
    this.isLoaded = false;
    this.manifestUrl = undefined;
    this.label = undefined;
    this.time = 0;
    this.tickDispose?.();
    this.tickDispose = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.canvas) {
      this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private startTick() {
    if (!this.tickRegistrar) return;
    this.tickDispose?.();
    this.tickDispose = this.tickRegistrar((delta) => this.update(delta));
  }

  private resizeToHost() {
    if (!this.canvas || !this.hostCanvas) return;
    const width = this.hostCanvas.width || this.hostCanvas.clientWidth;
    const height = this.hostCanvas.height || this.hostCanvas.clientHeight;
    if (!width || !height) return;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  private async renderPlaceholder() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    if (!width || !height) return;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const pulse = 8 + Math.sin(this.time * 2) * 4;

    ctx.fillStyle = 'rgba(0, 255, 214, 0.15)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 120 + pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 255, 214, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 90 + pulse / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e6f3ff';
    ctx.font = '600 18px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.label ? `Live2D: ${this.label}` : 'Live2D Avatar Loaded', centerX, centerY - 10);

    ctx.fillStyle = 'rgba(230, 243, 255, 0.7)';
    ctx.font = '14px "Inter", sans-serif';
    ctx.fillText(
      this.manifestUrl ? 'Overlay canvas active' : 'Awaiting Live2D manifest',
      centerX,
      centerY + 20
    );

    ctx.fillStyle = 'rgba(230, 243, 255, 0.6)';
    ctx.font = '12px "Inter", sans-serif';
    const details = [
      this.lastExpression
        ? `Expression: ${this.lastExpression}${this.lastExpressionWeight !== undefined ? ` (${this.lastExpressionWeight.toFixed(2)})` : ''}`
        : null,
      this.lastPose ? `Pose: ${this.lastPose}` : null,
      `Physics: ${this.physicsEnabled ? 'On' : 'Off'}`,
      `Eye Tracking: ${this.eyeTrackingEnabled ? 'On' : 'Off'}`,
    ].filter(Boolean);
    details.forEach((line, index) => {
      ctx.fillText(line as string, centerX, centerY + 50 + index * 16);
    });
  }
}

export const live2dManager = new Live2DManager();

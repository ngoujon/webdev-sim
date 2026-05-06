export class GameLoop {
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDeltaTime: number = 1000 / 60; // 60 updates per second
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private worker: Worker | null = null;

  constructor(
    private fixedUpdate: (dt: number) => void,
    private render: (interpolation: number) => void
  ) {
    this.initWorker();
  }

  private initWorker() {
    try {
      // We use a Web Worker to keep the tick loop alive even when the tab is inactive
      const workerCode = `
        let intervalId = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            intervalId = setInterval(() => self.postMessage('tick'), 1000 / 60);
          } else if (e.data === 'stop') {
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = () => {
        this.tick();
      };
    } catch (e) {
      console.warn("Web Worker creation failed, falling back to standard interval. Background execution might be throttled.", e);
      this.worker = null;
    }
  }

  private fallbackInterval: ReturnType<typeof setInterval> | null = null;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    
    if (this.worker) {
      this.worker.postMessage('start');
    } else {
      this.fallbackInterval = setInterval(this.tick, 1000 / 60);
    }
    
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  }

  public stop() {
    this.isRunning = false;
    
    if (this.worker) {
      this.worker.postMessage('stop');
    } else if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private tick = () => {
    if (!this.isRunning) return;
    
    const currentTime = performance.now();
    const frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Si le worker a été suspendu par le navigateur malgré tout, on permet un rattrapage max de 1 minute (60000ms)
    // pour éviter de geler l'onglet au retour.
    const dt = Math.min(frameTime, 60000);

    this.accumulator += dt;

    while (this.accumulator >= this.fixedDeltaTime) {
      this.fixedUpdate(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
    }
  };

  private renderLoop = () => {
    if (!this.isRunning) return;
    
    const interpolation = this.accumulator / this.fixedDeltaTime;
    this.render(Math.min(1, Math.max(0, interpolation)));

    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };
}

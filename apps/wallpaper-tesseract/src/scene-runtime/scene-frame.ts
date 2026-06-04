export interface SceneFrame {
  timeMs: number;
  deltaMs: number;
  frameIndex: number;
}

export class SceneFrameClock {
  private lastTimeMs: number | null = null;
  private nextFrameIndex = 0;

  tick(timeMs: number): SceneFrame {
    if (!Number.isFinite(timeMs)) {
      throw new Error("SceneFrameClock.tick requires a finite timeMs.");
    }
    const deltaMs = this.lastTimeMs === null ? 0 : Math.max(0, timeMs - this.lastTimeMs);
    this.lastTimeMs = timeMs;
    return {
      timeMs,
      deltaMs,
      frameIndex: this.nextFrameIndex++
    };
  }

  reset(): void {
    this.lastTimeMs = null;
    this.nextFrameIndex = 0;
  }
}

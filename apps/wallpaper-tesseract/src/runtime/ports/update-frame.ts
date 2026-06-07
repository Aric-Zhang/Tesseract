export interface UpdateFrame {
  timeMs: number;
  deltaMs: number;
  frameIndex: number;
}

export class UpdateFrameClock {
  private lastTimeMs: number | null = null;
  private nextFrameIndex = 0;

  tick(timeMs: number): UpdateFrame {
    if (!Number.isFinite(timeMs)) {
      throw new Error("UpdateFrameClock.tick requires a finite timeMs.");
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

export interface RuntimeDisposable {
  dispose(): void;
}

export interface FrameUpdatable {
  updateFrame(frame: UpdateFrame): void;
}

export interface RuntimeObject {
  readonly id: string;
  readonly priority?: number;
  enabled?: boolean;
  updateFrame?(frame: UpdateFrame): void;
  dispose?(): void;
}

export interface RuntimeRegistration extends RuntimeDisposable {}

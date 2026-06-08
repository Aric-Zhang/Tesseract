export interface UiFrame {
  readonly timeMs: number;
  readonly deltaMs: number;
  readonly frameIndex: number;
}

export interface UiSchedulerRegistration {
  dispose(): void;
}

export interface UiScheduledService {
  readonly id: string;
  readonly priority?: number;
  enabled?: boolean;
  updateFrame?(frame: UiFrame): void;
  dispose?(): void;
}

export interface UiScheduler {
  register(service: UiScheduledService): UiSchedulerRegistration;
}

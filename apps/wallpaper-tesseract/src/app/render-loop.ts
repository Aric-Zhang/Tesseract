export interface RenderLoopEnvironment {
  readonly document: Pick<Document, "hidden">;
  readonly window: Pick<
    Window,
    "requestAnimationFrame" | "cancelAnimationFrame" | "setTimeout" | "clearTimeout"
  >;
}

export interface RenderLoopOptions {
  update(timeMs: number): void;
  environment?: RenderLoopEnvironment;
}

type FrameRequest =
  | { kind: "raf"; id: number }
  | { kind: "timeout"; id: number };

export class RenderLoop {
  private readonly update: (timeMs: number) => void;
  private readonly environment: RenderLoopEnvironment;
  private frameRequest: FrameRequest | null = null;

  constructor(options: RenderLoopOptions) {
    this.update = options.update;
    this.environment = options.environment ?? getDefaultEnvironment();
  }

  get running(): boolean {
    return this.frameRequest !== null;
  }

  start(): void {
    if (this.frameRequest !== null) return;
    this.frameRequest = this.requestFrame((timeMs) => this.animate(timeMs));
  }

  stop(): void {
    if (this.frameRequest === null) return;
    this.cancelFrameRequest(this.frameRequest);
    this.frameRequest = null;
  }

  restart(): void {
    if (!this.running) return;
    this.stop();
    this.start();
  }

  dispose(): void {
    this.stop();
  }

  private animate(timeMs: number): void {
    this.frameRequest = this.requestFrame((nextTimeMs) => this.animate(nextTimeMs));
    this.update(timeMs);
  }

  private requestFrame(callback: FrameRequestCallback): FrameRequest {
    const host = this.environment.window;
    if (!this.environment.document.hidden && typeof host.requestAnimationFrame === "function") {
      return { kind: "raf", id: host.requestAnimationFrame(callback) };
    }
    return {
      kind: "timeout",
      id: host.setTimeout(() => callback(Date.now()), 16)
    };
  }

  private cancelFrameRequest(request: FrameRequest): void {
    const host = this.environment.window;
    if (request.kind === "raf" && typeof host.cancelAnimationFrame === "function") {
      host.cancelAnimationFrame(request.id);
      return;
    }
    host.clearTimeout(request.id);
  }
}

function getDefaultEnvironment(): RenderLoopEnvironment {
  return {
    document,
    window
  };
}

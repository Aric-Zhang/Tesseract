import type { Actor } from "../actor-runtime";
import type { WindowFramePort } from "./window-frame-port";

export interface WindowFramePortRegistryEntry {
  readonly frameActor: Actor;
  readonly framePort: WindowFramePort;
  readonly getBaseStackPriority?: () => number;
  readonly getStackPriority: () => number;
  readonly setStackPriority?: (priority: number) => void;
  readonly canTarget?: () => boolean;
  readonly destroyWhenEmpty?: boolean;
}

export interface RegisteredWindowFramePort {
  dispose(): void;
}

export interface WindowFramePortRegistryView {
  get(frameId: string): WindowFramePortRegistryEntry | null;
  list(): readonly WindowFramePortRegistryEntry[];
}

export class WindowFramePortRegistry implements WindowFramePortRegistryView {
  readonly #entries = new Map<string, WindowFramePortRegistryEntry>();

  register(entry: WindowFramePortRegistryEntry): RegisteredWindowFramePort {
    if (entry.frameActor.id !== entry.framePort.frameId) {
      throw new Error(
        `Window frame port id must match frame actor id: actor=${entry.frameActor.id}, frame=${entry.framePort.frameId}`
      );
    }
    if (this.#entries.has(entry.framePort.frameId)) {
      throw new Error(`Window frame port is already registered: ${entry.framePort.frameId}`);
    }
    this.#entries.set(entry.framePort.frameId, entry);
    return {
      dispose: () => {
        if (this.#entries.get(entry.framePort.frameId) === entry) {
          this.#entries.delete(entry.framePort.frameId);
        }
      }
    };
  }

  get(frameId: string): WindowFramePortRegistryEntry | null {
    return this.#entries.get(frameId) ?? null;
  }

  list(): readonly WindowFramePortRegistryEntry[] {
    return [...this.#entries.values()];
  }
}

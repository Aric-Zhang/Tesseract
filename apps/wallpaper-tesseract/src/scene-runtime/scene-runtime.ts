import type { RuntimeObject, RuntimeRegistration, UpdateFrame } from "../runtime/ports";

interface RuntimeEntry {
  object: RuntimeObject;
  order: number;
}

export class SceneRuntime {
  private readonly entries: RuntimeEntry[] = [];
  private nextOrder = 0;
  private disposed = false;

  register(object: RuntimeObject): RuntimeRegistration {
    if (this.disposed) {
      throw new Error("Cannot register a runtime object after SceneRuntime.dispose().");
    }
    if (this.entries.some((entry) => entry.object === object)) {
      throw new Error(`Runtime object is already registered: ${object.id}`);
    }
    this.entries.push({ object, order: this.nextOrder++ });
    this.entries.sort(compareRuntimeEntries);
    return {
      dispose: () => this.unregister(object)
    };
  }

  unregister(object: RuntimeObject): void {
    const index = this.entries.findIndex((entry) => entry.object === object);
    if (index >= 0) {
      this.entries.splice(index, 1);
    }
  }

  updateFrame(frame: UpdateFrame): void {
    for (const entry of this.entries) {
      const object = entry.object;
      if (object.enabled === false) continue;
      object.updateFrame?.(frame);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const entries = [...this.entries].sort((a, b) => b.order - a.order);
    this.entries.length = 0;
    for (const entry of entries) {
      entry.object.dispose?.();
    }
  }
}

function compareRuntimeEntries(a: RuntimeEntry, b: RuntimeEntry): number {
  const priorityDelta = (a.object.priority ?? 0) - (b.object.priority ?? 0);
  if (priorityDelta !== 0) return priorityDelta;
  return a.order - b.order;
}

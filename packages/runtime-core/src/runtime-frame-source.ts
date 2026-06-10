import { createRuntimeRegistration, type RuntimeRegistration } from "./runtime-disposable";
import type { RuntimeFrameSourceId } from "./runtime-id";

export type RuntimeFrameSourceStatus = "ready" | "pending" | "failed";

export interface RuntimeFrameSourceError {
  readonly message: string;
  readonly code?: string;
}

export interface RuntimeFrameSourceDescriptor {
  readonly id: RuntimeFrameSourceId;
  readonly label?: string;
}

export interface RuntimeFrameSourceSnapshot<Payload = unknown> {
  readonly sourceId: RuntimeFrameSourceId;
  readonly revision: number;
  readonly status: RuntimeFrameSourceStatus;
  readonly payload?: Payload;
  readonly error?: RuntimeFrameSourceError;
}

export interface RuntimeFrameSource<Payload = unknown> {
  readonly descriptor: RuntimeFrameSourceDescriptor;
  getSnapshot(): RuntimeFrameSourceSnapshot<Payload>;
  subscribe(listener: RuntimeFrameSourceListener<Payload>): RuntimeRegistration;
}

export interface RuntimeFrameSourceListener<Payload = unknown> {
  onFrameSourceChanged(snapshot: RuntimeFrameSourceSnapshot<Payload>): void;
}

export class RuntimeMutableFrameSource<Payload = unknown> implements RuntimeFrameSource<Payload> {
  readonly descriptor: RuntimeFrameSourceDescriptor;
  readonly #listeners = new Set<RuntimeFrameSourceListener<Payload>>();
  #snapshot: RuntimeFrameSourceSnapshot<Payload>;

  constructor(descriptor: RuntimeFrameSourceDescriptor) {
    this.descriptor = descriptor;
    this.#snapshot = {
      sourceId: descriptor.id,
      revision: 0,
      status: "pending"
    };
  }

  getSnapshot(): RuntimeFrameSourceSnapshot<Payload> {
    return this.#snapshot;
  }

  publish(snapshot: Omit<RuntimeFrameSourceSnapshot<Payload>, "sourceId" | "revision">): RuntimeFrameSourceSnapshot<Payload> {
    this.#snapshot = {
      ...snapshot,
      sourceId: this.descriptor.id,
      revision: this.#snapshot.revision + 1
    };
    for (const listener of this.#listeners) {
      listener.onFrameSourceChanged(this.#snapshot);
    }
    return this.#snapshot;
  }

  subscribe(listener: RuntimeFrameSourceListener<Payload>): RuntimeRegistration {
    this.#listeners.add(listener);
    return createRuntimeRegistration(() => {
      this.#listeners.delete(listener);
    });
  }
}

export class RuntimeFrameSourceRegistry {
  readonly #sources = new Map<RuntimeFrameSourceId, RuntimeFrameSource>();

  add(source: RuntimeFrameSource): void {
    if (this.#sources.has(source.descriptor.id)) {
      throw new Error(`RuntimeFrameSourceRegistry already contains source ${source.descriptor.id}.`);
    }
    this.#sources.set(source.descriptor.id, source);
  }

  remove(sourceId: RuntimeFrameSourceId): boolean {
    return this.#sources.delete(sourceId);
  }

  get(sourceId: RuntimeFrameSourceId): RuntimeFrameSource | null {
    return this.#sources.get(sourceId) ?? null;
  }

  list(): readonly RuntimeFrameSource[] {
    return [...this.#sources.values()];
  }
}

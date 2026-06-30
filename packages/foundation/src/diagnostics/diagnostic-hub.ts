import type {
  DiagnosticEvent,
  DiagnosticEventInput,
  DiagnosticEventListener,
  DiagnosticSink,
  DiagnosticSource
} from "./diagnostic-event";

export const defaultDiagnosticHubCapacity = 500;

export interface DiagnosticHubOptions {
  readonly capacity?: number;
  readonly now?: () => number;
}

export class DiagnosticHub implements DiagnosticSink, DiagnosticSource {
  readonly #capacity: number;
  readonly #now: () => number;
  readonly #events: DiagnosticEvent[] = [];
  readonly #listeners = new Set<DiagnosticEventListener>();
  #nextId = 1;

  constructor(options: DiagnosticHubOptions = {}) {
    this.#capacity = normalizeCapacity(options.capacity ?? defaultDiagnosticHubCapacity);
    this.#now = options.now ?? Date.now;
  }

  emit(input: DiagnosticEventInput): void {
    const event = createDiagnosticEvent(this.#nextId++, this.#now(), input);
    this.#events.push(event);
    if (this.#events.length > this.#capacity) {
      this.#events.splice(0, this.#events.length - this.#capacity);
    }

    let firstError: unknown = null;
    for (const listener of [...this.#listeners]) {
      try {
        listener(event);
      } catch (error) {
        firstError ??= error;
      }
    }

    if (firstError !== null) {
      throw firstError;
    }
  }

  snapshot(): readonly DiagnosticEvent[] {
    return Object.freeze([...this.#events]);
  }

  subscribe(listener: DiagnosticEventListener): { dispose(): void } {
    this.#listeners.add(listener);
    let disposed = false;

    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this.#listeners.delete(listener);
      }
    };
  }
}

function normalizeCapacity(capacity: number): number {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error(`DiagnosticHub capacity must be a positive integer: ${capacity}`);
  }
  return capacity;
}

function createDiagnosticEvent(
  id: number,
  timestampMs: number,
  input: DiagnosticEventInput
): DiagnosticEvent {
  const rawMessage = typeof input.message === "string" ? undefined : input.message;
  const tags = input.tags === undefined
    ? undefined
    : Object.freeze([...input.tags]);
  const event: DiagnosticEvent = {
    id,
    timestampMs,
    level: input.level,
    message: formatDiagnosticMessage(input.message),
    ...(rawMessage === undefined ? {} : { rawMessage }),
    ...(input.data === undefined ? {} : { data: input.data }),
    ...(input.source === undefined ? {} : { source: input.source }),
    ...(tags === undefined ? {} : { tags })
  };

  return Object.freeze(event);
}

function formatDiagnosticMessage(message: unknown): string {
  if (typeof message === "string") return message;
  if (message instanceof Error) return message.message;

  try {
    const serialized = JSON.stringify(message);
    if (serialized !== undefined) return serialized;
  } catch {
    // Fall back to String below for cyclic or unserializable objects.
  }

  return String(message);
}

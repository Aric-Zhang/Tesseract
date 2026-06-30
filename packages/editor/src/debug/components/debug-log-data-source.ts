import type {
  DiagnosticEvent,
  DiagnosticSource
} from "foundation/diagnostics";
import { type VirtualListDataSource, type VirtualListItemSnapshot } from "ui-framework/controls";

const DEFAULT_DEBUG_LOG_MESSAGE = "Diagnostics enabled";

interface DebugLogSubscription {
  dispose(): void;
}

export class DebugLogDataSource implements VirtualListDataSource {
  readonly #diagnostics: DiagnosticSource;
  readonly #registration: DebugLogSubscription;
  #events: readonly DiagnosticEvent[];
  #revision = 0;
  #disposed = false;

  constructor(diagnostics: DiagnosticSource) {
    this.#diagnostics = diagnostics;
    this.#events = diagnostics.snapshot();
    this.#registration = diagnostics.subscribe(() => {
      if (this.#disposed) return;
      this.#events = this.#diagnostics.snapshot();
      this.#revision += 1;
    });
  }

  get revision(): number {
    return this.#revision;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#registration.dispose();
  }

  getItemCount(): number {
    return Math.max(1, this.#events.length);
  }

  getItem(index: number): VirtualListItemSnapshot {
    if (this.#events.length === 0) {
      if (index !== 0) throw new Error(`Debug log placeholder index out of range: ${index}`);
      return {
        key: "debug-log-placeholder",
        text: DEFAULT_DEBUG_LOG_MESSAGE,
        muted: true
      };
    }
    if (!Number.isInteger(index) || index < 0 || index >= this.#events.length) {
      throw new Error(`Debug log index out of range: ${index}`);
    }
    const event = this.#events[index];
    if (!event) throw new Error(`Debug log index out of range: ${index}`);
    return {
      key: `diagnostic:${event.id}`,
      text: formatDiagnosticEvent(event)
    };
  }
}

function formatDiagnosticEvent(event: DiagnosticEvent): string {
  const time = event.timestampMs.toFixed(0).padStart(5, " ");
  const source = event.source ? ` ${event.source}` : "";
  const tags = event.tags && event.tags.length > 0 ? ` [${event.tags.join(",")}]` : "";
  return `${time} ${event.level.toUpperCase()}${source}${tags} ${event.message}`;
}

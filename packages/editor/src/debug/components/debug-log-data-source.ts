import type { GizmoDebugLogEntry } from "actor-system/gizmo";
import type { VirtualListDataSource, VirtualListItemSnapshot } from "ui-framework";

const DEFAULT_DEBUG_LOG_MESSAGE = "Gizmo debug log enabled";

interface DebugLogLine {
  readonly id: number;
  readonly text: string;
}

export class DebugLogDataSource implements VirtualListDataSource {
  readonly #lines: Array<DebugLogLine | undefined>;
  readonly #maxLines: number;
  #start = 0;
  #count = 0;
  #nextLineId = 1;
  #revision = 0;

  constructor(maxLines = 200) {
    this.#maxLines = normalizeMaxLines(maxLines);
    this.#lines = new Array(this.#maxLines);
  }

  get revision(): number {
    return this.#revision;
  }

  append(entry: GizmoDebugLogEntry): void {
    const time = entry.timeStamp === undefined ? "----" : entry.timeStamp.toFixed(0).padStart(5, " ");
    const writeIndex = (this.#start + this.#count) % this.#maxLines;
    this.#lines[writeIndex] = {
      id: this.#nextLineId,
      text: `${time} ${entry.message}`
    };
    this.#nextLineId += 1;
    if (this.#count < this.#maxLines) {
      this.#count += 1;
    } else {
      this.#start = (this.#start + 1) % this.#maxLines;
    }
    this.#revision += 1;
  }

  getItemCount(): number {
    return Math.max(1, this.#count);
  }

  getItem(index: number): VirtualListItemSnapshot {
    if (this.#count === 0) {
      if (index !== 0) throw new Error(`Debug log placeholder index out of range: ${index}`);
      return {
        key: "debug-log-placeholder",
        text: DEFAULT_DEBUG_LOG_MESSAGE,
        muted: true
      };
    }
    if (!Number.isInteger(index) || index < 0 || index >= this.#count) {
      throw new Error(`Debug log index out of range: ${index}`);
    }
    const line = this.#lines[(this.#start + index) % this.#maxLines];
    if (!line) throw new Error(`Debug log index out of range: ${index}`);
    return {
      key: `debug-log-entry:${line.id}`,
      text: line.text
    };
  }
}

function normalizeMaxLines(maxLines: number): number {
  if (!Number.isInteger(maxLines) || maxLines <= 0) {
    throw new Error(`Invalid Debug log maxLines: ${String(maxLines)}`);
  }
  return maxLines;
}

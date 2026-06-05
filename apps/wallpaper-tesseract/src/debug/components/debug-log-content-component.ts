import type { GizmoDebugLogEntry } from "gizmo-core";
import type { Actor, Component, ComponentType } from "../../actor-runtime";
import type { SceneFrame } from "../../scene-runtime";
import type { WindowContentAttachment, WindowContentHost, WindowContentRehostable } from "../../window-runtime";

export const debugLogContentComponentType =
  "debug-log-content-component" as ComponentType<DebugLogContentComponent>;

export interface DebugLogContentComponentOptions {
  id?: string;
  maxLines?: number;
  document?: Pick<Document, "createElement">;
}

export interface DebugLogContentComponentServices {
  host: WindowContentHost;
}

const DEFAULT_DEBUG_LOG_CONTENT_ID = "debug-log-content";
const DEFAULT_DEBUG_LOG_MESSAGE = "Gizmo debug log enabled";

export class DebugLogContentComponent implements Component, WindowContentRehostable {
  readonly id: string;
  readonly type = debugLogContentComponentType;
  readonly actor: Actor;
  enabled = true;
  readonly content: HTMLPreElement;

  #attachment: WindowContentAttachment;
  readonly #lines: string[] = [];
  readonly #maxLines: number;
  #logDirty = true;

  constructor(
    actor: Actor,
    options: DebugLogContentComponentOptions,
    services: DebugLogContentComponentServices
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_DEBUG_LOG_CONTENT_ID;
    this.#maxLines = options.maxLines ?? 200;
    const documentRef = resolveDocument(options);
    this.content = documentRef.createElement("pre");
    this.content.className = "debug-log-window__content";
    this.content.textContent = DEFAULT_DEBUG_LOG_MESSAGE;
    this.#attachment = services.host.mountContent(this.content);
  }

  get currentWindowContentHost(): WindowContentHost | null {
    return this.enabled ? this.#attachment.host : null;
  }

  rehostWindowContent(host: WindowContentHost): void {
    const previous = this.#attachment;
    this.#attachment = host.mountContent(this.content);
    previous.dispose();
  }

  setWindowContentInteractable(interactable: boolean): void {
    this.#attachment.setInteractable(interactable);
  }

  append(entry: GizmoDebugLogEntry): void {
    const time = entry.timeStamp === undefined ? "----" : entry.timeStamp.toFixed(0).padStart(5, " ");
    this.#lines.push(`${time} ${entry.message}`);
    while (this.#lines.length > this.#maxLines) {
      this.#lines.shift();
    }
    this.#logDirty = true;
  }

  updateFrame(_frame: SceneFrame): void {
    if (!this.#logDirty) return;
    this.#logDirty = false;
    this.content.textContent = this.#lines.length === 0 ? DEFAULT_DEBUG_LOG_MESSAGE : this.#lines.join("\n");
  }

  dispose(): void {
    this.enabled = false;
    this.#attachment.dispose();
  }
}

function resolveDocument(options: DebugLogContentComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (typeof document !== "undefined") return document;
  throw new Error("DebugLogContentComponent requires a document.");
}

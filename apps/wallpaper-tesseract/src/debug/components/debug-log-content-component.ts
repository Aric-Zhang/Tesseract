import type { GizmoDebugLogEntry } from "gizmo-core";
import type { Actor, Component, ComponentType } from "../../actor-runtime";
import type { UpdateFrame } from "../../runtime/ports";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "../../window-runtime";

export const debugLogContentComponentType =
  "debug-log-content-component" as ComponentType<DebugLogContentComponent>;

export interface DebugLogContentComponentOptions {
  id?: string;
  maxLines?: number;
  document?: Pick<Document, "createElement">;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
}

const DEFAULT_DEBUG_LOG_CONTENT_ID = "debug-log-content";
const DEFAULT_DEBUG_LOG_MESSAGE = "Gizmo debug log enabled";

export class DebugLogContentComponent implements Component, WindowRegisteredContent {
  readonly id: string;
  readonly type = debugLogContentComponentType;
  readonly actor: Actor;
  enabled = true;
  readonly content: HTMLPreElement;

  #registration: WindowRegisteredContent;
  readonly #lines: string[] = [];
  readonly #maxLines: number;
  #logDirty = true;

  constructor(
    actor: Actor,
    options: DebugLogContentComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_DEBUG_LOG_CONTENT_ID;
    this.#maxLines = options.maxLines ?? 200;
    const documentRef = resolveDocument(options);
    this.content = documentRef.createElement("pre");
    this.content.className = "debug-log-window__content";
    this.content.textContent = DEFAULT_DEBUG_LOG_MESSAGE;
    this.#registration = options.contentRegistration.registerContent({
      contentId: options.contentId,
      element: this.content
    });
  }

  get contentId(): string {
    return this.#registration.contentId;
  }

  get element(): HTMLElement {
    return this.content;
  }

  get interactable(): boolean {
    return this.#registration.interactable;
  }

  setInteractable(interactable: boolean): void {
    this.#registration.setInteractable(interactable);
  }

  subscribeLayoutCommit(
    callback: (commit: WindowContentLayoutCommit) => void
  ): WindowContentLayoutCommitRegistration {
    return this.#registration.subscribeLayoutCommit(callback);
  }

  append(entry: GizmoDebugLogEntry): void {
    const time = entry.timeStamp === undefined ? "----" : entry.timeStamp.toFixed(0).padStart(5, " ");
    this.#lines.push(`${time} ${entry.message}`);
    while (this.#lines.length > this.#maxLines) {
      this.#lines.shift();
    }
    this.#logDirty = true;
  }

  updateFrame(_frame: UpdateFrame): void {
    if (!this.#logDirty) return;
    this.#logDirty = false;
    this.content.textContent = this.#lines.length === 0 ? DEFAULT_DEBUG_LOG_MESSAGE : this.#lines.join("\n");
  }

  dispose(): void {
    this.enabled = false;
    this.#registration.dispose();
  }
}

function resolveDocument(options: DebugLogContentComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (typeof document !== "undefined") return document;
  throw new Error("DebugLogContentComponent requires a document.");
}

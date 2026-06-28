import type { GizmoDebugLogEntry } from "gizmo-core";
import type { Actor, Component, ComponentType } from "actor-core";
import type { UiFrame } from "ui-framework";
import type {
  ListViewComponent,
  ScrollViewComponent,
  UiElementComponent,
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "ui-framework";
import type {
  DebugLogEntryActorReconciler,
  DebugLogListItem
} from "./debug-log-entry-actor-reconciler";

export const debugLogContentComponentType =
  "debug-log-content-component" as ComponentType<DebugLogContentComponent>;

export interface DebugLogContentComponentOptions {
  id?: string;
  maxLines?: number;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
  itemReconciler: DebugLogEntryActorReconciler;
}

const DEFAULT_DEBUG_LOG_CONTENT_ID = "debug-log-content";
const DEFAULT_DEBUG_LOG_MESSAGE = "Gizmo debug log enabled";

interface DebugLogLine {
  readonly id: number;
  readonly text: string;
}

export class DebugLogContentComponent implements Component, WindowRegisteredContent {
  readonly id: string;
  readonly type = debugLogContentComponentType;
  readonly actor: Actor;
  enabled = true;

  readonly #element: HTMLElement;
  readonly #scrollView: ScrollViewComponent;
  readonly #listView: ListViewComponent;
  readonly #itemReconciler: DebugLogEntryActorReconciler;
  #registration: WindowRegisteredContent;
  readonly #lines: DebugLogLine[] = [];
  readonly #maxLines: number;
  #nextLineId = 1;
  #logDirty = true;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    scrollView: ScrollViewComponent,
    listView: ListViewComponent,
    options: DebugLogContentComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_DEBUG_LOG_CONTENT_ID;
    this.#maxLines = options.maxLines ?? 200;
    this.#element = uiElement.element;
    this.#scrollView = scrollView;
    this.#listView = listView;
    this.#itemReconciler = options.itemReconciler;
    this.#registration = options.contentRegistration.registerContent({
      contentId: options.contentId,
      element: this.#element
    });
    this.renderLogItems();
  }

  get contentId(): string {
    return this.#registration.contentId;
  }

  get element(): HTMLElement {
    return this.#element;
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
    this.#lines.push({
      id: this.#nextLineId,
      text: `${time} ${entry.message}`
    });
    this.#nextLineId += 1;
    while (this.#lines.length > this.#maxLines) {
      this.#lines.shift();
    }
    this.#logDirty = true;
  }

  updateFrame(_frame: UiFrame): void {
    if (!this.#logDirty) return;
    this.#logDirty = false;
    this.renderLogItems();
  }

  dispose(): void {
    this.enabled = false;
    this.#itemReconciler.dispose();
    this.#registration.dispose();
  }

  private renderLogItems(): void {
    const items = this.createListItems();
    this.#scrollView.preserveEndOnMutation(() => {
      this.#itemReconciler.reconcile(items);
      this.#listView.refreshItems();
    });
  }

  private createListItems(): readonly DebugLogListItem[] {
    if (this.#lines.length === 0) {
      return [{
        key: "placeholder",
        descriptor: {
          itemId: "debug-log-placeholder",
          text: DEFAULT_DEBUG_LOG_MESSAGE,
          muted: true
        }
      }];
    }
    return this.#lines.map((line, index) => ({
      key: String(line.id),
      descriptor: {
        itemId: `debug-log-entry:${line.id}`,
        text: line.text,
        order: index
      }
    }));
  }
}

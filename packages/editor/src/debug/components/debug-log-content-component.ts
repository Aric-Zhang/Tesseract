import type { GizmoDebugLogEntry } from "actor-system/gizmo";
import type { Actor, Component, ComponentType } from "actor-system/core";
import type { UiFrame } from "ui-framework";
import type {
  ScrollViewComponent,
  UiElementComponent,
  VirtualListViewComponent,
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "ui-framework";
import type { DebugLogDataSource } from "./debug-log-data-source";

export const debugLogContentComponentType =
  "debug-log-content-component" as ComponentType<DebugLogContentComponent>;

export interface DebugLogContentComponentOptions {
  id?: string;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
  source: DebugLogDataSource;
}

const DEFAULT_DEBUG_LOG_CONTENT_ID = "debug-log-content";

export class DebugLogContentComponent implements Component, WindowRegisteredContent {
  readonly id: string;
  readonly type = debugLogContentComponentType;
  readonly actor: Actor;
  enabled = true;

  readonly #element: HTMLElement;
  readonly #scrollView: ScrollViewComponent;
  readonly #virtualList: VirtualListViewComponent;
  readonly #source: DebugLogDataSource;
  #registration: WindowRegisteredContent;
  #logDirty = true;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    scrollView: ScrollViewComponent,
    virtualList: VirtualListViewComponent,
    options: DebugLogContentComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_DEBUG_LOG_CONTENT_ID;
    this.#element = uiElement.element;
    this.#scrollView = scrollView;
    this.#virtualList = virtualList;
    this.#source = options.source;
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
    this.#source.append(entry);
    this.#logDirty = true;
  }

  updateFrame(_frame: UiFrame): void {
    if (!this.#logDirty) return;
    this.#logDirty = false;
    this.renderLogItems();
  }

  dispose(): void {
    this.enabled = false;
    this.#registration.dispose();
  }

  private renderLogItems(): void {
    this.#virtualList.refreshItemsPreservingEnd();
    this.#scrollView.refreshScrollDiagnostics();
  }
}

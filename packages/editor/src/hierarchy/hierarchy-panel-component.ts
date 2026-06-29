import type { Actor, Component, ComponentType } from "actor-system/core";
import { editorStatePaths, type EditorCommandSink } from "../editor-state";
import type { AppStateChangedEvent } from "../app-state";
import type { StateObserverResponder } from "../state-observer/state-observer-responder";
import { type TreeViewActivation, type TreeViewComponent } from "ui-framework/controls";
import { type UiElementComponent } from "ui-framework/actor-ui";
import { type WindowContentLayoutCommit, type WindowContentLayoutCommitRegistration, type WindowContentRegistrationPort, type WindowRegisteredContent } from "ui-framework/window";
import type { HierarchyObjectSource } from "./hierarchy-object-source";
import type { HierarchyTreeItemActorReconciler } from "./hierarchy-tree-item-actor-reconciler";

export const hierarchyPanelComponentType =
  "hierarchy-panel-component" as ComponentType<HierarchyPanelComponent>;

export interface HierarchyPanelComponentOptions {
  id?: string;
  objectSource: HierarchyObjectSource;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
  itemReconciler: HierarchyTreeItemActorReconciler;
}

export interface HierarchyPanelComponentServices {
  commandSink: EditorCommandSink;
}

const DEFAULT_HIERARCHY_PANEL_ID = "hierarchy-panel";

export class HierarchyPanelComponent
  implements Component, StateObserverResponder, WindowRegisteredContent {
  readonly id: string;
  readonly type = hierarchyPanelComponentType;
  readonly actor: Actor;
  enabled = true;

  readonly #objectSource: HierarchyObjectSource;
  readonly #commandSink: EditorCommandSink;
  readonly #element: HTMLElement;
  readonly #treeView: TreeViewComponent;
  readonly #itemReconciler: HierarchyTreeItemActorReconciler;
  #registration: WindowRegisteredContent;
  #activeObject: string | null = null;
  #lastItemsSignature: string | null = null;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    treeView: TreeViewComponent,
    options: HierarchyPanelComponentOptions,
    services: HierarchyPanelComponentServices
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_HIERARCHY_PANEL_ID;
    this.#objectSource = options.objectSource;
    this.#commandSink = services.commandSink;
    this.#element = uiElement.element;
    this.#treeView = treeView;
    this.#itemReconciler = options.itemReconciler;
    this.#treeView.setActivationSink({
      activateTreeItem: (activation) => this.activateTreeItem(activation)
    });
    this.#registration = options.contentRegistration.registerContent({
      contentId: options.contentId,
      element: this.#element
    });
    this.renderIfItemsChanged();
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

  updateFrame(): void {
    this.renderIfItemsChanged();
  }

  onStateChanged(event: AppStateChangedEvent): void {
    let changed = false;
    for (const change of event.changes) {
      if (change.path !== editorStatePaths.selection.activeObject) continue;
      this.#activeObject = change.nextValue as string | null;
      changed = true;
    }
    if (changed) {
      this.renderIfItemsChanged();
    }
  }

  dispose(): void {
    this.enabled = false;
    this.#treeView.setActivationSink(undefined);
    this.#itemReconciler.dispose();
    this.#registration.dispose();
  }

  private renderIfItemsChanged(): void {
    const items = this.#objectSource.listObjects();
    const signature = createItemsSignature(items, this.#activeObject);
    if (signature === this.#lastItemsSignature) {
      return;
    }
    this.#lastItemsSignature = signature;
    this.#itemReconciler.reconcile(items, this.#activeObject);
    this.#treeView.refreshItems();
  }

  private activateTreeItem(activation: TreeViewActivation): void {
    this.#commandSink.submit({
      source: { id: this.id, kind: activation.inputKind },
      target: editorStatePaths.selection.activeObject,
      operation: "set",
      value: activation.itemId
    });
  }
}

function createItemsSignature(items: readonly { readonly id: string; readonly label: string; readonly parentId?: string | null; readonly activeSelf?: boolean; readonly activeInHierarchy?: boolean }[], activeObject: string | null): string {
  return JSON.stringify(items.map((item) => [
    item.id,
    item.label,
    item.parentId ?? null,
    item.activeSelf ?? true,
    item.activeInHierarchy ?? item.activeSelf ?? true,
    item.id === activeObject
  ]));
}

import {
  normalizeActorSelectionSnapshot,
  type Actor,
  type ActorSelectionSnapshot,
  type Component,
  type ComponentType
} from "actor-system/core";
import { type UiElementComponent } from "ui-framework/actor-ui";
import { type WindowContentLayoutCommit, type WindowContentLayoutCommitRegistration, type WindowContentRegistrationPort, type WindowRegisteredContent } from "ui-framework/window";

import type { AppStateChangedEvent } from "../app-state";
import { editorStatePaths } from "../editor-state";
import type { StateObserverResponder } from "../state-observer/state-observer-responder";
import type { InspectorActorDisplaySource } from "./inspector-actor-display-source";
import type { InspectorSelectionSnapshotSource } from "./inspector-selection-source";

export const inspectorContentComponentType =
  "inspector-content-component" as ComponentType<InspectorContentComponent>;

export interface InspectorContentComponentOptions {
  readonly id?: string;
  readonly contentId: string;
  readonly contentRegistration: WindowContentRegistrationPort;
  readonly actorDisplaySource: InspectorActorDisplaySource;
  readonly selectionSource: InspectorSelectionSnapshotSource;
  readonly initialLocked?: boolean;
  readonly initialInspectedActorId?: string | null;
}

const DEFAULT_INSPECTOR_CONTENT_ID = "inspector-content";

export class InspectorContentComponent
  implements Component, StateObserverResponder, WindowRegisteredContent {
  readonly type = inspectorContentComponentType;
  readonly id: string;
  readonly actor: Actor;
  enabled = true;

  readonly #element: HTMLElement;
  readonly #actorDisplaySource: InspectorActorDisplaySource;
  readonly #selectionSource: InspectorSelectionSnapshotSource;
  #registration: WindowRegisteredContent;
  #inspectedActorId: string | null;
  #locked: boolean;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: InspectorContentComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_INSPECTOR_CONTENT_ID;
    this.#element = uiElement.element;
    this.#actorDisplaySource = options.actorDisplaySource;
    this.#selectionSource = options.selectionSource;
    this.#locked = options.initialLocked === true;
    this.#inspectedActorId = this.#locked && options.initialInspectedActorId !== undefined
      ? options.initialInspectedActorId
      : this.currentActiveActorId();
    this.#registration = options.contentRegistration.registerContent({
      contentId: options.contentId,
      element: this.#element
    });
    this.render();
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

  get inspectedActorId(): string | null {
    return this.#inspectedActorId;
  }

  get locked(): boolean {
    return this.#locked;
  }

  setInteractable(interactable: boolean): void {
    this.#registration.setInteractable(interactable);
  }

  subscribeLayoutCommit(
    callback: (commit: WindowContentLayoutCommit) => void
  ): WindowContentLayoutCommitRegistration {
    return this.#registration.subscribeLayoutCommit(callback);
  }

  onStateChanged(event: AppStateChangedEvent): void {
    if (this.#locked) return;
    for (const change of event.changes) {
      if (change.path !== editorStatePaths.selection.snapshot) continue;
      this.inspectActor(normalizeActorSelectionSnapshot(change.nextValue as ActorSelectionSnapshot).activeActorId);
      return;
    }
  }

  setLocked(locked: boolean): void {
    if (this.#locked === locked) return;
    this.#locked = locked;
    if (!this.#locked) {
      this.inspectActor(this.currentActiveActorId());
      return;
    }
    this.render();
  }

  inspectActor(actorId: string | null): void {
    this.#inspectedActorId = actorId;
    this.render();
  }

  dispose(): void {
    this.enabled = false;
    this.#registration.dispose();
  }

  private currentActiveActorId(): string | null {
    return normalizeActorSelectionSnapshot(this.#selectionSource.getSelectionSnapshot()).activeActorId;
  }

  private render(): void {
    this.#element.dataset.inspectorContent = "true";
    this.#element.dataset.inspectorLocked = String(this.#locked);
    this.#element.dataset.inspectorActorId = this.#inspectedActorId ?? "";
    if (!this.#inspectedActorId) {
      this.#element.textContent = "No actor selected";
      this.#element.dataset.inspectorState = "empty";
      return;
    }
    const actorName = this.#actorDisplaySource.getActorDisplayName(this.#inspectedActorId);
    if (actorName === null) {
      this.#element.textContent = `Missing actor: ${this.#inspectedActorId}`;
      this.#element.dataset.inspectorState = "missing";
      return;
    }
    this.#element.textContent = `Inspecting: ${actorName}`;
    this.#element.dataset.inspectorState = "inspecting";
  }
}

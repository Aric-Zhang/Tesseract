import {
  normalizeActorSelectionSnapshot,
  type Actor,
  type ActorSelectionSnapshot,
  type Component,
  type ComponentType
} from "actor-system/core";
import {
  type FrameUpdateParticipant,
  type UiElementComponent,
  type UiFrame
} from "ui-framework/actor-ui";

import type { AppStateChangedEvent } from "../app-state";
import { editorStatePaths } from "../editor-state";
import type { StateObserverResponder } from "../state-observer/state-observer-responder";
import type {
  InspectorActorDetails,
  InspectorActorDetailsSource,
  InspectorComponentSummary
} from "./inspector-actor-details-source";
import type { InspectorPropertySummary } from "./inspector-component-descriptor";
import {
  createPropertyControlKey,
  type InspectorEditablePropertyControlSpec,
  type InspectorPropertyControlReconcilerPort
} from "./inspector-property-control-actor-reconciler";
import type { InspectorSelectionSnapshotSource } from "./inspector-selection-source";

export const inspectorContentComponentType =
  "inspector-content-component" as ComponentType<InspectorContentComponent>;

export interface InspectorContentComponentOptions {
  readonly id?: string;
  readonly actorDetailsSource: InspectorActorDetailsSource;
  readonly selectionSource: InspectorSelectionSnapshotSource;
  readonly propertyControlReconciler: InspectorPropertyControlReconcilerPort;
  readonly lockStateSink?: InspectorLockStateSink;
  readonly initialLocked?: boolean;
  readonly initialInspectedActorId?: string | null;
}

export interface InspectorLockStateSink {
  inspectorLockStateChanged(locked: boolean): void;
}

const DEFAULT_INSPECTOR_CONTENT_ID = "inspector-content";

export class InspectorContentComponent
  implements Component, StateObserverResponder, FrameUpdateParticipant {
  readonly type = inspectorContentComponentType;
  readonly id: string;
  readonly actor: Actor;
  enabled = true;

  readonly #element: HTMLElement;
  readonly #actorDetailsSource: InspectorActorDetailsSource;
  readonly #selectionSource: InspectorSelectionSnapshotSource;
  readonly #propertyControlReconciler: InspectorPropertyControlReconcilerPort;
  readonly #lockStateSink?: InspectorLockStateSink;
  #inspectedActorId: string | null;
  #locked: boolean;
  #lastRenderSignature: string | null = null;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: InspectorContentComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_INSPECTOR_CONTENT_ID;
    this.#element = uiElement.element;
    this.#actorDetailsSource = options.actorDetailsSource;
    this.#selectionSource = options.selectionSource;
    this.#propertyControlReconciler = options.propertyControlReconciler;
    this.#lockStateSink = options.lockStateSink;
    this.#locked = options.initialLocked === true;
    this.#inspectedActorId = this.#locked && options.initialInspectedActorId !== undefined
      ? options.initialInspectedActorId
      : this.currentActiveActorId();
    this.render();
  }

  get element(): HTMLElement {
    return this.#element;
  }

  get inspectedActorId(): string | null {
    return this.#inspectedActorId;
  }

  get locked(): boolean {
    return this.#locked;
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
      this.#lockStateSink?.inspectorLockStateChanged(this.#locked);
      return;
    }
    this.render();
    this.#lockStateSink?.inspectorLockStateChanged(this.#locked);
  }

  inspectActor(actorId: string | null): void {
    this.#inspectedActorId = actorId;
    this.#lastRenderSignature = null;
    this.render();
  }

  updateFrame(_frame: UiFrame): void {
    if (!this.enabled) return;
    this.render();
  }

  dispose(): void {
    this.enabled = false;
    this.#lastRenderSignature = null;
    this.#propertyControlReconciler.dispose();
  }

  private currentActiveActorId(): string | null {
    return normalizeActorSelectionSnapshot(this.#selectionSource.getSelectionSnapshot()).activeActorId;
  }

  private render(): void {
    this.#element.dataset.inspectorContent = "true";
    this.#element.dataset.inspectorLocked = String(this.#locked);
    this.#element.dataset.inspectorActorId = this.#inspectedActorId ?? "";
    if (!this.#inspectedActorId) {
      this.#element.dataset.inspectorState = "empty";
      this.#element.dataset.inspectorComponentCount = "0";
      this.#propertyControlReconciler.reconcile([]);
      if (!this.commitRenderSignature(["empty", this.#locked])) return;
      this.replaceContent(this.createStateMessage("No actor selected"));
      return;
    }
    const details = this.#actorDetailsSource.getActorDetails(this.#inspectedActorId);
    if (!details) {
      this.#element.dataset.inspectorState = "missing";
      this.#element.dataset.inspectorComponentCount = "0";
      this.#propertyControlReconciler.reconcile([]);
      if (!this.commitRenderSignature(["missing", this.#locked, this.#inspectedActorId])) return;
      this.replaceContent(this.createStateMessage(`Missing actor: ${this.#inspectedActorId}`));
      return;
    }
    this.#element.dataset.inspectorState = "inspecting";
    this.#element.dataset.inspectorComponentCount = String(details.components.length);
    const propertyControlElements = this.#propertyControlReconciler.reconcile(
      createEditablePropertyControlSpecs(details)
    );
    if (!this.commitRenderSignature(createActorDetailsRenderSignature(details, this.#locked))) return;
    this.replaceContent(this.createActorDetailsContent(details, propertyControlElements));
  }

  private createActorDetailsContent(
    details: InspectorActorDetails,
    propertyControlElements: ReadonlyMap<string, HTMLElement>
  ): HTMLElement {
    const root = this.createElement("div", "inspector-window__details");
    const header = this.createElement("div", "inspector-window__actor-header");
    const title = this.createElement("div", "inspector-window__actor-title");
    title.textContent = details.actorName;
    const meta = this.createElement("div", "inspector-window__actor-meta");
    meta.textContent = `${details.actorId} | ${details.actorEnabled ? "enabled" : "disabled"}`;
    header.append(title, meta);

    const componentList = this.createElement("div", "inspector-window__component-list");
    componentList.dataset.inspectorComponentList = "true";
    if (details.components.length === 0) {
      const empty = this.createElement("div", "inspector-window__component-empty");
      empty.textContent = "No components";
      componentList.append(empty);
    } else {
      componentList.append(
        ...details.components.map((component) =>
          this.createComponentSection(details.actorId, component, propertyControlElements)
        )
      );
    }
    root.append(header, componentList);
    return root;
  }

  private createComponentSection(
    actorId: string,
    component: InspectorComponentSummary,
    propertyControlElements: ReadonlyMap<string, HTMLElement>
  ): HTMLElement {
    const section = this.createElement("section", "inspector-window__component-section");
    section.dataset.inspectorComponentId = component.id;
    section.dataset.inspectorComponentType = component.type;
    section.dataset.inspectorComponentEnabled = String(component.enabled);

    const title = this.createElement("div", "inspector-window__component-title");
    title.textContent = component.displayName;
    const meta = this.createElement("div", "inspector-window__component-meta");
    meta.textContent = `${component.type} | ${component.id} | ${component.enabled ? "enabled" : "disabled"}`;
    section.append(title, meta, this.createPropertyList(actorId, component, propertyControlElements));
    return section;
  }

  private createPropertyList(
    actorId: string,
    component: InspectorComponentSummary,
    propertyControlElements: ReadonlyMap<string, HTMLElement>
  ): HTMLElement {
    const list = this.createElement("div", "inspector-window__property-list");
    list.dataset.inspectorPropertyList = "true";
    if (component.properties.length === 0) {
      const empty = this.createElement("div", "inspector-window__property-empty");
      empty.textContent = "No visible properties";
      list.append(empty);
      return list;
    }
    list.append(
      ...component.properties.map((property) =>
        this.createPropertyRow(actorId, component, property, propertyControlElements)
      )
    );
    return list;
  }

  private createPropertyRow(
    actorId: string,
    component: InspectorComponentSummary,
    property: InspectorPropertySummary,
    propertyControlElements: ReadonlyMap<string, HTMLElement>
  ): HTMLElement {
    const row = this.createElement("div", "inspector-window__property-row");
    row.dataset.inspectorPropertyId = property.id;
    row.dataset.inspectorPropertyKind = property.kind;
    row.dataset.inspectorPropertyLabel = property.label;
    const label = this.createElement("span", "inspector-window__property-label");
    label.textContent = property.label;
    const value = this.createElement("span", "inspector-window__property-value");
    const controlElement = propertyControlElements.get(createPropertyControlKey({
      actorId,
      componentId: component.id,
      componentType: component.type,
      property
    }));
    if (controlElement) {
      value.dataset.inspectorPropertyEditable = "true";
      value.replaceChildren(controlElement);
    } else {
      value.textContent = property.value;
    }
    row.append(label, value);
    return row;
  }

  private createStateMessage(message: string): HTMLElement {
    const element = this.createElement("div", "inspector-window__state-message");
    element.textContent = message;
    return element;
  }

  private createElement(tagName: string, className: string): HTMLElement {
    const element = this.#element.ownerDocument.createElement(tagName);
    element.className = className;
    return element;
  }

  private replaceContent(...children: HTMLElement[]): void {
    this.#element.replaceChildren(...children);
  }

  private commitRenderSignature(parts: readonly unknown[]): boolean {
    const signature = JSON.stringify(parts);
    if (signature === this.#lastRenderSignature) return false;
    this.#lastRenderSignature = signature;
    return true;
  }
}

function createActorDetailsRenderSignature(details: InspectorActorDetails, locked: boolean): readonly unknown[] {
  return [
    "inspecting",
    locked,
    details.actorId,
    details.actorName,
    details.actorEnabled,
    details.components.map((component) => [
      component.id,
      component.type,
      component.displayName,
      component.enabled,
      component.properties.map((property) => [
        property.id,
        property.label,
        property.value,
        property.kind,
        property.edit
          ? [
              property.edit.control,
              property.edit.value,
              property.edit.min,
              property.edit.max,
              property.edit.step,
              property.edit.disabled
            ]
          : null
      ])
    ])
  ];
}

function createEditablePropertyControlSpecs(details: InspectorActorDetails): readonly InspectorEditablePropertyControlSpec[] {
  return details.components.flatMap((component) =>
    component.properties
      .filter((property) => property.edit?.control === "number")
      .map((property) => ({
        actorId: details.actorId,
        componentId: component.id,
        componentType: component.type,
        property
      }))
  );
}

import type { Actor, ActorCreationContext } from "actor-system/core";
import { uiElementComponentType } from "ui-framework/actor-ui";
import {
  numberFieldComponentType,
  type NumberFieldComponent,
  type NumberFieldCommit,
  type NumberFieldDescriptor
} from "ui-framework/controls";
import type { InspectorPropertySummary } from "./inspector-component-descriptor";
import type { InspectorPropertyEditController } from "./inspector-property-edit-controller";

export const INSPECTOR_PROPERTY_CONTROL_ACTOR_SEGMENT = ":property-control:";

export interface InspectorEditablePropertyControlSpec {
  readonly actorId: string;
  readonly componentId: string;
  readonly componentType: string;
  readonly property: InspectorPropertySummary;
}

interface PropertyControlEntry {
  readonly actorId: string;
  readonly key: string;
}

export interface InspectorPropertyControlReconcilerPort {
  reconcile(specs: readonly InspectorEditablePropertyControlSpec[]): ReadonlyMap<string, HTMLElement>;
  dispose(): void;
}

export class InspectorPropertyControlActorReconciler implements InspectorPropertyControlReconcilerPort {
  readonly #context: ActorCreationContext;
  readonly #parentActor: Actor;
  readonly #editController: InspectorPropertyEditController;
  readonly #document?: Pick<Document, "createElement">;
  readonly #entriesByKey = new Map<string, PropertyControlEntry>();

  constructor(options: {
    readonly context: ActorCreationContext;
    readonly parentActor: Actor;
    readonly editController: InspectorPropertyEditController;
    readonly document?: Pick<Document, "createElement">;
  }) {
    this.#context = options.context;
    this.#parentActor = options.parentActor;
    this.#editController = options.editController;
    this.#document = options.document;
  }

  reconcile(specs: readonly InspectorEditablePropertyControlSpec[]): ReadonlyMap<string, HTMLElement> {
    const editableSpecs = specs.filter((spec) => spec.property.edit?.control === "number");
    const nextKeys = new Set(editableSpecs.map(createPropertyControlKey));
    for (const [key, entry] of [...this.#entriesByKey]) {
      if (nextKeys.has(key)) continue;
      const actor = this.#context.actorSystem.getActor(entry.actorId);
      if (actor) {
        this.#context.actorSystem.destroyActor(actor);
      }
      this.#entriesByKey.delete(key);
    }

    const elementsByKey = new Map<string, HTMLElement>();
    for (const spec of editableSpecs) {
      const key = createPropertyControlKey(spec);
      const actor = this.getOrCreateActor(key, spec);
      const numberField = this.getOrCreateNumberField(actor, spec);
      numberField.setDescriptor(toNumberFieldDescriptor(spec));
      elementsByKey.set(key, numberField.element);
    }
    return elementsByKey;
  }

  dispose(): void {
    for (const entry of [...this.#entriesByKey.values()]) {
      const actor = this.#context.actorSystem.getActor(entry.actorId);
      if (actor) {
        this.#context.actorSystem.destroyActor(actor);
      }
    }
    this.#entriesByKey.clear();
  }

  private getOrCreateActor(key: string, spec: InspectorEditablePropertyControlSpec): Actor {
    const existingEntry = this.#entriesByKey.get(key);
    if (existingEntry) {
      const existingActor = this.#context.actorSystem.getActor(existingEntry.actorId);
      if (existingActor) return existingActor;
    }
    const actorId = createInspectorPropertyControlActorId(this.#parentActor.id, key);
    const actor = this.#context.actorSystem.createActor({
      id: actorId,
      name: `${spec.property.label} Field`,
      parent: this.#parentActor
    });
    this.#context.componentRegistry.addComponent(actor, uiElementComponentType, {
      className: "inspector-window__property-control",
      document: this.#document
    });
    this.#entriesByKey.set(key, { actorId, key });
    return actor;
  }

  private getOrCreateNumberField(actor: Actor, spec: InspectorEditablePropertyControlSpec): NumberFieldComponent {
    const existing = this.#context.componentRegistry.getComponent(actor, numberFieldComponentType);
    if (existing) return existing;
    return this.#context.componentRegistry.addComponent(actor, numberFieldComponentType, {
      id: "inspector-property-number-field",
      descriptor: toNumberFieldDescriptor(spec),
      commitSink: {
        commitNumberField: (commit: NumberFieldCommit) => {
          this.#editController.commit({
            actorId: spec.actorId,
            componentId: spec.componentId,
            componentType: spec.componentType,
            propertyId: spec.property.id,
            value: commit.value,
            timeStamp: commit.timeStamp,
            source: commit.componentId
          });
        }
      },
      document: this.#document
    });
  }
}

export function createPropertyControlKey(spec: InspectorEditablePropertyControlSpec): string {
  return `${spec.actorId}\u0000${spec.componentId}\u0000${spec.property.id}`;
}

export function createInspectorPropertyControlActorId(parentActorId: string, key: string): string {
  return `${parentActorId}${INSPECTOR_PROPERTY_CONTROL_ACTOR_SEGMENT}${encodeActorIdSegment(key)}`;
}

export function isInspectorPropertyControlActorId(actorId: string): boolean {
  return actorId.includes(INSPECTOR_PROPERTY_CONTROL_ACTOR_SEGMENT);
}

function toNumberFieldDescriptor(spec: InspectorEditablePropertyControlSpec): NumberFieldDescriptor {
  const edit = spec.property.edit;
  if (!edit || edit.control !== "number") {
    throw new Error(`Inspector property ${spec.property.id} is not an editable number property.`);
  }
  return {
    id: spec.property.id,
    label: spec.property.label,
    value: edit.value,
    min: edit.min,
    max: edit.max,
    step: edit.step,
    disabled: edit.disabled
  };
}

function encodeActorIdSegment(value: string): string {
  return Array.from(value)
    .map((char) => char.codePointAt(0)?.toString(16).padStart(4, "0") ?? "0000")
    .join("-");
}

import type { ActorSystemView } from "actor-system/core";
import {
  cloneInspectorPropertySummary,
  type InspectorPropertySummary
} from "./inspector-component-descriptor";
import type { InspectorComponentDescriptorRegistry } from "./inspector-component-descriptor-registry";

export interface InspectorComponentSummary {
  readonly id: string;
  readonly type: string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly properties: readonly InspectorPropertySummary[];
}

export interface InspectorActorDetails {
  readonly actorId: string;
  readonly actorName: string;
  readonly actorEnabled: boolean;
  readonly components: readonly InspectorComponentSummary[];
}

export interface InspectorActorDetailsSource {
  getActorDetails(actorId: string): InspectorActorDetails | null;
}

export interface ActorSystemInspectorActorDetailsSourceOptions {
  readonly descriptorRegistry: InspectorComponentDescriptorRegistry;
}

export function createActorSystemInspectorActorDetailsSource(
  actorSystem: ActorSystemView,
  options: ActorSystemInspectorActorDetailsSourceOptions
): InspectorActorDetailsSource {
  return {
    getActorDetails(actorId: string): InspectorActorDetails | null {
      const actor = actorSystem.getActor(actorId);
      if (!actor) return null;
      const components = actor.listComponents().map((component) => Object.freeze({
        id: component.id,
        type: component.type,
        displayName: options.descriptorRegistry.get(component.type)?.displayName ??
          formatInspectorComponentDisplayName(component.type),
        enabled: component.enabled,
        properties: readComponentProperties({
          actorId: actor.id,
          componentId: component.id,
          componentType: component.type,
          component,
          descriptorRegistry: options.descriptorRegistry
        })
      }));
      return Object.freeze({
        actorId: actor.id,
        actorName: actor.name,
        actorEnabled: actor.enabled,
        components: Object.freeze(components)
      });
    }
  };
}

export function formatInspectorComponentDisplayName(type: string): string {
  return type;
}

function readComponentProperties(options: {
  readonly actorId: string;
  readonly componentId: string;
  readonly componentType: string;
  readonly component: unknown;
  readonly descriptorRegistry: InspectorComponentDescriptorRegistry;
}): readonly InspectorPropertySummary[] {
  const descriptor = options.descriptorRegistry.get(options.componentType);
  if (!descriptor) return Object.freeze([]);
  try {
    return Object.freeze(descriptor.readProperties(options.component, {
      actorId: options.actorId,
      componentId: options.componentId,
      componentType: options.componentType
    }).map(cloneInspectorPropertySummary));
  } catch (error) {
    return Object.freeze([cloneInspectorPropertySummary({
      id: "descriptor-error",
      label: "Descriptor error",
      value: error instanceof Error ? error.message : String(error),
      kind: "error"
    })]);
  }
}

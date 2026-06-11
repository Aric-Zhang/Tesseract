import { createRegisteredActor, type Actor, type RegisteredActor } from "../../actor-runtime";
import type { FeatureActorContext } from "../../runtime/ports";
import type { WindowContentRegistrationPort } from "../../window-runtime";
import {
  inspectorContentComponentType,
  type InspectorContentComponent
} from "./inspector-content-component";

export interface InspectorViewActorOptions {
  readonly actorId: string;
  readonly actorName: string;
  readonly parentActor: Actor;
  readonly label: string;
  readonly document?: Pick<Document, "createElement">;
  readonly contentId: string;
  readonly contentRegistration: WindowContentRegistrationPort;
}

export interface RegisteredInspectorViewActor extends RegisteredActor<InspectorContentComponent> {
  disposeRuntimeTracking?(): void;
}

export function createInspectorViewActor(
  context: FeatureActorContext,
  options: InspectorViewActorOptions
): RegisteredInspectorViewActor {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName,
    parent: options.parentActor
  });
  try {
    const component = context.componentRegistry.addComponent(actor, inspectorContentComponentType, {
      id: "inspector-content",
      label: options.label,
      document: options.document,
      contentId: options.contentId,
      contentRegistration: options.contentRegistration
    });
    let untrack: ReturnType<FeatureActorContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredInspectorViewActor = {
      actor: baseHandle.actor,
      component: baseHandle.component,
      dispose: () => baseHandle.dispose(),
      disposeRuntimeTracking: () => {
        untrack?.dispose();
        untrack = null;
      }
    };
    untrack = context.trackRegisteredActor(handle);
    return handle;
  } catch (error) {
    if (context.actorSystem.hasActor(actor)) {
      context.actorSystem.destroyActor(actor);
    }
    throw error;
  }
}

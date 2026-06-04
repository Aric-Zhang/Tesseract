import type * as THREE from "three";
import { createRegisteredActor, type Actor, type RegisteredActor } from "../../actor-runtime";
import type { FeatureActorContext } from "../../runtime/ports";
import {
  tesseract4ComponentType,
  type Tesseract4Component,
  type Tesseract4ComponentOptions,
  type Tesseract4RuntimeObjectFactory
} from "./tesseract4-component";

export interface Tesseract4ActorOptions extends Tesseract4ComponentOptions {
  actorId?: string;
  actorName?: string;
  parentActor?: Actor | string | null;
  scene?: THREE.Scene;
}

export function createTesseract4Actor(
  context: FeatureActorContext,
  options: Tesseract4ActorOptions = {},
  createObject?: Tesseract4RuntimeObjectFactory
): RegisteredActor<Tesseract4Component> {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId,
    parent: options.parentActor
  });
  try {
    const component = context.componentRegistry.addComponent(actor, tesseract4ComponentType, {
      ...options,
      createObject: createObject ?? options.createObject
    });
    let untrack: ReturnType<FeatureActorContext["trackRegisteredActor"]> | null = null;
    const handle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    untrack = context.trackRegisteredActor(handle);
    return handle;
  } catch (error) {
    if (context.actorSystem.hasActor(actor)) {
      context.actorSystem.destroyActor(actor);
    }
    throw error;
  }
}

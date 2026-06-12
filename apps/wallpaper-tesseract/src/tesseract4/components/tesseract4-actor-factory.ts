import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-core";
import {
  tesseract4ComponentType,
  type Tesseract4Component,
  type Tesseract4ComponentOptions,
  type Tesseract4RuntimeRenderableFactory
} from "./tesseract4-component";

export interface Tesseract4ActorOptions extends Tesseract4ComponentOptions {
  actorId?: string;
  actorName?: string;
  parentActor?: Actor | string | null;
}

export function createTesseract4Actor(
  context: ActorCreationContext,
  options: Tesseract4ActorOptions = {},
  createRenderable?: Tesseract4RuntimeRenderableFactory
): RegisteredActor<Tesseract4Component> {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId,
    parent: options.parentActor
  });
  try {
    const component = context.componentRegistry.addComponent(actor, tesseract4ComponentType, {
      ...options,
      createRenderable: createRenderable ?? options.createRenderable
    });
    let untrack: ReturnType<ActorCreationContext["trackRegisteredActor"]> | null = null;
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

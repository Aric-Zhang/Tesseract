import { describe, expect, it } from "vitest";
import { ActorSystem } from "./actor-system";
import { ComponentRegistry } from "./component-registry";
import { createActorCreationScope } from "./actor-creation-scope";
import { componentType, type Component } from "./component";
import { createRegisteredActor } from "./registered-actor";

const testComponentType = componentType<Component>("test-component");

describe("ActorCreationScope", () => {
  it("tracks registered actors and disposes them in reverse order", () => {
    const calls: string[] = [];
    const actorSystem = new ActorSystem();
    const componentRegistry = new ComponentRegistry({ actorSystem });
    componentRegistry.registerDefinition({
      type: testComponentType,
      createId: () => "component",
      create(actor) {
        return {
          actor,
          id: "component",
          type: testComponentType,
          enabled: true,
          dispose() {
            calls.push(`component:${actor.id}`);
          }
        };
      }
    });
    const scope = createActorCreationScope({ actorSystem, componentRegistry });
    const actorA = actorSystem.createActor({ id: "a" });
    const actorB = actorSystem.createActor({ id: "b" });
    scope.trackRegisteredActor(createRegisteredActor({
      actorSystem,
      actor: actorA,
      component: componentRegistry.addComponent(actorA, testComponentType)
    }));
    scope.trackRegisteredActor(createRegisteredActor({
      actorSystem,
      actor: actorB,
      component: componentRegistry.addComponent(actorB, testComponentType)
    }));

    scope.dispose();

    expect(calls).toEqual(["component:b", "component:a"]);
    expect(actorSystem.getActor("a")).toBeNull();
    expect(actorSystem.getActor("b")).toBeNull();
  });

  it("untracks registered actors when their registration is disposed", () => {
    const actorSystem = new ActorSystem();
    const componentRegistry = new ComponentRegistry({ actorSystem });
    componentRegistry.registerDefinition({
      type: testComponentType,
      createId: () => "component",
      create(actor) {
        return { actor, id: "component", type: testComponentType, enabled: true };
      }
    });
    const scope = createActorCreationScope({ actorSystem, componentRegistry });
    const actor = actorSystem.createActor({ id: "a" });
    const registered = createRegisteredActor({
      actorSystem,
      actor,
      component: componentRegistry.addComponent(actor, testComponentType)
    });
    const registration = scope.trackRegisteredActor(registered);
    registration.dispose();

    scope.dispose();

    expect(actorSystem.getActor("a")).toBe(actor);
  });
});

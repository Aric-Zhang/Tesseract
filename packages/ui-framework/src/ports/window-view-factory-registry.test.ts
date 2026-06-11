import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-core";
import {
  WindowContentRegistry,
  type WindowRegisteredContent
} from "./window-content-host";
import { getWindowViewFactoryIdentity, WindowViewFactoryRegistry } from "./window-view-factory-registry";

describe("WindowViewFactoryRegistry", () => {
  it("registers runtime factories by stable view key and passes identity to creation", () => {
    const actorSystem = new ActorSystem();
    const parentFrameActor = actorSystem.createActor({ id: "debug-frame" });
    const registry = new WindowViewFactoryRegistry();
    const contentRegistration = new WindowContentRegistry();
    const receivedIdentities: unknown[] = [];
    const registration = registry.register({
      viewKey: "debug",
      label: "Debug Log",
      createViewRuntime: (options) => {
        receivedIdentities.push(options.identity);
        const viewActor = actorSystem.createActor({
          id: "debug-view",
          parent: options.parentFrameActor
        });
        return {
          viewActor,
          content: createContent(),
          disposeViewRuntime() {}
        };
      }
    });

    const created = registry.createViewRuntime("debug", {
      reason: "menu",
      parentFrameActor,
      contentRegistration
    });

    expect(registry.list().map((factory) => factory.viewKey)).toEqual(["debug"]);
    expect(receivedIdentities).toEqual([{
      viewKey: "debug",
      typeKey: "debug",
      instanceId: "debug:default",
      multiplicity: "singleton"
    }]);
    expect(created.viewActor.id).toBe("debug-view");
    expect(actorSystem.getParentId(created.viewActor)).toBe("debug-frame");
    expect(created.content.element).toBe(createContentElement);
    registration.dispose();
    expect(registry.get("debug")).toBeNull();
  });

  it("rejects duplicate and missing view keys", () => {
    const actorSystem = new ActorSystem();
    const parentFrameActor = actorSystem.createActor({ id: "debug-frame" });
    const registry = new WindowViewFactoryRegistry();
    const contentRegistration = new WindowContentRegistry();
    const factory = {
      viewKey: "debug",
      label: "Debug Log",
      createViewRuntime: () => {
        throw new Error("not used");
      }
    };

    registry.register(factory);

    expect(() => registry.register(factory)).toThrow(/already registered/);
    expect(() => registry.createViewRuntime("hierarchy", {
      reason: "menu",
      parentFrameActor,
      contentRegistration
    })).toThrow(/not registered/);
  });

  it("keeps menu creation keyed by viewKey while carrying future identity metadata", () => {
    const registry = new WindowViewFactoryRegistry();
    const factory = {
      viewKey: "scene:preview",
      typeKey: "scene",
      multiplicity: "multi-instance" as const,
      label: "Scene Preview",
      createViewRuntime: () => {
        throw new Error("not used");
      }
    };

    registry.register(factory);

    expect(registry.get("scene:preview")).toBe(factory);
    expect(registry.get("scene")).toBeNull();
    expect(registry.listByType("scene")).toEqual([factory]);
    expect(registry.getIdentity("scene:preview")).toEqual({
      viewKey: "scene:preview",
      typeKey: "scene",
      instanceId: "scene:preview",
      multiplicity: "multi-instance"
    });
    expect(getWindowViewFactoryIdentity(factory)).toEqual({
      viewKey: "scene:preview",
      typeKey: "scene",
      instanceId: "scene:preview",
      multiplicity: "multi-instance"
    });
  });
});

const createContentElement = {} as HTMLElement;

function createContent(): WindowRegisteredContent {
  return {
    contentId: "content:debug",
    element: createContentElement,
    get interactable() {
      return true;
    },
    setInteractable() {},
    subscribeLayoutCommit() {
      return { dispose() {} };
    },
    dispose() {}
  };
}

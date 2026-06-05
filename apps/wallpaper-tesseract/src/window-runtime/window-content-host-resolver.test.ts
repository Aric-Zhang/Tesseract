import { describe, expect, it } from "vitest";
import { ActorSystem, type Actor, type ComponentRegistryView } from "../actor-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent
} from "./floating-window-component";
import type { WindowContentHost } from "./floating-window-host";
import {
  findOwningFloatingWindowHost,
  findOwningWindowContentHost
} from "./window-content-host-resolver";

describe("window content host resolver", () => {
  it("returns the floating window host for the frame actor itself", () => {
    const actorSystem = new ActorSystem();
    const frameActor = actorSystem.createActor({ id: "debug-frame" });
    const frameHost = createFrameHost({
      id: "debug-window",
      tabIds: ["debug-view"]
    });
    const componentRegistry = createComponentRegistryView(new Map([
      [frameActor.id, frameHost]
    ]));

    expect(findOwningFloatingWindowHost(actorSystem, componentRegistry, frameActor)).toBe(frameHost);
    expect(findOwningWindowContentHost(actorSystem, componentRegistry, frameActor)).toBe(frameHost);
  });

  it("returns a view-scoped content host for a direct view actor child", () => {
    const actorSystem = new ActorSystem();
    const frameActor = actorSystem.createActor({ id: "debug-frame" });
    const viewActor = actorSystem.createActor({ id: "debug-view", parent: frameActor });
    const viewHost = createContentHost("debug-window:debug-view");
    const frameHost = createFrameHost({
      id: "debug-window",
      tabIds: ["debug-view"],
      contentHosts: new Map([["debug-view", viewHost]])
    });
    const componentRegistry = createComponentRegistryView(new Map([
      [frameActor.id, frameHost]
    ]));

    expect(findOwningWindowContentHost(actorSystem, componentRegistry, viewActor)).toBe(viewHost);
  });

  it("returns the nearest view-scoped host for descendants inside a view actor", () => {
    const actorSystem = new ActorSystem();
    const frameActor = actorSystem.createActor({ id: "scene-frame" });
    const viewActor = actorSystem.createActor({ id: "scene-view", parent: frameActor });
    const tesseractActor = actorSystem.createActor({ id: "tesseract-4", parent: viewActor });
    const viewHost = createContentHost("scene-window:scene-view");
    const frameHost = createFrameHost({
      id: "scene-window",
      tabIds: ["scene-view"],
      contentHosts: new Map([["scene-view", viewHost]])
    });
    const componentRegistry = createComponentRegistryView(new Map([
      [frameActor.id, frameHost]
    ]));

    expect(findOwningWindowContentHost(actorSystem, componentRegistry, tesseractActor)).toBe(viewHost);
  });

  it("falls back to the frame host when the child actor is not a tab view", () => {
    const actorSystem = new ActorSystem();
    const frameActor = actorSystem.createActor({ id: "debug-frame" });
    const childActor = actorSystem.createActor({ id: "frame-helper", parent: frameActor });
    const frameHost = createFrameHost({
      id: "debug-window",
      tabIds: ["debug-view"]
    });
    const componentRegistry = createComponentRegistryView(new Map([
      [frameActor.id, frameHost]
    ]));

    expect(findOwningWindowContentHost(actorSystem, componentRegistry, childActor)).toBe(frameHost);
  });
});

function createComponentRegistryView(
  hostsByActorId: ReadonlyMap<string, FloatingWindowComponent>
): ComponentRegistryView {
  return {
    getComponent(actor, type) {
      return type === floatingWindowComponentType
        ? (hostsByActorId.get(actor.id) as never) ?? null
        : null;
    },
    getComponents() {
      return [];
    },
    hasComponent(actor: Actor, type) {
      return type === floatingWindowComponentType && hostsByActorId.has(actor.id);
    }
  };
}

function createFrameHost(options: {
  readonly id: string;
  readonly tabIds: readonly string[];
  readonly contentHosts?: ReadonlyMap<string, WindowContentHost>;
}): FloatingWindowComponent {
  const host = {
    id: options.id,
    hasTab(viewActorId: string) {
      return options.tabIds.includes(viewActorId);
    },
    getContentHost(viewActorId: string) {
      return options.contentHosts?.get(viewActorId) ?? createContentHost(`${options.id}:${viewActorId}`);
    },
    mountContent() {
      throw new Error("Unexpected frame mount.");
    },
    isContentInteractable() {
      return true;
    }
  };
  return host as unknown as FloatingWindowComponent;
}

function createContentHost(id: string): WindowContentHost {
  return {
    id,
    mountContent() {
      throw new Error("Unexpected content mount.");
    },
    isContentInteractable() {
      return true;
    }
  };
}

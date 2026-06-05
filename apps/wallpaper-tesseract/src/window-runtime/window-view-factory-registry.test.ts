import { describe, expect, it } from "vitest";
import { ActorSystem } from "../actor-runtime";
import type { WindowContentRehostable } from "./floating-window-host";
import type { WindowFramePort } from "./window-frame-port";
import { WindowViewFactoryRegistry } from "./window-view-factory-registry";

describe("WindowViewFactoryRegistry", () => {
  it("registers factories by stable view key and disposes registrations", () => {
    const actorSystem = new ActorSystem();
    const registry = new WindowViewFactoryRegistry();
    const registration = registry.register({
      viewKey: "debug",
      label: "Debug Log",
      create: () => {
        const frameActor = actorSystem.createActor({ id: "debug-frame" });
        const viewActor = actorSystem.createActor({ id: "debug-view", parent: frameActor });
        return {
          frameActor,
          framePort: createFramePort(frameActor.id),
          viewActor,
          content: createContent()
        };
      }
    });

    const created = registry.create("debug", { reason: "menu" });

    expect(registry.list().map((factory) => factory.viewKey)).toEqual(["debug"]);
    expect(created.frameActor.id).toBe("debug-frame");
    expect(created.framePort.frameId).toBe("debug-frame");
    expect(created.viewActor.id).toBe("debug-view");
    expect(created.content.currentWindowContentHost).toBeNull();
    registration.dispose();
    expect(registry.get("debug")).toBeNull();
  });

  it("rejects duplicate and missing view keys", () => {
    const registry = new WindowViewFactoryRegistry();
    const factory = {
      viewKey: "debug",
      label: "Debug Log",
      create: () => {
        throw new Error("not used");
      }
    };

    registry.register(factory);

    expect(() => registry.register(factory)).toThrow(/already registered/);
    expect(() => registry.create("hierarchy", { reason: "menu" })).toThrow(/not registered/);
  });
});

function createFramePort(frameId: string): WindowFramePort {
  return {
    frameId,
    visiblePath: `${frameId}.visible` as WindowFramePort["visiblePath"],
    visible: true,
    presentation: "windowed",
    listTabs: () => [],
    getRuntimeDockRoot: () => ({
      kind: "tabset",
      id: "frame-tabset:empty",
      tabs: [],
      activeViewActorId: null
    }),
    restoreRuntimeDockRoot() {},
    listDockTargetTabsets: () => [],
    getActiveViewActorId: () => null,
    isViewActiveInFrame: () => false,
    isViewVisibleInFrame: () => false,
    addTab() {},
    splitTab() {},
    removeTab() {},
    activateTab() {},
    hasTab: () => false,
    hasTabset: () => false,
    getContentHost() {
      throw new Error("not used");
    },
    getFloatingBounds: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    restoreFloatingState() {},
    setPresentation() {},
    requestVisible() {}
  };
}

function createContent(): WindowContentRehostable {
  return {
    currentWindowContentHost: null,
    rehostWindowContent() {}
  };
}

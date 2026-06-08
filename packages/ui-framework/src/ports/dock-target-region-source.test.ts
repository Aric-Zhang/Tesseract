import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-core";
import { createDockTargetRegionSource } from "./dock-target-region-source";
import { WindowFramePortRegistry } from "./window-frame-port-registry";
import type { WindowFramePort } from "./window-frame-port";
import type { WindowDockRect } from "../model/window-dock-targets";

describe("createDockTargetRegionSource", () => {
  it("lists registered frame port tabset targets", () => {
    const actorSystem = new ActorSystem();
    const frameActor = actorSystem.createActor({ id: "workspace-root-frame" });
    const framePorts = new WindowFramePortRegistry();
    framePorts.register({
      frameActor,
      framePort: createFramePort("workspace-root-frame", rect(0, 24, 1024, 720)),
      getStackPriority: () => 100
    });
    const source = createDockTargetRegionSource({ actorSystem, framePorts });

    expect(source.listDockTargetRegions()).toEqual([{
      frameId: "workspace-root-frame",
      targetTabsetId: "workspace-root-frame:tabset",
      stackPriority: 100,
      bounds: rect(0, 24, 1024, 720),
      tabBounds: rect(0, 24, 1024, 24),
      contentBounds: rect(0, 48, 1024, 696)
    }]);
  });

  it("filters hidden, inactive, and non-targetable frames", () => {
    const actorSystem = new ActorSystem();
    const visibleActor = actorSystem.createActor({ id: "visible" });
    const hiddenActor = actorSystem.createActor({ id: "hidden" });
    const inactiveActor = actorSystem.createActor({ id: "inactive" });
    inactiveActor.enabled = false;
    const disabledTargetActor = actorSystem.createActor({ id: "disabled-target" });
    const framePorts = new WindowFramePortRegistry();
    framePorts.register({
      frameActor: visibleActor,
      framePort: createFramePort("visible", rect(0, 0, 100, 100)),
      getStackPriority: () => 10
    });
    framePorts.register({
      frameActor: hiddenActor,
      framePort: createFramePort("hidden", rect(0, 0, 100, 100), false),
      getStackPriority: () => 20
    });
    framePorts.register({
      frameActor: inactiveActor,
      framePort: createFramePort("inactive", rect(0, 0, 100, 100)),
      getStackPriority: () => 30
    });
    framePorts.register({
      frameActor: disabledTargetActor,
      framePort: createFramePort("disabled-target", rect(0, 0, 100, 100)),
      getStackPriority: () => 40,
      canTarget: () => false
    });

    const source = createDockTargetRegionSource({ actorSystem, framePorts });

    expect(source.listDockTargetRegions().map((region) => region.frameId)).toEqual(["visible"]);
  });

  it("keeps stack priority stable while preserving registry order as a tiebreaker", () => {
    const actorSystem = new ActorSystem();
    const first = actorSystem.createActor({ id: "first" });
    const second = actorSystem.createActor({ id: "second" });
    const framePorts = new WindowFramePortRegistry();
    framePorts.register({
      frameActor: first,
      framePort: createFramePort("first", rect(0, 0, 100, 100)),
      getStackPriority: () => 10
    });
    framePorts.register({
      frameActor: second,
      framePort: createFramePort("second", rect(0, 0, 100, 100)),
      getStackPriority: () => 10
    });

    const source = createDockTargetRegionSource({ actorSystem, framePorts });

    expect(source.listDockTargetRegions().map((region) => region.stackPriority)).toEqual([10, 10.001]);
  });
});

function createFramePort(
  frameId: string,
  bounds: WindowDockRect,
  effectiveVisible = true
): WindowFramePort {
  return {
    frameId,
    visiblePath: null,
    visible: effectiveVisible,
    effectiveVisible,
    presentationSuppressed: false,
    presentation: "windowed",
    listTabs: () => [],
    getRuntimeDockRoot: () => ({
      kind: "tabset",
      id: `${frameId}:root`,
      tabs: [],
      activeViewActorId: null
    }),
    restoreRuntimeDockRoot() {},
    listDockTargetTabsets: () => [{
      targetTabsetId: `${frameId}:tabset`,
      tabBounds: rect(bounds.left, bounds.top, bounds.width, 24),
      contentBounds: rect(bounds.left, bounds.top + 24, bounds.width, bounds.height - 24)
    }],
    getFocusedViewActorId: () => null,
    getActiveViewActorIds: () => [],
    isViewActiveInFrame: () => false,
    isViewVisibleInFrame: () => false,
    addTab() {},
    splitTab() {},
    removeTab() {},
    activateTab() {},
    hasTab: () => false,
    hasTabset: () => true,
    getContentHost() {
      throw new Error("not needed");
    },
    getFloatingBounds: () => bounds,
    restoreFloatingState() {},
    setPresentation() {},
    setPresentationSuppressed() {},
    requestVisible() {}
  };
}

function rect(left: number, top: number, width: number, height: number): WindowDockRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}

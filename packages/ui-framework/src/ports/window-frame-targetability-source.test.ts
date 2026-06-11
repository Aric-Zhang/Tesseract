import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-core";
import { createWindowFrameTargetabilitySource } from "./window-frame-targetability-source";
import { WindowFramePortRegistry } from "./window-frame-port-registry";
import type { WindowFramePort } from "./window-frame-port";
import type { WindowDockRect } from "../model/window-dock-targets";

describe("createWindowFrameTargetabilitySource", () => {
  it("projects shell targetability facts without exposing placement APIs", () => {
    const actorSystem = new ActorSystem();
    const active = actorSystem.createActor({ id: "active-frame" });
    const inactive = actorSystem.createActor({ id: "inactive-frame" });
    inactive.enabled = false;
    const disabledTarget = actorSystem.createActor({ id: "disabled-target-frame" });
    const framePorts = new WindowFramePortRegistry();
    framePorts.register({
      frameActor: active,
      framePort: createFramePort("active-frame"),
      getStackPriority: () => 11
    });
    framePorts.register({
      frameActor: inactive,
      framePort: createFramePort("inactive-frame"),
      getStackPriority: () => 22
    });
    framePorts.register({
      frameActor: disabledTarget,
      framePort: createFramePort("disabled-target-frame"),
      getStackPriority: () => 33,
      canTarget: () => false
    });

    const source = createWindowFrameTargetabilitySource({ actorSystem, framePorts });

    expect(source.listTargetableFrames()).toEqual([
      {
        frameId: "active-frame",
        frameActorId: "active-frame",
        activeInHierarchy: true,
        canReceiveDockTargets: true,
        stackPriority: 11
      },
      {
        frameId: "inactive-frame",
        frameActorId: "inactive-frame",
        activeInHierarchy: false,
        canReceiveDockTargets: true,
        stackPriority: 22
      },
      {
        frameId: "disabled-target-frame",
        frameActorId: "disabled-target-frame",
        activeInHierarchy: true,
        canReceiveDockTargets: false,
        stackPriority: 33
      }
    ]);
  });
});

function createFramePort(frameId: string): WindowFramePort {
  const bounds = rect(0, 0, 100, 100);
  return {
    frameId,
    visiblePath: null,
    visible: true,
    effectiveVisible: true,
    persistable: true,
    presentationSuppressed: false,
    presentation: "windowed",
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

import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-core";
import type { WindowFramePort } from "./window-frame-port";
import { WindowFramePortRegistry } from "./window-frame-port-registry";

describe("WindowFramePortRegistry", () => {
  it("registers and unregisters frame ports by frame id", () => {
    const actorSystem = new ActorSystem();
    const frameActor = actorSystem.createActor({ id: "frame" });
    const framePort = createFramePort("frame");
    const registry = new WindowFramePortRegistry();

    const registration = registry.register({
      frameActor,
      framePort,
      getStackPriority: () => 10
    });

    expect(registry.get("frame")?.framePort).toBe(framePort);
    expect(registry.list().map((entry) => entry.framePort.frameId)).toEqual(["frame"]);

    registration.dispose();

    expect(registry.get("frame")).toBeNull();
    expect(registry.list()).toEqual([]);
  });

  it("rejects duplicate frame ids", () => {
    const actorSystem = new ActorSystem();
    const frameActor = actorSystem.createActor({ id: "frame" });
    const registry = new WindowFramePortRegistry();
    registry.register({
      frameActor,
      framePort: createFramePort("frame"),
      getStackPriority: () => 1
    });

    expect(() => registry.register({
      frameActor,
      framePort: createFramePort("frame"),
      getStackPriority: () => 2
    })).toThrow("Window frame port is already registered: frame");
  });

  it("rejects frame ports whose id does not match the frame actor", () => {
    const actorSystem = new ActorSystem();
    const frameActor = actorSystem.createActor({ id: "frame-actor" });
    const registry = new WindowFramePortRegistry();

    expect(() => registry.register({
      frameActor,
      framePort: createFramePort("different-frame"),
      getStackPriority: () => 1
    })).toThrow("Window frame port id must match frame actor id: actor=frame-actor, frame=different-frame");
  });
});

function createFramePort(frameId: string): WindowFramePort {
  return {
    frameId,
    visiblePath: null,
    visible: true,
    effectiveVisible: true,
    persistable: true,
    presentationSuppressed: false,
    presentation: "windowed",
    getFloatingBounds: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    restoreFloatingState() {},
    setPresentation() {},
    setPresentationSuppressed() {},
    requestVisible() {}
  };
}

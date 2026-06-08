import { describe, expect, it } from "vitest";
import type { Actor } from "actor-core";
import type {
  WindowViewFullscreenSession,
  WindowViewPresentationCommandPort
} from "./window-frame-lifecycle";
import type { WindowFramePort } from "../ports/window-frame-port";
import type { WindowFramePortRegistryEntry, WindowFramePortRegistryView } from "../ports/window-frame-port-registry";
import { WindowWorkspacePresentationController } from "./window-workspace-presentation-controller";

describe("WindowWorkspacePresentationController", () => {
  it("enters a run fullscreen session and suppresses every other frame", () => {
    const ports = [
      createFramePort("scene-frame"),
      createFramePort("debug-frame"),
      createFramePort("hierarchy-frame"),
      createFramePort("floating-scene-view")
    ];
    const presentation = createPresentationPort("floating-scene-view");
    const controller = new WindowWorkspacePresentationController({
      framePorts: createFramePortRegistry(ports),
      presentation
    });

    const result = controller.enterRunFullscreenForView("scene-view", "programmatic");

    expect(result).toMatchObject({
      entered: true,
      session: {
        viewActorId: "scene-view",
        fullscreenFrameId: "floating-scene-view",
        suppressedFrameIds: ["scene-frame", "debug-frame", "hierarchy-frame"]
      }
    });
    expect(ports.map((port) => [port.frameId, port.effectiveVisible])).toEqual([
      ["scene-frame", false],
      ["debug-frame", false],
      ["hierarchy-frame", false],
      ["floating-scene-view", true]
    ]);
  });

  it("clears suppression when exiting the active session", () => {
    const ports = [
      createFramePort("scene-frame"),
      createFramePort("debug-frame"),
      createFramePort("floating-scene-view")
    ];
    const presentation = createPresentationPort("floating-scene-view");
    const controller = new WindowWorkspacePresentationController({
      framePorts: createFramePortRegistry(ports),
      presentation
    });

    controller.enterRunFullscreenForView("scene-view", "programmatic");
    controller.exitRunFullscreen("programmatic");

    expect(ports.map((port) => [port.frameId, port.presentationSuppressed])).toEqual([
      ["scene-frame", false],
      ["debug-frame", false],
      ["floating-scene-view", false]
    ]);
    expect(controller.getActiveSession()).toBeNull();
    expect(presentation.calls).toEqual([
      "enter-workspace:scene-view:programmatic",
      "exit:scene-view:programmatic"
    ]);
  });

  it("exits the previous session before entering another view", () => {
    const ports = [
      createFramePort("scene-fullscreen"),
      createFramePort("debug-fullscreen"),
      createFramePort("tool-frame")
    ];
    const presentation = createPresentationPort("scene-fullscreen");
    const controller = new WindowWorkspacePresentationController({
      framePorts: createFramePortRegistry(ports),
      presentation
    });

    controller.enterRunFullscreenForView("scene-view", "programmatic");
    presentation.fullscreenFrameId = "debug-fullscreen";
    controller.enterRunFullscreenForView("debug-view", "programmatic");

    expect(controller.getActiveSession()).toMatchObject({
      viewActorId: "debug-view",
      fullscreenFrameId: "debug-fullscreen"
    });
    expect(ports.map((port) => [port.frameId, port.presentationSuppressed])).toEqual([
      ["scene-fullscreen", true],
      ["debug-fullscreen", false],
      ["tool-frame", true]
    ]);
    expect(presentation.calls).toEqual([
      "enter-workspace:scene-view:programmatic",
      "exit:scene-view:programmatic",
      "enter-workspace:debug-view:programmatic"
    ]);
  });
});

function createFramePort(frameId: string): WindowFramePort {
  let suppressed = false;
  return {
    frameId,
    visiblePath: null,
    visible: true,
    get effectiveVisible() {
      return !suppressed;
    },
    get presentationSuppressed() {
      return suppressed;
    },
    presentation: "windowed",
    listTabs: () => [],
    getRuntimeDockRoot: () => ({
      kind: "tabset",
      id: `${frameId}:tabset`,
      tabs: [],
      activeViewActorId: null
    }),
    restoreRuntimeDockRoot() {},
    listDockTargetTabsets: () => [],
    getFocusedViewActorId: () => null,
    getActiveViewActorIds: () => [],
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
    setPresentationSuppressed(_reason, nextSuppressed) {
      suppressed = nextSuppressed;
    },
    requestVisible() {}
  };
}

function createFramePortRegistry(ports: readonly WindowFramePort[]): WindowFramePortRegistryView {
  const entries = ports.map((framePort): WindowFramePortRegistryEntry => ({
    frameActor: { id: framePort.frameId, enabled: true } as Actor,
    framePort,
    getStackPriority: () => 1
  }));
  return {
    get(frameId) {
      return entries.find((entry) => entry.framePort.frameId === frameId) ?? null;
    },
    list() {
      return entries;
    }
  };
}

function createPresentationPort(
  fullscreenFrameId: string
): WindowViewPresentationCommandPort & { readonly calls: string[]; fullscreenFrameId: string } {
  const calls: string[] = [];
  let activeSession: WindowViewFullscreenSession | null = null;
  return {
    calls,
    fullscreenFrameId,
    enterViewFullscreen(viewActorId, reason) {
      calls.push(`enter:${viewActorId}:${reason}`);
      activeSession = {
        viewActorId,
        viewKey: viewActorId.startsWith("debug") ? "debug" : "scene",
        mode: "direct-frame",
        fullscreenFrameId
      };
    },
    enterViewWorkspaceFullscreen(viewActorId, reason) {
      calls.push(`enter-workspace:${viewActorId}:${reason}`);
      activeSession = {
        viewActorId,
        viewKey: viewActorId.startsWith("debug") ? "debug" : "scene",
        mode: "isolated-frame",
        fullscreenFrameId: this.fullscreenFrameId
      };
    },
    exitViewFullscreen(viewActorId, reason) {
      calls.push(`exit:${viewActorId}:${reason}`);
      activeSession = null;
    },
    getViewFullscreenSession() {
      return activeSession;
    },
    isViewFullscreenIsolated() {
      return activeSession?.mode === "isolated-frame";
    }
  };
}

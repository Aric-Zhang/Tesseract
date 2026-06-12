import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-core";
import type { WindowFocusCommandPort } from "./window-focus-command-port";
import { DefaultWindowFrameLifecycleController } from "./window-frame-lifecycle-controller";
import {
  createSingletonWindowViewIdentity,
  createWindowWorkspaceFrameLayout,
  WindowFramePortRegistry
} from "../index";
import type {
  WindowRegisteredContent,
  WindowContentLayoutCommitRegistration,
  WindowFloatingFrameFactory,
  WindowFramePort,
  WindowFrameSurfaceSnapshot,
  WindowFrameSurfaceSnapshotNode,
  WindowFrameSurfaceSnapshotTab,
  WindowFrameTabsetNode,
  WindowFrameTab,
  WindowWorkspaceGraphContentActiveState,
  WindowWorkspaceGraphContentPlacement,
  WindowWorkspaceGraphReconcilerSurface,
  WindowWorkspaceSurfaceGeometryProjection
} from "../index";
import { WindowViewFactoryRegistry } from "../ports/window-view-factory-registry";

function createFocusRecorder(calls: string[]): WindowFocusCommandPort {
  return {
    focusActorWindow(actor, reason): void {
      calls.push(`focus:${actor.id}:${reason}`);
    },
    requestFocusOnVisible(actor, reason): void {
      calls.push(`pending:${actor.id}:${reason}`);
    }
  };
}

function createSubject(options: {
  readonly createFloatingFrame?: WindowFloatingFrameFactory;
  readonly createFloatingFrameFactory?: (actorSystem: ActorSystem) => WindowFloatingFrameFactory;
  readonly framePorts?: WindowFramePortRegistry;
} = {}) {
  const actorSystem = new ActorSystem();
  const registry = new WindowViewFactoryRegistry();
  const focusCalls: string[] = [];
  let createCount = 0;
  const cancelCalls: string[] = [];
  const runtimeDisposeCalls: string[] = [];

  registry.register({
    viewKey: "debug",
    label: "Debug Log",
    createViewRuntime: ({ parentFrameActor }) => {
      createCount += 1;
      const viewActor = actorSystem.createActor({
        id: `debug-view-${createCount}`,
        parent: parentFrameActor
      });
      const content = createContent();
      return {
        viewActor,
        content,
        title: "Debug Log",
        disposeViewRuntime: () => runtimeDisposeCalls.push(`runtime:${viewActor.id}`)
      };
    }
  });
  registry.register({
    viewKey: "hierarchy",
    label: "Hierarchy",
    createViewRuntime: ({ parentFrameActor }) => {
      const viewActor = actorSystem.createActor({
        id: "hierarchy-view",
        parent: parentFrameActor
      });
      const content = createContent();
      return {
        viewActor,
        content,
        title: "Hierarchy",
        disposeViewRuntime: () => runtimeDisposeCalls.push(`runtime:${viewActor.id}`)
      };
    }
  });
  registry.register({
    viewKey: "scene",
    label: "Scene",
    createViewRuntime: ({ parentFrameActor }) => {
      const viewActor = actorSystem.createActor({
        id: "scene-view",
        parent: parentFrameActor
      });
      const content = createContent();
      return {
        viewActor,
        content,
        title: "Scene",
        disposeViewRuntime: () => runtimeDisposeCalls.push(`runtime:${viewActor.id}`)
      };
    }
  });
  registry.register({
    viewKey: "inspector:a",
    typeKey: "inspector",
    multiplicity: "multi-instance",
    label: "Inspector A",
    createViewRuntime: ({ parentFrameActor, identity }) => {
      const viewActor = actorSystem.createActor({
        id: `${identity.instanceId}-view`,
        parent: parentFrameActor
      });
      const content = createContent();
      return {
        viewActor,
        content,
        title: "Inspector A",
        disposeViewRuntime: () => runtimeDisposeCalls.push(`runtime:${viewActor.id}`)
      };
    }
  });
  registry.register({
    viewKey: "inspector:b",
    typeKey: "inspector",
    multiplicity: "multi-instance",
    label: "Inspector B",
    createViewRuntime: ({ parentFrameActor, identity }) => {
      const viewActor = actorSystem.createActor({
        id: `${identity.instanceId}-view`,
        parent: parentFrameActor
      });
      const content = createContent();
      return {
        viewActor,
        content,
        title: "Inspector B",
        disposeViewRuntime: () => runtimeDisposeCalls.push(`runtime:${viewActor.id}`)
      };
    }
  });

  const controller = new DefaultWindowFrameLifecycleController({
    actorSystem,
    factories: registry,
    windowFocus: createFocusRecorder(focusCalls),
    cancelActiveInput: () => cancelCalls.push("cancel"),
    createFloatingFrame: options.createFloatingFrame ??
      options.createFloatingFrameFactory?.(actorSystem) ??
      createFloatingFrameFactory(actorSystem, []),
    framePorts: options.framePorts
  });

  return {
    actorSystem,
    cancelCalls,
    controller,
    focusCalls,
    runtimeDisposeCalls,
    get createCount() {
      return createCount;
    }
  };
}

describe("DefaultWindowFrameLifecycleController", () => {
  it("opens a missing view once and focuses an existing live frame on later opens", () => {
    const subject = createSubject();

    subject.controller.openView("debug", "menu");
    subject.controller.openView("debug", "menu");

    expect(subject.createCount).toBe(1);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeTruthy();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("debug-frame-1");
    expect(subject.controller.listLiveViews().map((view) => view.viewKey)).toEqual(["debug"]);
    expect(subject.controller.getLiveViewByActorId("debug-view-1")?.framePort.frameId).toBe("debug-frame-1");
    expect(subject.focusCalls).toEqual([
      "focus:debug-frame-1:menu-restore",
      "focus:debug-frame-1:menu-restore"
    ]);
  });

  it("projects live frame state into a workspace graph snapshot", () => {
    const subject = createSubject();

    subject.controller.openView("debug", "menu");
    subject.controller.openView("hierarchy", "menu");

    const snapshot = subject.controller.getWorkspaceGraphSnapshot();

    expect(snapshot.placements.map((placement) => ({
      identity: placement.identity.viewKey,
      frameId: placement.frameId,
      active: placement.active,
      interactable: placement.interactable
    }))).toEqual([
      {
        identity: "debug",
        frameId: "debug-frame-1",
        active: true,
        interactable: true
      },
      {
        identity: "hierarchy",
        frameId: "hierarchy-frame",
        active: true,
        interactable: true
      }
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("debug-view-1");
    expect(JSON.stringify(snapshot)).not.toContain("hierarchy-view");
  });

  it("keeps graph state logical while runtime handles stay in projection realization", () => {
    const subject = createSubject();

    subject.controller.openView("debug", "menu");
    subject.controller.openView("hierarchy", "menu");

    const projection = subject.controller.listWorkspaceGraphFrameSurfaceSnapshots();
    const snapshot = subject.controller.getWorkspaceGraphSnapshot();
    const revision = snapshot.revision;
    const secondRead = subject.controller.getWorkspaceGraphSnapshot();

    expect(secondRead.revision).toBe(revision);
    expect(snapshot.placements.map((placement) => ({
      contentId: placement.contentId,
      viewKey: placement.identity.viewKey,
      frameId: placement.frameId
    }))).toEqual([
      {
        contentId: "content:instance:debug:default",
        viewKey: "debug",
        frameId: "debug-frame-1"
      },
      {
        contentId: "content:instance:hierarchy:default",
        viewKey: "hierarchy",
        frameId: "hierarchy-frame"
      }
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("debug-view-1");
    expect(JSON.stringify(snapshot)).not.toContain("hierarchy-view");
    expect(JSON.stringify(projection)).toContain("debug-view-1");
    expect(JSON.stringify(projection)).toContain("hierarchy-view");
    expect(projection.map((frame) => ({
      frameId: frame.frameId,
      kind: frame.kind,
      presentation: frame.presentation,
      visible: frame.visible
    }))).toEqual([
      {
        frameId: "debug-frame-1",
        kind: "persistent",
        presentation: "windowed",
        visible: true
      },
      {
        frameId: "hierarchy-frame",
        kind: "persistent",
        presentation: "windowed",
        visible: true
      }
    ]);
  });

  it("tracks multiple instances of the same view type by identity instead of type key", () => {
    const subject = createSubject();

    subject.controller.openView("inspector:a", "menu");
    subject.controller.openView("inspector:b", "menu");

    expect(subject.controller.listLiveViews().map((view) => ({
      viewKey: view.viewKey,
      typeKey: view.identity.typeKey,
      instanceId: view.identity.instanceId
    }))).toEqual([
      { viewKey: "inspector:a", typeKey: "inspector", instanceId: "inspector:a" },
      { viewKey: "inspector:b", typeKey: "inspector", instanceId: "inspector:b" }
    ]);

    const closeResult = subject.controller.closeView("inspector:a-view", "programmatic");

    expect(closeResult.closed).toBe(true);
    expect(subject.controller.getLiveViewByActorId("inspector:a-view")).toBeNull();
    expect(subject.controller.getLiveViewByActorId("inspector:b-view")?.identity).toMatchObject({
      viewKey: "inspector:b",
      typeKey: "inspector",
      instanceId: "inspector:b",
      multiplicity: "multi-instance"
    });
  });

  it("updates activation sequence from lifecycle focus and tab activation", () => {
    const subject = createSubject();

    subject.controller.openView("debug", "menu");
    const debugAfterOpen = subject.controller.getLocationByViewKey("debug")?.activationSequence ?? 0;
    subject.controller.openView("hierarchy", "menu");
    const hierarchyAfterOpen = subject.controller.getLocationByViewKey("hierarchy")?.activationSequence ?? 0;
    subject.controller.activateFrameTab("debug-frame-1", "debug-view-1", "tab-click");
    const debugAfterActivate = subject.controller.getLocationByViewKey("debug")?.activationSequence ?? 0;

    expect(debugAfterOpen).toBeGreaterThan(0);
    expect(hierarchyAfterOpen).toBeGreaterThan(debugAfterOpen);
    expect(debugAfterActivate).toBeGreaterThan(hierarchyAfterOpen);
  });

  it("opens or focuses a view type using the lifecycle activation sequence as MRU", () => {
    const subject = createSubject();

    expect(subject.controller.openOrFocusViewType("inspector", "menu")).toMatchObject({
      viewKey: "inspector:a",
      typeKey: "inspector",
      instanceId: "inspector:a"
    });
    expect(subject.controller.createViewInstance("inspector", "menu")).toMatchObject({
      viewKey: "inspector:b",
      typeKey: "inspector",
      instanceId: "inspector:b"
    });
    subject.controller.focusViewInstance(
      subject.controller.getLiveViewByActorId("inspector:a-view")!.identity,
      "menu"
    );

    expect(subject.controller.openOrFocusViewType("inspector", "menu")).toMatchObject({
      viewKey: "inspector:a",
      typeKey: "inspector",
      instanceId: "inspector:a"
    });
    expect(subject.focusCalls.at(-1)).toBe("focus:inspector:a-frame-1:menu-restore");
  });

  it("rejects stale tab close identity even when the view actor id is live", () => {
    const subject = createSubject();

    subject.controller.openView("debug", "menu");
    const result = subject.controller.closeView("debug-view-1", "tab-action", {
      identity: createSingletonWindowViewIdentity("hierarchy"),
      ownerFrameId: "debug-frame-1",
      viewKey: "debug"
    });

    expect(result).toMatchObject({
      closed: false,
      reason: "view identity mismatch",
      sourceFrameId: "debug-frame-1"
    });
    expect(subject.controller.getLiveViewByActorId("debug-view-1")).toBeTruthy();
  });

  it("opens a new view into a preferred registered frame when available", () => {
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({ framePorts });
    const rootFrame = subject.actorSystem.createActor({ id: "workspace-root-frame" });
    const rootPort = createFramePort("workspace-root-frame");
    framePorts.register({
      frameActor: rootFrame,
      framePort: rootPort,
      getStackPriority: () => 100
    });

    subject.controller.openView("debug", "programmatic", {
      preferredFrameId: "workspace-root-frame"
    });

    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!))
      .toBe("workspace-root-frame");
    expect(subject.controller.getLiveViewByActorId("debug-view-1")).toMatchObject({
      frameActor: rootFrame,
      framePort: rootPort
    });
    expect(rootPort.readRenderedViewActorIds()).toEqual(["debug-view-1"]);
  });

  it("uses a view-runtime factory for preferred frames without creating a temporary frame shell", () => {
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({ framePorts });
    const rootFrame = subject.actorSystem.createActor({ id: "workspace-root-frame" });
    const rootPort = createFramePort("workspace-root-frame");
    framePorts.register({
      frameActor: rootFrame,
      framePort: rootPort,
      getStackPriority: () => 100
    });

    subject.controller.openView("debug", "programmatic", {
      preferredFrameId: "workspace-root-frame"
    });

    expect(subject.createCount).toBe(1);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getActor("debug-view-1")).toBeTruthy();
    expect(subject.actorSystem.listActors().map((actor) => actor.id).sort()).toEqual([
      "debug-view-1",
      "workspace-root-frame"
    ]);
    expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
      ownerFrameActorId: "workspace-root-frame",
      viewActorId: "debug-view-1"
    });
  });

  it("keeps a registered root frame alive when its last view is closed", () => {
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({ framePorts });
    const rootFrame = subject.actorSystem.createActor({ id: "workspace-root-frame" });
    const rootPort = createFramePort("workspace-root-frame");
    framePorts.register({
      frameActor: rootFrame,
      framePort: rootPort,
      getStackPriority: () => 100,
      destroyWhenEmpty: false
    });
    subject.controller.openView("debug", "programmatic", {
      preferredFrameId: "workspace-root-frame"
    });

    expect(subject.controller.closeView("debug-view-1", "tab-action", {
      ownerFrameId: "workspace-root-frame",
      viewKey: "debug"
    })).toEqual({
      closed: true,
      sourceFrameId: "workspace-root-frame",
      ownerFrameDestroyed: false,
      nextActiveViewActorId: null
    });

    expect(subject.actorSystem.getActor("workspace-root-frame")).toBe(rootFrame);
    expect(subject.controller.getWorkspaceGraphSnapshot().placements.map((placement) => placement.identity.viewKey))
      .not.toContain("debug");
  });

  it("does not close a registered root frame through frame-level close", () => {
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({ framePorts });
    const rootFrame = subject.actorSystem.createActor({ id: "workspace-root-frame" });
    framePorts.register({
      frameActor: rootFrame,
      framePort: createFramePort("workspace-root-frame"),
      getStackPriority: () => 100,
      destroyWhenEmpty: false
    });

    expect(subject.controller.closeFrame("workspace-root-frame", "programmatic")).toEqual({
      closed: false,
      frameId: "workspace-root-frame",
      reason: "frame cannot be closed"
    });
    expect(subject.actorSystem.getActor("workspace-root-frame")).toBe(rootFrame);
  });

  it("keeps a registered root frame alive when its last tab floats out", () => {
    const framePorts = new WindowFramePortRegistry();
    const floatingCalls: string[] = [];
    const subject = createSubject({
      framePorts,
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, floatingCalls)
    });
    const rootFrame = subject.actorSystem.createActor({ id: "workspace-root-frame" });
    const rootPort = createFramePort("workspace-root-frame");
    framePorts.register({
      frameActor: rootFrame,
      framePort: rootPort,
      getStackPriority: () => 100,
      destroyWhenEmpty: false
    });
    subject.controller.openView("debug", "programmatic", {
      preferredFrameId: "workspace-root-frame"
    });

    expect(subject.controller.commitDock({
      kind: "float-tab",
      operation: "cross-frame-float",
      source: {
        frameId: "workspace-root-frame",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      bounds: { left: 10, top: 20, right: 270, bottom: 200, width: 260, height: 180 },
      reason: "dock-drop"
    })).toEqual({ committed: true, sourceFrameDestroyed: false });

    expect(subject.actorSystem.getActor("workspace-root-frame")).toBe(rootFrame);
    expect(rootPort.readRenderedViewActorIds()).toEqual([]);
    expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
      ownerFrameActorId: "floating-debug-view-1",
      viewActorId: "debug-view-1"
    });
  });

  it("restores persisted root frame layouts into the registered root frame", () => {
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({ framePorts });
    const rootFrame = subject.actorSystem.createActor({ id: "workspace-root-frame" });
    const rootPort = createFramePort("workspace-root-frame");
    framePorts.register({
      frameActor: rootFrame,
      framePort: rootPort,
      getStackPriority: () => 100,
      destroyWhenEmpty: false
    });

    const result = subject.controller.restoreFrameLayout(createWindowWorkspaceFrameLayout({
      views: [
        { viewKey: "debug", actorId: "persisted:debug", title: "Debug Log", canDock: true },
        { viewKey: "hierarchy", actorId: "persisted:hierarchy", title: "Hierarchy", canDock: true }
      ],
      frames: [{
        frameId: "workspace-root-frame",
        bounds: {
          position: { x: 0, y: 24 },
          size: { x: 1200, y: 776 },
          visible: true
        },
        presentation: "windowed",
        root: {
          kind: "tabset",
          id: "persisted-root-tabset",
          tabs: ["debug", "hierarchy"],
          activeTabId: "hierarchy"
        }
      }]
    }), "programmatic");

    expect(result).toEqual({
      restoredViewKeys: ["debug", "hierarchy"],
      skippedViewKeys: [],
      destroyedFrameIds: []
    });
    expect(subject.actorSystem.getActor("workspace-root-frame")).toBe(rootFrame);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getActor("hierarchy-frame")).toBeNull();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!))
      .toBe("workspace-root-frame");
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("hierarchy-view")!))
      .toBe("workspace-root-frame");
    expect(rootPort.readRenderedViewActorIds()).toEqual(["debug-view-1", "hierarchy-view"]);
    expect(rootPort.readActiveViewActorId()).toBe("hierarchy-view");
  });

  it("serializes non-empty root frames while omitting empty root shells", () => {
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({ framePorts });
    const rootFrame = subject.actorSystem.createActor({ id: "workspace-root-frame" });
    const rootPort = createFramePort("workspace-root-frame");
    framePorts.register({
      frameActor: rootFrame,
      framePort: rootPort,
      getStackPriority: () => 100,
      destroyWhenEmpty: false
    });

    expect(subject.controller.createFrameLayoutSnapshot().frames).toEqual([]);

    subject.controller.openView("scene", "programmatic", {
      preferredFrameId: "workspace-root-frame"
    });
    const snapshot = subject.controller.createFrameLayoutSnapshot();

    expect(snapshot.hiddenViewKeys).toEqual([]);
    expect(Object.keys(snapshot.views)).toEqual(["scene"]);
    expect(snapshot.frames).toEqual([{
      frameId: "workspace-root-frame",
      bounds: {
        position: { x: 0, y: 0 },
        size: { x: 0, y: 0 },
        visible: true
      },
      presentation: "windowed",
      root: {
        kind: "tabset",
        id: "frame-tabset:target",
        tabs: ["scene"],
        activeTabId: "scene"
      }
    }]);
  });

  it("falls back to the factory frame when the preferred frame is missing", () => {
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({ framePorts });

    subject.controller.openView("debug", "programmatic", {
      preferredFrameId: "missing-frame"
    });

    expect(subject.actorSystem.getActor("debug-frame-1")).toBeTruthy();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!))
      .toBe("debug-frame-1");
    expect(subject.controller.getLiveViewByActorId("debug-view-1")?.frameActor.id)
      .toBe("debug-frame-1");
  });

  it("activates an existing live tab when opening or requesting activation", () => {
    const subject = createSubject();

    subject.controller.openView("debug", "programmatic");
    const liveView = subject.controller.getLiveViewByActorId("debug-view-1");
    const framePort = asOptionalTestFramePort(liveView?.framePort);
    if (!framePort) throw new Error("Expected test frame port.");
    framePort.calls.length = 0;
    subject.controller.openView("debug", "menu");
    subject.controller.activateFrameTab("debug-frame-1", "debug-view-1", "tab-click");

    expect(framePort.calls.some((call) => call === "activate:debug-view-1")).toBe(false);
    expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
      activeInFrame: true,
      visibleInFrame: true
    });
    expect(subject.focusCalls).toEqual([
      "focus:debug-frame-1:programmatic",
      "focus:debug-frame-1:menu-restore",
      "focus:debug-frame-1:programmatic"
    ]);
  });

  it("closes a frame through ActorSystem so child view actors are destroyed", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");

    subject.controller.closeFrame("debug-frame-1", "close-button");

    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getActor("debug-view-1")).toBeNull();
    expect(subject.controller.listLiveViews()).toEqual([]);
  });

  it("uses explicit view runtime cleanup for frame close", () => {
    const actorSystem = new ActorSystem();
    const registry = new WindowViewFactoryRegistry();
    const calls: string[] = [];
    registerDebugRuntimeFactory(registry, actorSystem, {
      disposeViewRuntime: () => calls.push("runtime-dispose")
    });
    const controller = new DefaultWindowFrameLifecycleController({
      actorSystem,
      factories: registry,
      cancelActiveInput: () => calls.push("cancel"),
      createFloatingFrame: createFixedFrameFactory(actorSystem, "debug-frame")
    });
    controller.openView("debug", "programmatic");

    controller.closeFrame("debug-frame", "close-button");

    expect(calls).toEqual(["cancel", "runtime-dispose"]);
    expect(actorSystem.getActor("debug-frame")).toBeNull();
    expect(actorSystem.getActor("debug-view")).toBeNull();
    expect(controller.listLiveViews()).toEqual([]);
  });

  it("keeps a frame live when frame close runtime cleanup fails", () => {
    const actorSystem = new ActorSystem();
    const registry = new WindowViewFactoryRegistry();
    const calls: string[] = [];
    registerDebugRuntimeFactory(registry, actorSystem, {
      disposeViewRuntime: () => {
        calls.push("runtime-dispose");
        throw new Error("cleanup failed");
      }
    });
    const controller = new DefaultWindowFrameLifecycleController({
      actorSystem,
      factories: registry,
      cancelActiveInput: () => calls.push("cancel"),
      createFloatingFrame: createFixedFrameFactory(actorSystem, "debug-frame")
    });
    controller.openView("debug", "programmatic");

    const result = controller.closeFrame("debug-frame", "close-button");

    expect(result).toEqual({
      closed: false,
      frameId: "debug-frame",
      reason: "view runtime cleanup failed",
      error: "cleanup failed"
    });
    expect(calls).toEqual(["cancel", "runtime-dispose"]);
    expect(actorSystem.getActor("debug-frame")).toBeTruthy();
    expect(actorSystem.getActor("debug-view")).toBeTruthy();
    expect(controller.listLiveViews().map((view) => view.viewActor.id)).toEqual(["debug-view"]);
  });

  it("uses the same explicit runtime cleanup for every view in a mixed frame close", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "hierarchy-frame", viewActorId: "hierarchy-view", viewKey: "hierarchy" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.cancelCalls.length = 0;

    subject.controller.closeFrame("debug-frame-1", "close-button");

    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.runtimeDisposeCalls).toEqual([
      "runtime:debug-view-1",
      "runtime:hierarchy-view"
    ]);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getActor("debug-view-1")).toBeNull();
    expect(subject.actorSystem.getActor("hierarchy-view")).toBeNull();
    expect(subject.controller.listLiveViews()).toEqual([]);
  });

  it("closes one inactive view without destroying its owner frame", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "hierarchy-frame", viewActorId: "hierarchy-view", viewKey: "hierarchy" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.cancelCalls.length = 0;
    subject.focusCalls.length = 0;

    const result = subject.controller.closeView("hierarchy-view", "programmatic");
    expect(result).toEqual({
      closed: true,
      sourceFrameId: "debug-frame-1",
      ownerFrameDestroyed: false,
      nextActiveViewActorId: "debug-view-1"
    });
    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.runtimeDisposeCalls).toEqual(["runtime:hierarchy-view"]);
    expect(subject.actorSystem.getActor("hierarchy-view")).toBeNull();
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeTruthy();
    expect(subject.actorSystem.getActor("debug-view-1")).toBeTruthy();
    expect(subject.controller.getWorkspaceGraphSnapshot().placements.map((placement) => placement.identity.viewKey))
      .toEqual(["debug"]);
    expect(subject.controller.getLiveViewByActorId("hierarchy-view")).toBeNull();
    expect(subject.focusCalls).toEqual(["focus:debug-frame-1:programmatic"]);
  });

  it("closes an active view and activates the neighboring tab", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "hierarchy-frame", viewActorId: "hierarchy-view", viewKey: "hierarchy" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.controller.activateFrameTab("debug-frame-1", "hierarchy-view", "tab-click");
    subject.focusCalls.length = 0;

    const result = subject.controller.closeView("hierarchy-view", "tab-action");
    const debugPort = asOptionalTestFramePort(subject.controller.getLiveViewByActorId("debug-view-1")?.framePort);
    if (!debugPort) throw new Error("Expected test frame port.");

    expect(result).toEqual({
      closed: true,
      sourceFrameId: "debug-frame-1",
      ownerFrameDestroyed: false,
      nextActiveViewActorId: "debug-view-1"
    });
    expect(debugPort.calls.some((call) => call === "activate:debug-view-1")).toBe(false);
    expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
      activeInFrame: true,
      visibleInFrame: true
    });
    expect(subject.focusCalls).toEqual(["focus:debug-frame-1:programmatic"]);
  });

  it("closes the last view and destroys the owner frame", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");

    const result = subject.controller.closeView("debug-view-1", "tab-action");

    expect(result).toEqual({
      closed: true,
      sourceFrameId: "debug-frame-1",
      ownerFrameDestroyed: true,
      nextActiveViewActorId: null
    });
    expect(subject.runtimeDisposeCalls).toEqual(["runtime:debug-view-1"]);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getActor("debug-view-1")).toBeNull();
    expect(subject.controller.listLiveViews()).toEqual([]);
  });

  it("uses explicit runtime cleanup when closing one view", () => {
    const actorSystem = new ActorSystem();
    const registry = new WindowViewFactoryRegistry();
    const calls: string[] = [];
    registerDebugRuntimeFactory(registry, actorSystem, {
      disposeViewRuntime: () => calls.push("runtime-dispose")
    });
    const controller = new DefaultWindowFrameLifecycleController({
      actorSystem,
      factories: registry,
      createFloatingFrame: createFixedFrameFactory(actorSystem, "debug-frame")
    });
    controller.openView("debug", "programmatic");

    const result = controller.closeView("debug-view", "tab-action");

    expect(result).toEqual({
      closed: true,
      sourceFrameId: "debug-frame",
      ownerFrameDestroyed: true,
      nextActiveViewActorId: null
    });
    expect(calls).toEqual(["runtime-dispose"]);
    expect(actorSystem.getActor("debug-frame")).toBeNull();
    expect(actorSystem.getActor("debug-view")).toBeNull();
    expect(controller.listLiveViews()).toEqual([]);
  });

  it("keeps a view live when closeView runtime cleanup fails", () => {
    const actorSystem = new ActorSystem();
    const registry = new WindowViewFactoryRegistry();
    const calls: string[] = [];
    registerDebugRuntimeFactory(registry, actorSystem, {
      disposeViewRuntime: () => {
        calls.push("runtime-dispose");
        throw new Error("cleanup failed");
      }
    });
    const controller = new DefaultWindowFrameLifecycleController({
      actorSystem,
      factories: registry,
      cancelActiveInput: () => calls.push("cancel"),
      createFloatingFrame: createFixedFrameFactory(actorSystem, "debug-frame")
    });
    controller.openView("debug", "programmatic");

    const result = controller.closeView("debug-view", "tab-action");

    expect(result).toEqual({
      closed: false,
      reason: "view runtime cleanup failed",
      sourceFrameId: "debug-frame",
      error: "cleanup failed"
    });
    expect(calls).toEqual(["cancel", "runtime-dispose"]);
    expect(actorSystem.getActor("debug-frame")).toBeTruthy();
    expect(actorSystem.getActor("debug-view")).toBeTruthy();
    expect(controller.listLiveViews().map((view) => view.viewActor.id)).toEqual(["debug-view"]);
  });

  it("treats closeView as committed once runtime cleanup succeeds", () => {
    const actorSystem = new ActorSystem();
    const registry = new WindowViewFactoryRegistry();
    const calls: string[] = [];
    registerDebugRuntimeFactory(registry, actorSystem, {
      disposeViewRuntime: () => calls.push("runtime-dispose")
    });
    const controller = new DefaultWindowFrameLifecycleController({
      actorSystem,
      factories: registry,
      cancelActiveInput: () => calls.push("cancel"),
      createFloatingFrame: createFixedFrameFactory(actorSystem, "debug-frame")
    });
    controller.openView("debug", "programmatic");

    const result = controller.closeView("debug-view", "tab-action");

    expect(result).toEqual({
      closed: true,
      sourceFrameId: "debug-frame",
      ownerFrameDestroyed: true,
      nextActiveViewActorId: null
    });
    expect(calls).toEqual(["cancel", "runtime-dispose"]);
    expect(actorSystem.getActor("debug-frame")).toBeNull();
    expect(actorSystem.getActor("debug-view")).toBeNull();
    expect(controller.listLiveViews()).toEqual([]);
  });

  it("rejects stale tab close identity before cleanup or actor mutation", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");

    expect(subject.controller.closeView("debug-view-1", "tab-action", {
      viewKey: "hierarchy"
    })).toEqual({
      closed: false,
      reason: "view key mismatch",
      sourceFrameId: "debug-frame-1"
    });
    expect(subject.controller.closeView("debug-view-1", "tab-action", {
      ownerFrameId: "other-frame"
    })).toEqual({
      closed: false,
      reason: "owner frame mismatch",
      sourceFrameId: "debug-frame-1"
    });
    expect(subject.cancelCalls).toEqual([]);
    expect(subject.runtimeDisposeCalls).toEqual([]);
    expect(subject.actorSystem.getActor("debug-view-1")).toBeTruthy();
    expect(subject.controller.listLiveViews().map((view) => view.viewActor.id)).toEqual(["debug-view-1"]);
  });

  it("returns a stable result for repeated closeView calls", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");

    subject.controller.closeView("debug-view-1", "programmatic");
    const result = subject.controller.closeView("debug-view-1", "programmatic");

    expect(result).toEqual({
      closed: false,
      reason: "view is not live"
    });
    expect(subject.runtimeDisposeCalls).toEqual(["runtime:debug-view-1"]);
  });

  it("closes a direct-fullscreen Scene view without leaving a fullscreen session", () => {
    const subject = createSubject();
    subject.controller.openView("scene", "programmatic");
    subject.controller.enterViewFullscreen("scene-view", "programmatic");

    const result = subject.controller.closeView("scene-view", "programmatic");

    expect(result).toEqual({
      closed: true,
      sourceFrameId: "scene-frame",
      ownerFrameDestroyed: true,
      nextActiveViewActorId: null
    });
    expect(subject.runtimeDisposeCalls).toEqual(["runtime:scene-view"]);
    expect(subject.controller.getViewFullscreenSession("scene-view")).toBeNull();
    expect(subject.actorSystem.getActor("scene-frame")).toBeNull();
    expect(subject.actorSystem.getActor("scene-view")).toBeNull();
    expect(subject.controller.getLocationByViewKey("scene")).toBeNull();
  });

  it("closes a Scene view from isolated fullscreen and keeps the source mixed frame alive", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, [])
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.controller.enterViewFullscreen("scene-view", "programmatic");

    const result = subject.controller.closeView("scene-view", "tab-action");
    expect(result).toEqual({
      closed: true,
      sourceFrameId: "debug-frame-1",
      ownerFrameDestroyed: false,
      nextActiveViewActorId: "debug-view-1"
    });
    expect(subject.runtimeDisposeCalls).toEqual(["runtime:scene-view"]);
    expect(subject.actorSystem.getActor("floating-scene-view")).toBeNull();
    expect(subject.actorSystem.getActor("scene-view")).toBeNull();
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeTruthy();
    expect(subject.controller.getWorkspaceGraphSnapshot().placements.map((placement) => placement.identity.viewKey))
      .toEqual(["debug"]);
    expect(subject.controller.getViewFullscreenSession("scene-view")).toBeNull();
    expect(subject.controller.getLocationByViewKey("scene")).toBeNull();
  });

  it("closes a Scene view from isolated fullscreen and collapses the restored split", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, [])
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "split-tab",
      operation: "cross-frame-split",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      placement: "left",
      reason: "dock-drop"
    });
    subject.controller.enterViewFullscreen("scene-view", "programmatic");

    const result = subject.controller.closeView("scene-view", "tab-action");
    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");

    expect(result).toMatchObject({
      closed: true,
      sourceFrameId: "debug-frame-1",
      ownerFrameDestroyed: false,
      nextActiveViewActorId: "debug-view-1"
    });
    expect(subject.actorSystem.getActor("floating-scene-view")).toBeNull();
    expect(subject.controller.getViewFullscreenSession("scene-view")).toBeNull();
    expect(debugView?.frameActor.id).toBe("debug-frame-1");
    expect(subject.controller.getWorkspaceGraphSnapshot().frames.find((frame) =>
      frame.frameId === "debug-frame-1"
    )?.root).toEqual({
      kind: "tabset",
      id: "frame-tabset:target",
      contentIds: ["content:instance:debug:default"],
      activeContentId: "content:instance:debug:default"
    });
  });

  it("validates a tab merge only when source view and target frame are live", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");

    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: true });
  });

  it("rejects tab merge intents with stale or mismatched source data", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.focusCalls.length = 0;
    subject.cancelCalls.length = 0;

    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "missing-view",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "source view is not live" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "hierarchy"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "source view key mismatch" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "other-frame",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "source frame mismatch" });
    expect(subject.focusCalls).toEqual([]);
    expect(subject.cancelCalls).toEqual([]);
  });

  it("rejects tab merge intents with invalid target frames", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.actorSystem.createActor({ id: "empty-frame" });

    const source = {
      frameId: "debug-frame-1",
      viewActorId: "debug-view-1",
      viewKey: "debug" as const
    };
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source,
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "same-frame merge requires explicit same-frame operation" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source,
      targetFrameId: "missing-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "target frame is missing" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source,
      targetFrameId: "empty-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "target frame has no live views" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source,
      targetFrameId: "debug-frame-1",
      targetTabsetId: "missing-tabset",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "same-frame merge requires explicit same-frame operation" });
  });

  it("commits a tab merge into a registered empty target frame port", () => {
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({ framePorts });
    subject.controller.openView("debug", "programmatic");
    const rootFrame = subject.actorSystem.createActor({ id: "workspace-root-frame" });
    const rootPort = createFramePort("workspace-root-frame");
    framePorts.register({
      frameActor: rootFrame,
      framePort: rootPort,
      getStackPriority: () => 100
    });

    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "workspace-root-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: true });

    const result = subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "workspace-root-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    expect(result).toEqual({ committed: true, sourceFrameDestroyed: true });
    expect(subject.controller.getLiveViewByActorId("debug-view-1")).toMatchObject({
      frameActor: rootFrame,
      framePort: rootPort
    });
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!))
      .toBe("workspace-root-frame");
    expect(rootPort.readRenderedViewActorIds()).toEqual(["debug-view-1"]);
  });

  it("commits a same-frame tab split without destroying or reparenting the frame", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "hierarchy-frame", viewActorId: "hierarchy-view", viewKey: "hierarchy" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    const liveView = subject.controller.getLiveViewByActorId("hierarchy-view");
    if (!liveView) throw new Error("Expected live hierarchy view.");
    const root = asTestFramePort(liveView.framePort).readRenderedRoot();
    if (!root || root.kind !== "tabset") throw new Error("Expected merged tabset root.");
    subject.cancelCalls.length = 0;
    asTestFramePort(liveView.framePort).calls.length = 0;

    const result = subject.controller.commitDock({
      kind: "split-tab",
      operation: "same-frame-split",
      source: {
        frameId: "debug-frame-1",
        sourceTabsetId: root.id,
        viewActorId: "hierarchy-view",
        viewKey: "hierarchy"
      },
      targetFrameId: "debug-frame-1",
      targetTabsetId: root.id,
      placement: "left",
      reason: "dock-drop"
    });

    expect(result).toEqual({ committed: true, sourceFrameDestroyed: false });
    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeTruthy();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("hierarchy-view")!))
      .toBe("debug-frame-1");
    expect(subject.controller.getLiveViewByActorId("hierarchy-view")).toMatchObject({
      frameActor: subject.actorSystem.getActor("debug-frame-1")
    });
    const snapshot = subject.controller.getWorkspaceGraphSnapshot();
    const frame = snapshot.frames.find((candidate) => candidate.frameId === "debug-frame-1");
    expect(frame?.root.kind).toBe("split");
    expect(snapshot.placements.map((placement) => ({
      contentId: placement.contentId,
      tabsetId: placement.tabsetId,
      active: placement.active
    }))).toEqual(expect.arrayContaining([
      {
        contentId: "content:instance:debug:default",
        tabsetId: "frame-tabset:target",
        active: true
      },
      {
        contentId: "content:instance:hierarchy:default",
        tabsetId: "frame-tabset:target:tabset:content:instance:hierarchy:default",
        active: true
      }
    ]));
    expect(asTestFramePort(liveView.framePort).calls.filter((call) =>
      call.startsWith("split:") || call.startsWith("add:") || call.startsWith("remove:") || call.startsWith("restore:")
    )).toEqual([]);
  });

  it("resizes a graph split without mutating frame-local placement APIs", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "hierarchy-frame", viewActorId: "hierarchy-view", viewKey: "hierarchy" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    const liveView = subject.controller.getLiveViewByActorId("hierarchy-view");
    if (!liveView) throw new Error("Expected live hierarchy view.");
    const root = asTestFramePort(liveView.framePort).readRenderedRoot();
    if (!root || root.kind !== "tabset") throw new Error("Expected merged tabset root.");
    subject.controller.commitDock({
      kind: "split-tab",
      operation: "same-frame-split",
      source: {
        frameId: "debug-frame-1",
        sourceTabsetId: root.id,
        viewActorId: "hierarchy-view",
        viewKey: "hierarchy"
      },
      targetFrameId: "debug-frame-1",
      targetTabsetId: root.id,
      placement: "left",
      reason: "dock-drop"
    });
    const before = subject.controller.getWorkspaceGraphSnapshot()
      .frames.find((candidate) => candidate.frameId === "debug-frame-1");
    if (before?.root.kind !== "split") throw new Error("Expected graph split root.");
    asTestFramePort(liveView.framePort).calls.length = 0;

    expect(subject.controller.resizeFrameSplit("debug-frame-1", before.root.id, 0.7, "programmatic"))
      .toEqual({ resized: true });

    const after = subject.controller.getWorkspaceGraphSnapshot()
      .frames.find((candidate) => candidate.frameId === "debug-frame-1");
    expect(after?.root).toMatchObject({
      kind: "split",
      id: before.root.id,
      ratio: 0.7
    });
    expect(asTestFramePort(liveView.framePort).calls.filter((call) =>
      call.startsWith("split:") || call.startsWith("add:") || call.startsWith("remove:") || call.startsWith("restore:")
    )).toEqual([]);
  });

  it("rejects splitting a single tab into its own tabset", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    const intent = {
      kind: "split-tab" as const,
      operation: "same-frame-split" as const,
      source: {
        frameId: "debug-frame-1",
        sourceTabsetId: "frame-tabset:target",
        viewActorId: "debug-view-1",
        viewKey: "debug" as const
      },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      placement: "left" as const,
      reason: "dock-drop" as const
    };

    expect(subject.controller.validateDockCommit(intent))
      .toEqual({ valid: false, reason: "same tabset split is a no-op" });
    expect(subject.controller.commitDock(intent))
      .toEqual({ committed: false, reason: "same tabset split is a no-op" });
    expect(subject.controller.getWorkspaceGraphSnapshot().placements.map((placement) => placement.identity.viewKey))
      .toEqual(["debug"]);
  });

  it("validates floating tab intents with finite positive bounds", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    const source = {
      frameId: "debug-frame-1",
      viewActorId: "debug-view-1",
      viewKey: "debug" as const
    };

    expect(subject.controller.validateDockCommit({
      kind: "float-tab",
      operation: "cross-frame-float",
      source,
      bounds: { left: 10, top: 20, right: 210, bottom: 140, width: 200, height: 120 },
      reason: "dock-drop"
    })).toEqual({ valid: true });
    expect(subject.controller.validateDockCommit({
      kind: "float-tab",
      operation: "cross-frame-float",
      source,
      bounds: { left: 10, top: 20, right: 10, bottom: 140, width: 0, height: 120 },
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "floating bounds are invalid" });
  });

  it("commits a tab merge through graph placement, moves the view actor, and destroys the empty source frame", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.focusCalls.length = 0;
    subject.cancelCalls.length = 0;

    const result = subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    const hierarchyView = subject.controller.getLiveViewByActorId("hierarchy-view");
    const targetPort = hierarchyView?.framePort;
    const debugContent = debugView?.content as ReturnType<typeof createContent> | undefined;
    expect(result).toEqual({ committed: true, sourceFrameDestroyed: true });
    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.focusCalls).toEqual(["focus:hierarchy-frame:programmatic"]);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("hierarchy-frame");
    expect(debugView?.frameActor.id).toBe("hierarchy-frame");
    expect(debugView?.framePort.frameId).toBe("hierarchy-frame");
    expect(asOptionalTestFramePort(targetPort)?.readRenderedViewActorIds()).toEqual([
      "hierarchy-view",
      "debug-view-1"
    ]);
    expect(asOptionalTestFramePort(targetPort)?.readActiveViewActorId()).toBe("debug-view-1");
    expect(debugContent?.calls).toContain("place:hierarchy-frame");
    expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
      viewKey: "debug",
      viewActorId: "debug-view-1",
      ownerFrameActorId: "hierarchy-frame",
      ownerFrameVisible: true,
      ownerFrameActiveInHierarchy: true,
      activeInFrame: true,
      visibleInFrame: true,
      presentation: "windowed"
    });
  });

  it("commits a split tab through graph placement into the target tabset and destroys the empty source frame", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.focusCalls.length = 0;
    subject.cancelCalls.length = 0;

    const result = subject.controller.commitDock({
      kind: "split-tab",
      operation: "cross-frame-split",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      placement: "left",
      reason: "dock-drop"
    });

    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    const hierarchyView = subject.controller.getLiveViewByActorId("hierarchy-view");
    const targetPort = asOptionalTestFramePort(hierarchyView?.framePort);
    const debugContent = debugView?.content as ReturnType<typeof createContent> | undefined;
    expect(result).toEqual({ committed: true, sourceFrameDestroyed: true });
    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.focusCalls).toEqual(["focus:hierarchy-frame:programmatic"]);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("hierarchy-frame");
    expect(debugView?.frameActor.id).toBe("hierarchy-frame");
    expect(debugView?.framePort.frameId).toBe("hierarchy-frame");
    expect(targetPort?.calls.some((call) => call.startsWith("split:"))).toBe(false);
    expect(targetPort?.calls.some((call) => call.startsWith("render:hierarchy-frame:"))).toBe(true);
    expect(targetPort?.calls).toContain(
      "place:content:instance:debug:default:frame-tabset:target:tabset:content:instance:debug:default"
    );
    expect(targetPort?.readRenderedViewActorIds()).toEqual([
      "debug-view-1",
      "hierarchy-view"
    ]);
    expect(targetPort?.readActiveViewActorId()).toBe("debug-view-1");
    expect(debugContent?.calls).toContain("place:hierarchy-frame");
    expect(subject.controller.getLocationByViewActorId("debug-view-1")).toMatchObject({
      viewKey: "debug",
      ownerFrameActorId: "hierarchy-frame",
      activeInFrame: true,
      visibleInFrame: true
    });
  });

  it("destroys all merged child views when closing the merged frame", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.cancelCalls.length = 0;

    subject.controller.closeFrame("hierarchy-frame", "close-button");

    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.actorSystem.getActor("hierarchy-frame")).toBeNull();
    expect(subject.actorSystem.getActor("hierarchy-view")).toBeNull();
    expect(subject.actorSystem.getActor("debug-view-1")).toBeNull();
    expect(subject.controller.listLiveViews()).toEqual([]);
  });

  it("treats frame close as destroy-and-menu-recreate instead of persisted hidden state", () => {
    const subject = createSubject();
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "hierarchy-frame", viewActorId: "hierarchy-view", viewKey: "hierarchy" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    expect(subject.controller.createFrameLayoutSnapshot()).toMatchObject({
      hiddenViewKeys: [],
      frames: [{ frameId: "debug-frame-1" }]
    });

    subject.controller.closeFrame("debug-frame-1", "close-button");
    const closedSnapshot = subject.controller.createFrameLayoutSnapshot();

    expect(subject.controller.listLiveViews()).toEqual([]);
    expect(closedSnapshot.frames).toEqual([]);
    expect(closedSnapshot.views).toEqual({});
    expect(closedSnapshot.hiddenViewKeys).toEqual([]);
    expect(subject.actorSystem.listActors().map((actor) => actor.id)).toEqual([]);

    subject.controller.openView("scene", "menu");
    subject.controller.openView("debug", "menu");
    subject.controller.openView("hierarchy", "menu");

    expect(subject.controller.getLocationByViewKey("scene")).toMatchObject({
      ownerFrameActorId: "scene-frame",
      viewActorId: "scene-view"
    });
    expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
      ownerFrameActorId: "debug-frame-2",
      viewActorId: "debug-view-2"
    });
    expect(subject.controller.getLocationByViewKey("hierarchy")).toMatchObject({
      ownerFrameActorId: "hierarchy-frame",
      viewActorId: "hierarchy-view"
    });
    expect(subject.controller.createFrameLayoutSnapshot().hiddenViewKeys).toEqual([]);
  });

  it("treats tab close as removed from persisted live layout instead of hidden state", () => {
    const subject = createSubject();
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "hierarchy-frame", viewActorId: "hierarchy-view", viewKey: "hierarchy" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    expect(subject.controller.closeView("scene-view", "tab-action", {
      ownerFrameId: "debug-frame-1",
      viewKey: "scene"
    })).toEqual({
      closed: true,
      sourceFrameId: "debug-frame-1",
      ownerFrameDestroyed: false,
      nextActiveViewActorId: "hierarchy-view"
    });
    const sceneClosedSnapshot = subject.controller.createFrameLayoutSnapshot();

    expect(Object.keys(sceneClosedSnapshot.views).sort()).toEqual(["debug", "hierarchy"]);
    expect(JSON.stringify(sceneClosedSnapshot)).not.toContain("scene-view");
    expect(sceneClosedSnapshot.hiddenViewKeys).toEqual([]);

    subject.controller.openView("scene", "menu");
    expect(subject.controller.getLocationByViewKey("scene")).toMatchObject({
      ownerFrameActorId: "scene-frame",
      viewActorId: "scene-view"
    });

    expect(subject.controller.closeView("debug-view-1", "tab-action", {
      ownerFrameId: "debug-frame-1",
      viewKey: "debug"
    })).toEqual({
      closed: true,
      sourceFrameId: "debug-frame-1",
      ownerFrameDestroyed: false,
      nextActiveViewActorId: "hierarchy-view"
    });
    const debugClosedSnapshot = subject.controller.createFrameLayoutSnapshot();

    expect(Object.keys(debugClosedSnapshot.views).sort()).toEqual(["hierarchy", "scene"]);
    expect(JSON.stringify(debugClosedSnapshot)).not.toContain("debug-view-1");
    expect(debugClosedSnapshot.hiddenViewKeys).toEqual([]);

    subject.controller.openView("debug", "menu");
    expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
      ownerFrameActorId: "debug-frame-2",
      viewActorId: "debug-view-2"
    });
  });

  it("repeats merge, float, close, and menu recreate without stale live actors", () => {
    const floatingCalls: string[] = [];
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, floatingCalls)
    });

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      subject.controller.openView("debug", "menu");
      subject.controller.openView("hierarchy", "menu");
      const debugLocation = subject.controller.getLocationByViewKey("debug");
      const hierarchyLocation = subject.controller.getLocationByViewKey("hierarchy");
      expect(debugLocation).not.toBeNull();
      expect(hierarchyLocation).not.toBeNull();

      expect(subject.controller.commitDock({
        kind: "merge-tabs",
      operation: "cross-frame-merge",
        source: {
          frameId: debugLocation!.ownerFrameActorId,
          viewActorId: debugLocation!.viewActorId,
          viewKey: "debug"
        },
        targetFrameId: hierarchyLocation!.ownerFrameActorId,
        targetTabsetId: "frame-tabset:target",
        reason: "dock-drop"
      })).toEqual({ committed: true, sourceFrameDestroyed: true });
      expect(subject.actorSystem.getActor(`debug-frame-${cycle}`)).toBeNull();
      expect(subject.actorSystem.getParentId(subject.actorSystem.getActor(`debug-view-${cycle}`)!))
        .toBe("hierarchy-frame");

      expect(subject.controller.commitDock({
        kind: "float-tab",
      operation: "cross-frame-float",
        source: {
          frameId: "hierarchy-frame",
          viewActorId: `debug-view-${cycle}`,
          viewKey: "debug"
        },
        bounds: { left: 100 + cycle, top: 120, right: 360 + cycle, bottom: 300, width: 260, height: 180 },
        reason: "dock-drop"
      })).toEqual({ committed: true, sourceFrameDestroyed: false });
      expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
        ownerFrameActorId: `floating-debug-view-${cycle}`,
        visibleInFrame: true
      });
      expect(subject.controller.getLocationByViewKey("hierarchy")).toMatchObject({
        ownerFrameActorId: "hierarchy-frame",
        visibleInFrame: true
      });

      subject.controller.closeFrame(`floating-debug-view-${cycle}`, "close-button");
      expect(subject.controller.getLocationByViewKey("debug")).toBeNull();
      expect(subject.actorSystem.getActor(`floating-debug-view-${cycle}`)).toBeNull();
      expect(subject.actorSystem.getActor(`debug-view-${cycle}`)).toBeNull();

      subject.controller.closeFrame("hierarchy-frame", "close-button");
      expect(subject.controller.listLiveViews()).toEqual([]);
      expect(subject.actorSystem.listActors().map((actor) => actor.id)).toEqual([]);
    }

    expect(nonInitialFloatingCalls(floatingCalls).filter((call) => call.includes(":persistent"))).toHaveLength(3);
  });

  it("rolls back a tab merge when actor parent mutation throws", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.actorSystem.setParent(subject.actorSystem.getActor("hierarchy-frame")!, "debug-view-1");
    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    const debugContent = debugView?.content as ReturnType<typeof createContent>;

    const result = subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    const targetPort = subject.controller.getLiveViewByActorId("hierarchy-view")?.framePort;
    expect(result).toEqual({ committed: false, reason: "Actor parent cycle detected: debug-view-1 -> hierarchy-frame" });
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("debug-frame-1");
    expect(debugView?.frameActor.id).toBe("debug-frame-1");
    expect(asOptionalTestFramePort(debugView?.framePort)?.readRenderedViewActorIds()).toEqual(["debug-view-1"]);
    expect(asOptionalTestFramePort(targetPort)?.readRenderedViewActorIds()).toEqual(["hierarchy-view"]);
    expect(debugContent.calls).toContain("place:debug-frame-1");
  });

  it("keeps the moved view consistent when empty source frame destroy throws", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.actorSystem.setComponentDisposer((actor) => {
      if (actor.id === "debug-frame-1") {
        throw new Error("source destroy failed");
      }
    });

    const result = subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    expect(result).toEqual({
      committed: true,
      sourceFrameDestroyed: false,
      warning: "source destroy failed"
    });
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeTruthy();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("hierarchy-frame");
    expect(debugView?.frameActor.id).toBe("hierarchy-frame");
    expect(debugView?.framePort.frameId).toBe("hierarchy-frame");
  });

  it("floats a merged tab into a new frame while preserving the source frame's remaining tab", () => {
    const floatingFrameCalls: string[] = [];
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, floatingFrameCalls)
    });
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.cancelCalls.length = 0;
    subject.focusCalls.length = 0;

    const result = subject.controller.commitDock({
      kind: "float-tab",
      operation: "cross-frame-float",
      source: {
        frameId: "hierarchy-frame",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      bounds: { left: 80, top: 90, right: 360, bottom: 250, width: 280, height: 160 },
      reason: "dock-drop"
    });

    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    const hierarchyView = subject.controller.getLiveViewByActorId("hierarchy-view");
    const debugContent = debugView?.content as ReturnType<typeof createContent> | undefined;
    expect(result).toEqual({ committed: true, sourceFrameDestroyed: false });
    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.focusCalls).toEqual(["focus:floating-debug-view-1:programmatic"]);
    expect(nonInitialFloatingCalls(floatingFrameCalls)).toEqual(["create:debug-view-1:80:90:280:160:persistent"]);
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!))
      .toBe("floating-debug-view-1");
    expect(debugView?.frameActor.id).toBe("floating-debug-view-1");
    expect(asOptionalTestFramePort(debugView?.framePort)?.readRenderedViewActorIds()).toEqual(["debug-view-1"]);
    expect(debugContent?.calls).toContain("place:floating-debug-view-1");
    expect(asOptionalTestFramePort(hierarchyView?.framePort)?.readRenderedViewActorIds()).toEqual(["hierarchy-view"]);
    expect(subject.actorSystem.getActor("hierarchy-frame")).toBeTruthy();
    expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
      ownerFrameActorId: "floating-debug-view-1",
      viewActorId: "debug-view-1"
    });
  });

  it("reports inactive tab visibility through the frame port", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    subject.controller.activateFrameTab("hierarchy-frame", "hierarchy-view", "tab-click");

    expect(subject.controller.getLocationByViewKey("debug")).toMatchObject({
      activeInFrame: false,
      visibleInFrame: false
    });
    expect(subject.controller.getLocationByViewKey("hierarchy")).toMatchObject({
      activeInFrame: true,
      visibleInFrame: true
    });
  });

  it("creates a logical frame layout snapshot from current live ownership", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    const snapshot = subject.controller.createFrameLayoutSnapshot();
    const root = expectSnapshotTabset(snapshot.frames[0]?.root);

    expect(Object.keys(snapshot.views)).toEqual(["debug", "hierarchy"]);
    expect(snapshot.views["debug"]).toMatchObject({
      viewKey: "debug",
      actorId: "debug-view-1",
      title: "Debug Log"
    });
    expect(snapshot.frames).toHaveLength(1);
    expect(snapshot.frames[0]).toMatchObject({
      frameId: "hierarchy-frame",
      presentation: "windowed",
      bounds: {
        position: { x: 0, y: 0 },
        size: { x: 0, y: 0 },
        visible: true
      }
    });
    expect(root.tabs).toEqual(["hierarchy", "debug"]);
    expect(root.activeTabId).toBe("debug");
    expect(JSON.stringify(snapshot.frames)).not.toContain("debug-view-1");
  });

  it("restores a logical merged frame layout with fresh runtime view actors", () => {
    const subject = createSubject();

    const result = subject.controller.restoreFrameLayout(createWindowWorkspaceFrameLayout({
      views: [
        { viewKey: "scene", actorId: "stale-scene-view", title: "Scene" },
        { viewKey: "debug", actorId: "stale-debug-view", title: "Debug Log" }
      ],
      frames: [{
        frameId: "persisted-frame",
        bounds: {
          position: { x: 30, y: 40 },
          size: { x: 500, y: 300 },
          visible: true
        },
        presentation: "windowed",
        root: {
          kind: "tabset",
          id: "persisted-tabset",
          tabs: ["scene", "debug"],
          activeTabId: "debug"
        }
      }]
    }), "programmatic");

    const sceneView = subject.controller.getLiveViewByActorId("scene-view");
    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    const scenePort = asOptionalTestFramePort(sceneView?.framePort);
    const debugContent = debugView?.content as ReturnType<typeof createContent> | undefined;
    expect(result).toEqual({
      restoredViewKeys: ["scene", "debug"],
      skippedViewKeys: [],
      destroyedFrameIds: ["debug-frame-1"]
    });
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("scene-frame");
    expect(debugView?.frameActor.id).toBe("scene-frame");
    expect(sceneView?.frameActor.id).toBe("scene-frame");
    expect(scenePort?.readRenderedViewActorIds()).toEqual(["scene-view", "debug-view-1"]);
    expect(scenePort?.readActiveViewActorId()).toBe("debug-view-1");
    expect(scenePort?.getFloatingBounds()).toMatchObject({ left: 30, top: 40, width: 500, height: 300 });
    expect(debugContent?.calls).toContain("place:scene-frame");
    expect(JSON.stringify(subject.controller.createFrameLayoutSnapshot())).not.toContain("stale-debug-view");
  });

  it("restores a logical split frame layout and preserves the split ratio", () => {
    const subject = createSubject();

    subject.controller.restoreFrameLayout(createWindowWorkspaceFrameLayout({
      views: [
        { viewKey: "scene", actorId: "old-scene-view", title: "Scene" },
        { viewKey: "hierarchy", actorId: "old-hierarchy-view", title: "Hierarchy" }
      ],
      frames: [{
        frameId: "persisted-frame",
        bounds: {
          position: { x: 12, y: 24 },
          size: { x: 640, y: 360 },
          visible: true
        },
        presentation: "fullscreen",
        root: {
          kind: "split",
          id: "persisted-split",
          direction: "horizontal",
          ratio: 0.35,
          first: {
            kind: "tabset",
            id: "persisted-scene",
            tabs: ["scene"],
            activeTabId: "scene"
          },
          second: {
            kind: "tabset",
            id: "persisted-hierarchy",
            tabs: ["hierarchy"],
            activeTabId: "hierarchy"
          }
        }
      }]
    }), "programmatic");

    const sceneView = subject.controller.getLiveViewByActorId("scene-view");
    const hierarchyView = subject.controller.getLiveViewByActorId("hierarchy-view");
    const scenePort = asOptionalTestFramePort(sceneView?.framePort);
    const renderedRoot = scenePort?.readRenderedRoot();
    expect(subject.actorSystem.getActor("hierarchy-frame")).toBeNull();
    expect(sceneView?.frameActor.id).toBe("scene-frame");
    expect(hierarchyView?.frameActor.id).toBe("scene-frame");
    expect(renderedRoot).toMatchObject({
      kind: "split",
      direction: "horizontal",
      ratio: 0.35
    });
    expect(scenePort?.presentation).toBe("windowed");
    expect(subject.controller.createFrameLayoutSnapshot().frames[0]?.root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      ratio: 0.35
    });
  });

  it("fullscreen-presents a single-view Scene frame directly and restores it to windowed", () => {
    const subject = createSubject();
    subject.controller.openView("scene", "programmatic");

    subject.controller.enterViewFullscreen("scene-view", "programmatic");
    const liveScene = subject.controller.getLiveViewByActorId("scene-view");

    expect(liveScene?.frameActor.id).toBe("scene-frame");
    expect(liveScene?.framePort.presentation).toBe("fullscreen");
    expect(subject.controller.getViewFullscreenSession("scene-view")).toEqual({
      viewActorId: "scene-view",
      viewKey: "scene",
      mode: "direct-frame",
      fullscreenFrameId: "scene-frame"
    });

    subject.controller.exitViewFullscreen("scene-view", "programmatic");

    expect(liveScene?.framePort.presentation).toBe("windowed");
    expect(subject.controller.getViewFullscreenSession("scene-view")).toBeNull();
  });

  it("workspace-fullscreens a single-view Scene frame through an isolated runtime frame", () => {
    const floatingFrameCalls: string[] = [];
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({
      framePorts,
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, floatingFrameCalls)
    });
    subject.controller.openView("scene", "programmatic");
    const sourceScene = subject.controller.getLiveViewByActorId("scene-view");
    if (!sourceScene) throw new Error("Expected live Scene view.");
    framePorts.register({
      frameActor: sourceScene.frameActor,
      framePort: sourceScene.framePort,
      getStackPriority: () => 500
    });

    subject.controller.enterViewWorkspaceFullscreen("scene-view", "programmatic");
    const fullscreenScene = subject.controller.getLiveViewByActorId("scene-view");

    expect(nonInitialFloatingCalls(floatingFrameCalls)).toEqual(["create:scene-view:0:0:0:0:runtime"]);
    expect(fullscreenScene?.frameActor.id).toBe("floating-scene-view");
    expect(fullscreenScene?.framePort.presentation).toBe("fullscreen");
    expect(subject.controller.getViewFullscreenSession("scene-view")).toEqual({
      viewActorId: "scene-view",
      viewKey: "scene",
      mode: "isolated-frame",
      fullscreenFrameId: "floating-scene-view"
    });
    expect(subject.controller.createFrameLayoutSnapshot().frames.map((frame) => frame.frameId))
      .toContain("scene-frame");

    subject.controller.exitViewFullscreen("scene-view", "programmatic");

    const restoredScene = subject.controller.getLiveViewByActorId("scene-view");
    expect(restoredScene?.frameActor.id).toBe("scene-frame");
    expect(subject.actorSystem.getActor("floating-scene-view")).toBeNull();
  });

  it("isolates a single Scene tab when its owner is the permanent root frame", () => {
    const floatingFrameCalls: string[] = [];
    const framePorts = new WindowFramePortRegistry();
    const subject = createSubject({
      framePorts,
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, floatingFrameCalls)
    });
    const rootFrame = subject.actorSystem.createActor({ id: "workspace-root-frame" });
    const rootPort = createFramePort("workspace-root-frame");
    framePorts.register({
      frameActor: rootFrame,
      framePort: rootPort,
      getStackPriority: () => 100,
      destroyWhenEmpty: false
    });
    subject.controller.openView("scene", "programmatic", {
      preferredFrameId: "workspace-root-frame"
    });

    subject.controller.enterViewFullscreen("scene-view", "programmatic");
    const fullscreenScene = subject.controller.getLiveViewByActorId("scene-view");

    expect(nonInitialFloatingCalls(floatingFrameCalls)).toEqual(["create:scene-view:0:0:0:0:runtime"]);
    expect(fullscreenScene?.frameActor.id).toBe("floating-scene-view");
    expect(fullscreenScene?.framePort.presentation).toBe("fullscreen");
    expect(rootPort.readRenderedViewActorIds()).toEqual([]);
    expect(subject.actorSystem.getActor("workspace-root-frame")).toBe(rootFrame);
    expect(subject.controller.getViewFullscreenSession("scene-view")).toEqual({
      viewActorId: "scene-view",
      viewKey: "scene",
      mode: "isolated-frame",
      fullscreenFrameId: "floating-scene-view"
    });

    subject.controller.exitViewFullscreen("scene-view", "programmatic");

    const restoredScene = subject.controller.getLiveViewByActorId("scene-view");
    expect(subject.actorSystem.getActor("floating-scene-view")).toBeNull();
    expect(restoredScene?.frameActor.id).toBe("workspace-root-frame");
    expect(restoredScene?.framePort).toBe(rootPort);
    expect(rootPort.readRenderedViewActorIds()).toEqual(["scene-view"]);
  });

  it("isolates Scene into a temporary fullscreen frame when its owner has mixed tabs", () => {
    const floatingFrameCalls: string[] = [];
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, floatingFrameCalls)
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    subject.controller.enterViewFullscreen("scene-view", "programmatic");
    const liveScene = subject.controller.getLiveViewByActorId("scene-view");
    const liveDebug = subject.controller.getLiveViewByActorId("debug-view-1");

    expect(subject.cancelCalls).toEqual(["cancel", "cancel"]);
    expect(nonInitialFloatingCalls(floatingFrameCalls)).toEqual(["create:scene-view:0:0:0:0:runtime"]);
    expect(liveScene?.frameActor.id).toBe("floating-scene-view");
    expect(liveScene?.framePort.presentation).toBe("fullscreen");
    expect(liveScene?.framePort.visiblePath).toBeNull();
    expect(asOptionalTestContent(liveScene?.content)?.calls).toContain("place:floating-scene-view");
    expect(liveDebug?.frameActor.id).toBe("debug-frame-1");
    expect(asOptionalTestFramePort(liveDebug?.framePort)?.readRenderedViewActorIds()).toEqual(["debug-view-1"]);
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("scene-view")!)).toBe("floating-scene-view");
    expect(subject.controller.getViewFullscreenSession("scene-view")).toEqual({
      viewActorId: "scene-view",
      viewKey: "scene",
      mode: "isolated-frame",
      fullscreenFrameId: "floating-scene-view"
    });
  });

  it("restores an isolated Scene fullscreen session to the source frame and destroys the temporary frame", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, [])
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.controller.enterViewFullscreen("scene-view", "programmatic");

    subject.controller.exitViewFullscreen("scene-view", "programmatic");
    const liveScene = subject.controller.getLiveViewByActorId("scene-view");
    const liveDebug = subject.controller.getLiveViewByActorId("debug-view-1");

    expect(subject.actorSystem.getActor("floating-scene-view")).toBeNull();
    expect(liveScene?.frameActor.id).toBe("debug-frame-1");
    expect(liveScene?.framePort).toBe(liveDebug?.framePort);
    expect(asOptionalTestFramePort(liveScene?.framePort)?.readRenderedViewActorIds()).toEqual(["debug-view-1", "scene-view"]);
    expect(asOptionalTestContent(liveScene?.content)?.calls).toContain("place:debug-frame-1");
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("scene-view")!)).toBe("debug-frame-1");
    expect(subject.controller.getViewFullscreenSession("scene-view")).toBeNull();
  });

  it("repeats Scene dock, fullscreen restore, float, and direct fullscreen restore", () => {
    const floatingCalls: string[] = [];
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, floatingCalls)
    });

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      subject.controller.openView("scene", "programmatic");
      subject.controller.openView("debug", "programmatic");
      const debugFrameId = `debug-frame-${cycle}`;
      expect(subject.controller.commitDock({
        kind: "merge-tabs",
      operation: "cross-frame-merge",
        source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
        targetFrameId: debugFrameId,
        targetTabsetId: "frame-tabset:target",
        reason: "dock-drop"
      })).toEqual({ committed: true, sourceFrameDestroyed: true });

      subject.controller.enterViewFullscreen("scene-view", "programmatic");
      expect(subject.controller.getViewFullscreenSession("scene-view")).toMatchObject({
        mode: "isolated-frame",
        fullscreenFrameId: "floating-scene-view"
      });
      expect(subject.controller.getLocationByViewKey("scene")).toMatchObject({
        ownerFrameActorId: "floating-scene-view",
        presentation: "fullscreen",
        visibleInFrame: true
      });
      expect(subject.controller.createFrameLayoutSnapshot().frames.map((frame) => frame.frameId))
        .toEqual([debugFrameId]);

      subject.controller.exitViewFullscreen("scene-view", "programmatic");
      expect(subject.actorSystem.getActor("floating-scene-view")).toBeNull();
      expect(subject.controller.getLocationByViewKey("scene")).toMatchObject({
        ownerFrameActorId: debugFrameId,
        presentation: "windowed"
      });

      expect(subject.controller.commitDock({
        kind: "float-tab",
      operation: "cross-frame-float",
        source: { frameId: debugFrameId, viewActorId: "scene-view", viewKey: "scene" },
        bounds: { left: 80, top: 90 + cycle, right: 420, bottom: 290 + cycle, width: 340, height: 200 },
        reason: "dock-drop"
      })).toEqual({ committed: true, sourceFrameDestroyed: false });
      expect(subject.controller.getLocationByViewKey("scene")).toMatchObject({
        ownerFrameActorId: "floating-scene-view",
        visibleInFrame: true
      });

      subject.controller.enterViewFullscreen("scene-view", "programmatic");
      expect(subject.controller.getViewFullscreenSession("scene-view")).toMatchObject({
        mode: "direct-frame",
        fullscreenFrameId: "floating-scene-view"
      });
      subject.controller.exitViewFullscreen("scene-view", "programmatic");
      expect(subject.controller.getViewFullscreenSession("scene-view")).toBeNull();
      expect(subject.controller.getLocationByViewKey("scene")).toMatchObject({
        ownerFrameActorId: "floating-scene-view",
        presentation: "windowed"
      });

      subject.controller.closeFrame("floating-scene-view", "close-button");
      subject.controller.closeFrame(debugFrameId, "close-button");
      expect(subject.controller.listLiveViews()).toEqual([]);
      expect(subject.actorSystem.listActors().map((actor) => actor.id)).toEqual([]);
    }

    expect(nonInitialFloatingCalls(floatingCalls).filter((call) => call.includes(":runtime"))).toHaveLength(3);
    expect(nonInitialFloatingCalls(floatingCalls).filter((call) => call.includes(":persistent"))).toHaveLength(3);
  });

  it("omits temporary fullscreen isolation frames from layout snapshots", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, [])
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.controller.enterViewFullscreen("scene-view", "programmatic");

    const snapshot = subject.controller.createFrameLayoutSnapshot();

    expect(snapshot.frames.map((frame) => frame.frameId)).toEqual(["debug-frame-1"]);
    expect(snapshot.views.scene.actorId).toBe("scene-view");
    expect(expectSnapshotTabset(snapshot.frames[0].root).tabs).toEqual(["debug", "scene"]);
  });

  it("keeps develop visibility in snapshots when an isolated source frame is temporarily hidden", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, [])
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.controller.enterViewFullscreen("scene-view", "programmatic");
    subject.controller.getLiveViewByActorId("debug-view-1")?.framePort.requestVisible(false);

    const snapshot = subject.controller.createFrameLayoutSnapshot();

    expect(snapshot.frames).toHaveLength(1);
    expect(snapshot.frames[0].frameId).toBe("debug-frame-1");
    expect(snapshot.frames[0].bounds.visible).toBe(true);
    expect(expectSnapshotTabset(snapshot.frames[0].root).tabs).toEqual(["debug", "scene"]);
  });

  it("falls back to a normal persistent floating frame when the isolated source frame is gone", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => ({ source, tab, viewKey, runtimeOnly }) => {
        const resolvedViewKey = viewKey ?? source?.viewKey;
        if (!resolvedViewKey) {
          throw new Error("Test floating frame factory requires a view key.");
        }
        const sourceViewActorId = source?.viewActorId ?? `${resolvedViewKey}-view`;
        const initialFrameId = resolvedViewKey === "scene"
          ? "scene-frame"
          : `${resolvedViewKey}-frame-1`;
        const frameActor = actorSystem.createActor({
          id: source
            ? (runtimeOnly ? `floating-${sourceViewActorId}` : `fallback-${sourceViewActorId}`)
            : initialFrameId
        });
        return {
          frameActor,
          framePort: createFramePort(frameActor.id, tab ? [tab] : [], {
            visiblePath: runtimeOnly ? null : undefined,
            persistable: runtimeOnly ? false : true
          })
        };
      }
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      operation: "cross-frame-merge",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.controller.enterViewFullscreen("scene-view", "programmatic");
    subject.actorSystem.destroyActor(subject.actorSystem.getActor("debug-frame-1")!);

    subject.controller.exitViewFullscreen("scene-view", "programmatic");
    const liveScene = subject.controller.getLiveViewByActorId("scene-view");

    expect(subject.actorSystem.getActor("floating-scene-view")).toBeNull();
    expect(liveScene?.frameActor.id).toBe("fallback-scene-view");
    expect(liveScene?.framePort.visiblePath).toBe("fallback-scene-view.visible");
    expect(liveScene?.framePort.presentation).toBe("windowed");
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("scene-view")!)).toBe("fallback-scene-view");
  });

  it("floats a single-tab frame into a new frame and destroys the old source frame", () => {
    const floatingFrameCalls: string[] = [];
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, floatingFrameCalls)
    });
    subject.controller.openView("debug", "programmatic");
    subject.cancelCalls.length = 0;
    subject.focusCalls.length = 0;

    const result = subject.controller.commitDock({
      kind: "float-tab",
      operation: "cross-frame-float",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      bounds: { left: 10, top: 20, right: 310, bottom: 180, width: 300, height: 160 },
      reason: "dock-drop"
    });

    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    expect(result).toEqual({ committed: true, sourceFrameDestroyed: true });
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("floating-debug-view-1");
    expect(debugView?.frameActor.id).toBe("floating-debug-view-1");
    expect(nonInitialFloatingCalls(floatingFrameCalls)).toEqual(["create:debug-view-1:10:20:300:160:persistent"]);
  });

  it("rolls back floating when actor parent mutation throws", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => (
        createFloatingFrameFactory(actorSystem, [], { parentNewFrameToView: true })
      )
    });
    subject.controller.openView("debug", "programmatic");
    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    const debugContent = debugView?.content as ReturnType<typeof createContent>;

    const result = subject.controller.commitDock({
      kind: "float-tab",
      operation: "cross-frame-float",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      bounds: { left: 10, top: 20, right: 310, bottom: 180, width: 300, height: 160 },
      reason: "dock-drop"
    });

    expect(result).toEqual({
      committed: false,
      reason: "Actor parent cycle detected: debug-view-1 -> floating-debug-view-1"
    });
    expect(subject.actorSystem.getActor("floating-debug-view-1")).toBeNull();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("debug-frame-1");
    expect(debugView?.frameActor.id).toBe("debug-frame-1");
    expect(asOptionalTestFramePort(debugView?.framePort)?.readRenderedViewActorIds()).toEqual(["debug-view-1"]);
    expect(debugContent.calls).toContain("place:debug-frame-1");
  });

  it("keeps the floated view consistent when source frame destroy throws", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, [])
    });
    subject.controller.openView("debug", "programmatic");
    subject.actorSystem.setComponentDisposer((actor) => {
      if (actor.id === "debug-frame-1") {
        throw new Error("source destroy failed");
      }
    });

    const result = subject.controller.commitDock({
      kind: "float-tab",
      operation: "cross-frame-float",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      bounds: { left: 10, top: 20, right: 310, bottom: 180, width: 300, height: 160 },
      reason: "dock-drop"
    });

    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    expect(result).toEqual({
      committed: true,
      sourceFrameDestroyed: false,
      warning: "source destroy failed"
    });
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("floating-debug-view-1");
    expect(debugView?.frameActor.id).toBe("floating-debug-view-1");
    expect(debugView?.framePort.frameId).toBe("floating-debug-view-1");
  });

});

interface TestFramePort extends WindowFramePort, WindowWorkspaceGraphReconcilerSurface<WindowRegisteredContent> {
  readonly calls: string[];
  readRenderedViewActorIds(): readonly string[];
  readActiveViewActorId(): string | null;
  readRenderedRoot(): WindowFrameSurfaceSnapshotNode | null;
  readPlacedContentFrames(): readonly string[];
}

function createFramePort(
  frameId: string,
  _initialTabs: readonly WindowFrameTab[] = [],
  options: {
    readonly visiblePath?: WindowFramePort["visiblePath"];
    readonly persistable?: boolean;
  } = {}
): TestFramePort {
  const calls: string[] = [];
  let lastSnapshot: WindowFrameSurfaceSnapshot | null = null;
  const placedContentFrames: string[] = [];
  let visible = true;
  let presentationSuppressed = false;
  let presentation: WindowFramePort["presentation"] = "windowed";
  let floatingState = {
    position: { x: 0, y: 0 },
    size: { x: 0, y: 0 },
    visible: true
  };
  return {
    frameId,
    calls,
    visiblePath: options.visiblePath === undefined
      ? `${frameId}.visible` as WindowFramePort["visiblePath"]
      : options.visiblePath,
    get visible() {
      return visible;
    },
    get effectiveVisible() {
      return visible && !presentationSuppressed;
    },
    get persistable() {
      return options.persistable ?? true;
    },
    get presentationSuppressed() {
      return presentationSuppressed;
    },
    get presentation() {
      return presentation;
    },
    renderFrameSurface(snapshot: WindowFrameSurfaceSnapshot) {
      calls.push(`render:${snapshot.frameId}:${snapshot.revision}`);
      lastSnapshot = snapshot;
    },
    measureFrameSurfaceGeometry(snapshot: WindowFrameSurfaceSnapshot): WindowWorkspaceSurfaceGeometryProjection {
      return createTestSurfaceGeometry(snapshot);
    },
    placeContent(placement: WindowWorkspaceGraphContentPlacement<WindowRegisteredContent>) {
      calls.push(`place:${placement.placement.contentId}:${placement.placement.tabsetId}`);
      const content = testContentsByElement.get(placement.content.element);
      if (content) {
        content.calls.push(`place:${frameId}`);
        placedContentFrames.push(frameId);
      }
    },
    removeContent(contentId) {
      calls.push(`remove:${contentId}`);
    },
    setContentActive(state: WindowWorkspaceGraphContentActiveState) {
      calls.push(`active:${state.contentId}:${state.active}:${state.interactable}`);
    },
    readRenderedViewActorIds: () => lastSnapshot ? listSurfaceSnapshotTabs(lastSnapshot.root).map((tab) => tab.viewActorId) : [],
    readActiveViewActorId: () => lastSnapshot ? findActiveViewActorIdInSnapshot(lastSnapshot.root) : null,
    readRenderedRoot: () => lastSnapshot?.root ?? null,
    readPlacedContentFrames: () => [...placedContentFrames],
    getFloatingBounds: () => ({
      left: floatingState.position.x,
      top: floatingState.position.y,
      right: floatingState.position.x + floatingState.size.x,
      bottom: floatingState.position.y + floatingState.size.y,
      width: floatingState.size.x,
      height: floatingState.size.y
    }),
    restoreFloatingState(state) {
      calls.push(`state:${state.position.x}:${state.position.y}:${state.size.x}:${state.size.y}:${state.visible}`);
      floatingState = {
        position: { ...state.position },
        size: { ...state.size },
        visible: state.visible
      };
      visible = state.visible;
    },
    setPresentation(nextPresentation) {
      calls.push(`presentation:${nextPresentation}`);
      presentation = nextPresentation;
    },
    setPresentationSuppressed(_reason, suppressed) {
      calls.push(`suppressed:${suppressed}`);
      presentationSuppressed = suppressed;
    },
    requestVisible(nextVisible) {
      calls.push(`visible:${nextVisible}`);
      visible = nextVisible;
    }
  };
}

function createTestSurfaceGeometry(snapshot: WindowFrameSurfaceSnapshot): WindowWorkspaceSurfaceGeometryProjection {
  const tabsets: Array<WindowWorkspaceSurfaceGeometryProjection["tabsets"][number]> = [];
  const splitters: Array<WindowWorkspaceSurfaceGeometryProjection["splitters"][number]> = [];
  collectTestSurfaceGeometry(snapshot.root, tabsets, splitters);
  return {
    frameId: snapshot.frameId,
    revision: snapshot.revision,
    tabsets,
    splitters,
    issues: []
  };
}

function listSurfaceSnapshotTabs(node: WindowFrameSurfaceSnapshotNode): readonly WindowFrameSurfaceSnapshotTab[] {
  if (node.kind === "tabset") return node.tabs;
  return [
    ...listSurfaceSnapshotTabs(node.first),
    ...listSurfaceSnapshotTabs(node.second)
  ];
}

function findActiveViewActorIdInSnapshot(node: WindowFrameSurfaceSnapshotNode): string | null {
  if (node.kind === "tabset") {
    return node.tabs.find((tab) => tab.contentId === node.activeContentId)?.viewActorId ??
      node.tabs.find((tab) => tab.active)?.viewActorId ??
      node.tabs[0]?.viewActorId ??
      null;
  }
  return findActiveViewActorIdInSnapshot(node.first) ?? findActiveViewActorIdInSnapshot(node.second);
}

function asTestFramePort(framePort: WindowFramePort): TestFramePort {
  return framePort as TestFramePort;
}

function asOptionalTestFramePort(framePort: WindowFramePort | null | undefined): TestFramePort | null {
  return framePort ? asTestFramePort(framePort) : null;
}

function collectTestSurfaceGeometry(
  node: WindowFrameSurfaceSnapshot["root"],
  tabsets: Array<WindowWorkspaceSurfaceGeometryProjection["tabsets"][number]>,
  splitters: Array<WindowWorkspaceSurfaceGeometryProjection["splitters"][number]>
): void {
  if (node.kind === "tabset") {
    tabsets.push({
      tabsetId: node.id,
      contentIds: node.tabs.map((tab) => tab.contentId),
      tabBounds: { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24 },
      contentBounds: { left: 0, top: 24, right: 100, bottom: 100, width: 100, height: 76 }
    });
    return;
  }
  splitters.push({
    splitId: node.id,
    direction: node.direction,
    rect: { left: 96, top: 0, right: 104, bottom: 100, width: 8, height: 100 }
  });
  collectTestSurfaceGeometry(node.first, tabsets, splitters);
  collectTestSurfaceGeometry(node.second, tabsets, splitters);
}

function expectSnapshotTabset(node: unknown): WindowFrameTabsetNode {
  expect(node).toMatchObject({ kind: "tabset" });
  return node as WindowFrameTabsetNode;
}

function nonInitialFloatingCalls(calls: readonly string[]): string[] {
  return calls.filter((call) => !call.includes(":new:"));
}

function registerDebugRuntimeFactory(
  registry: WindowViewFactoryRegistry,
  actorSystem: ActorSystem,
  options: {
    readonly disposeViewRuntime: () => void;
  }
): void {
  registry.register({
    viewKey: "debug",
    label: "Debug Log",
    createViewRuntime: ({ parentFrameActor }) => {
      const viewActor = actorSystem.createActor({ id: "debug-view", parent: parentFrameActor });
      return {
        viewActor,
        content: createContent(),
        title: "Debug Log",
        disposeViewRuntime: options.disposeViewRuntime
      };
    }
  });
}

function createFixedFrameFactory(
  actorSystem: ActorSystem,
  frameId: string
): WindowFloatingFrameFactory {
  return ({ tab }) => {
    const frameActor = actorSystem.createActor({ id: frameId });
    return {
      frameActor,
      framePort: createFramePort(frameId, tab ? [tab] : [])
    };
  };
}

function createFloatingFrameFactory(
  actorSystem: ActorSystem,
  calls: string[],
  options: { readonly parentNewFrameToView?: boolean } = {}
): WindowFloatingFrameFactory {
  const counters = new Map<string, number>();
  return ({ source, tab, viewKey, title, bounds, runtimeOnly }) => {
    const resolvedViewKey = viewKey ?? source?.viewKey;
    if (!resolvedViewKey) {
      throw new Error("Test floating frame factory requires a view key.");
    }
    const frameId = source
      ? `floating-${source.viewActorId}`
      : createInitialFrameId(resolvedViewKey, counters);
    const callTarget = source?.viewActorId ?? `${resolvedViewKey}:new`;
    const callBounds = bounds ?? { left: 0, top: 0, width: 0, height: 0 };
    calls.push(`create:${callTarget}:${callBounds.left}:${callBounds.top}:${callBounds.width}:${callBounds.height}:${runtimeOnly ? "runtime" : "persistent"}`);
    const frameActor = actorSystem.createActor({
      id: frameId,
      parent: options.parentNewFrameToView && source ? source.viewActorId : null,
      name: title
    });
    return {
      frameActor,
      framePort: createFramePort(frameActor.id, tab ? [tab] : [], {
        visiblePath: runtimeOnly ? null : undefined,
        persistable: runtimeOnly ? false : true
      })
    };
  };
}

function createInitialFrameId(viewKey: string, counters: Map<string, number>): string {
  if (viewKey === "scene") return "scene-frame";
  if (viewKey === "hierarchy") return "hierarchy-frame";
  const next = (counters.get(viewKey) ?? 0) + 1;
  counters.set(viewKey, next);
  return `${viewKey}-frame-${next}`;
}

const testContentsByElement = new WeakMap<HTMLElement, WindowRegisteredContent & {
  readonly calls: string[];
}>();

type TestRegisteredContent = WindowRegisteredContent & {
  readonly calls: string[];
};

function createContent(): WindowRegisteredContent & {
  readonly calls: string[];
} {
  const calls: string[] = [];
  const element = {} as HTMLElement;
  const content: WindowRegisteredContent & {
    readonly calls: string[];
  } = {
    contentId: `content:${Math.random().toString(16).slice(2)}`,
    element,
    calls,
    get interactable() {
      return true;
    },
    setInteractable() {},
    subscribeLayoutCommit(): WindowContentLayoutCommitRegistration {
      return { dispose() {} };
    },
    dispose() {}
  };
  testContentsByElement.set(element, content);
  return content;
}

function asOptionalTestContent(content: WindowRegisteredContent | null | undefined): TestRegisteredContent | null {
  return content ? content as TestRegisteredContent : null;
}


import { describe, expect, it } from "vitest";
import { ActorSystem, type ActorWindowFocusService } from "../actor-runtime";
import { DefaultWindowFrameLifecycleController } from "./window-frame-lifecycle-controller";
import { createWindowWorkspaceFrameLayout } from ".";
import type {
  WindowContentHost,
  WindowContentRehostable,
  WindowFloatingFrameFactory,
  WindowFramePort,
  WindowFrameRuntimeDockNode,
  WindowFrameTabsetNode,
  WindowFrameTab
} from ".";
import { WindowViewFactoryRegistry } from "./window-view-factory-registry";

function createFocusRecorder(calls: string[]): ActorWindowFocusService {
  return {
    getEffectiveStackPriorityForActor: () => null,
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
} = {}) {
  const actorSystem = new ActorSystem();
  const registry = new WindowViewFactoryRegistry();
  const focusCalls: string[] = [];
  let createCount = 0;
  const cancelCalls: string[] = [];

  registry.register({
    viewKey: "debug",
    label: "Debug Log",
    create: () => {
      createCount += 1;
      const frameActor = actorSystem.createActor({ id: `debug-frame-${createCount}` });
      const viewActor = actorSystem.createActor({
        id: `debug-view-${createCount}`,
        parent: frameActor
      });
      const framePort = createFramePort(frameActor.id, [
        { viewActorId: viewActor.id, viewKey: "debug", title: "Debug Log" }
      ]);
      const content = createContent();
      content.rehostWindowContent(framePort.getContentHost(viewActor.id));
      return {
        frameActor,
        framePort,
        viewActor,
        content
      };
    }
  });
  registry.register({
    viewKey: "hierarchy",
    label: "Hierarchy",
    create: () => {
      const frameActor = actorSystem.createActor({ id: "hierarchy-frame" });
      const viewActor = actorSystem.createActor({
        id: "hierarchy-view",
        parent: frameActor
      });
      const framePort = createFramePort(frameActor.id, [
        { viewActorId: viewActor.id, viewKey: "hierarchy", title: "Hierarchy" }
      ]);
      const content = createContent();
      content.rehostWindowContent(framePort.getContentHost(viewActor.id));
      return {
        frameActor,
        framePort,
        viewActor,
        content
      };
    }
  });
  registry.register({
    viewKey: "scene",
    label: "Scene",
    create: () => {
      const frameActor = actorSystem.createActor({ id: "scene-frame" });
      const viewActor = actorSystem.createActor({
        id: "scene-view",
        parent: frameActor
      });
      const framePort = createFramePort(frameActor.id, [
        { viewActorId: viewActor.id, viewKey: "scene", title: "Scene" }
      ]);
      const content = createContent();
      content.rehostWindowContent(framePort.getContentHost(viewActor.id));
      return {
        frameActor,
        framePort,
        viewActor,
        content
      };
    }
  });

  const controller = new DefaultWindowFrameLifecycleController({
    actorSystem,
    factories: registry,
    actorWindowFocus: createFocusRecorder(focusCalls),
    cancelActiveInput: () => cancelCalls.push("cancel"),
    createFloatingFrame: options.createFloatingFrame ?? options.createFloatingFrameFactory?.(actorSystem)
  });

  return {
    actorSystem,
    cancelCalls,
    controller,
    focusCalls,
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

  it("activates an existing live tab when opening or requesting activation", () => {
    const subject = createSubject();

    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("debug", "menu");
    subject.controller.activateFrameTab("debug-frame-1", "debug-view-1", "tab-click");

    const liveView = subject.controller.getLiveViewByActorId("debug-view-1");
    const framePort = liveView?.framePort as ReturnType<typeof createFramePort>;
    expect(framePort.calls).toEqual([
      "activate:debug-view-1",
      "activate:debug-view-1"
    ]);
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

  it("runs the factory result disposer before falling back to actor destroy", () => {
    const actorSystem = new ActorSystem();
    const registry = new WindowViewFactoryRegistry();
    const calls: string[] = [];
    registry.register({
      viewKey: "debug",
      label: "Debug Log",
      create: () => {
        const frameActor = actorSystem.createActor({ id: "debug-frame" });
        const viewActor = actorSystem.createActor({ id: "debug-view", parent: frameActor });
        const framePort = createFramePort(frameActor.id, [
          { viewActorId: viewActor.id, viewKey: "debug", title: "Debug Log" }
        ]);
        const content = createContent();
        content.rehostWindowContent(framePort.getContentHost(viewActor.id));
        return {
          frameActor,
          framePort,
          viewActor,
          content,
          dispose: () => {
            calls.push("dispose-result");
            actorSystem.destroyActor(frameActor);
          }
        };
      }
    });
    const controller = new DefaultWindowFrameLifecycleController({
      actorSystem,
      factories: registry,
      cancelActiveInput: () => calls.push("cancel")
    });
    controller.openView("debug", "programmatic");

    controller.closeFrame("debug-frame", "close-button");

    expect(calls).toEqual(["cancel", "dispose-result"]);
    expect(actorSystem.getActor("debug-frame")).toBeNull();
    expect(actorSystem.getActor("debug-view")).toBeNull();
    expect(controller.listLiveViews()).toEqual([]);
  });

  it("validates a tab merge only when source view and target frame are live", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");

    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
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
      source,
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "target frame is source frame" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      source,
      targetFrameId: "missing-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "target frame is missing" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      source,
      targetFrameId: "empty-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "target frame has no live views" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      source,
      targetFrameId: "debug-frame-1",
      targetTabsetId: "missing-tabset",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "target frame is source frame" });
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
      source,
      bounds: { left: 10, top: 20, right: 210, bottom: 140, width: 200, height: 120 },
      reason: "dock-drop"
    })).toEqual({ valid: true });
    expect(subject.controller.validateDockCommit({
      kind: "float-tab",
      source,
      bounds: { left: 10, top: 20, right: 10, bottom: 140, width: 0, height: 120 },
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "floating bounds are invalid" });
  });

  it("commits a tab merge by rehosting content, moving the view actor, and destroying the empty source frame", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.focusCalls.length = 0;
    subject.cancelCalls.length = 0;

    const result = subject.controller.commitDock({
      kind: "merge-tabs",
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
    expect(targetPort?.listTabs().map((tab) => tab.viewActorId)).toEqual([
      "hierarchy-view",
      "debug-view-1"
    ]);
    expect(targetPort?.getActiveViewActorId()).toBe("debug-view-1");
    expect(debugContent?.currentWindowContentHost?.id).toBe("hierarchy-frame:host:debug-view-1");
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

  it("commits a split tab by rehosting content into the target tabset and destroying the empty source frame", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    subject.focusCalls.length = 0;
    subject.cancelCalls.length = 0;

    const result = subject.controller.commitDock({
      kind: "split-tab",
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
    const targetPort = hierarchyView?.framePort as ReturnType<typeof createFramePort> | undefined;
    const debugContent = debugView?.content as ReturnType<typeof createContent> | undefined;
    expect(result).toEqual({ committed: true, sourceFrameDestroyed: true });
    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.focusCalls).toEqual(["focus:hierarchy-frame:programmatic"]);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeNull();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("hierarchy-frame");
    expect(debugView?.frameActor.id).toBe("hierarchy-frame");
    expect(debugView?.framePort.frameId).toBe("hierarchy-frame");
    expect(targetPort?.calls).toContain("split:debug-view-1:frame-tabset:target:left");
    expect(targetPort?.listTabs().map((tab) => tab.viewActorId)).toEqual([
      "hierarchy-view",
      "debug-view-1"
    ]);
    expect(targetPort?.getActiveViewActorId()).toBe("debug-view-1");
    expect(debugContent?.currentWindowContentHost?.id).toBe("hierarchy-frame:host:debug-view-1");
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
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });
    subject.controller.commitDock({
      kind: "merge-tabs",
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

    expect(floatingCalls.filter((call) => call.includes(":persistent"))).toHaveLength(3);
  });

  it("rolls back a tab merge when content rehost throws", () => {
    const subject = createSubject();
    subject.controller.openView("debug", "programmatic");
    subject.controller.openView("hierarchy", "programmatic");
    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    const debugContent = debugView?.content as ReturnType<typeof createContent>;
    debugContent.throwOnRehost = true;
    subject.cancelCalls.length = 0;

    const result = subject.controller.commitDock({
      kind: "merge-tabs",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      targetFrameId: "hierarchy-frame",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    const sourcePort = debugView?.framePort;
    const targetPort = subject.controller.getLiveViewByActorId("hierarchy-view")?.framePort;
    expect(result).toEqual({ committed: false, reason: "rehost failed" });
    expect(subject.cancelCalls).toEqual(["cancel"]);
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeTruthy();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("debug-frame-1");
    expect(debugView?.frameActor.id).toBe("debug-frame-1");
    expect(sourcePort?.listTabs().map((tab) => tab.viewActorId)).toEqual(["debug-view-1"]);
    expect(targetPort?.listTabs().map((tab) => tab.viewActorId)).toEqual(["hierarchy-view"]);
    expect(debugContent.currentWindowContentHost?.id).toBe("debug-frame-1:host:debug-view-1");
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
    expect(debugView?.framePort.listTabs().map((tab) => tab.viewActorId)).toEqual(["debug-view-1"]);
    expect(targetPort?.listTabs().map((tab) => tab.viewActorId)).toEqual(["hierarchy-view"]);
    expect(debugContent.currentWindowContentHost?.id).toBe("debug-frame-1:host:debug-view-1");
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
    expect(floatingFrameCalls).toEqual(["create:debug-view-1:80:90:280:160:persistent"]);
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!))
      .toBe("floating-debug-view-1");
    expect(debugView?.frameActor.id).toBe("floating-debug-view-1");
    expect(debugView?.framePort.listTabs().map((tab) => tab.viewActorId)).toEqual(["debug-view-1"]);
    expect(debugContent?.currentWindowContentHost?.id).toBe("floating-debug-view-1:host:debug-view-1");
    expect(hierarchyView?.framePort.listTabs().map((tab) => tab.viewActorId)).toEqual(["hierarchy-view"]);
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
    const scenePort = sceneView?.framePort as ReturnType<typeof createFramePort> | undefined;
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
    expect(scenePort?.listTabs().map((tab) => tab.viewActorId)).toEqual(["scene-view", "debug-view-1"]);
    expect(scenePort?.getActiveViewActorId()).toBe("debug-view-1");
    expect(scenePort?.getFloatingBounds()).toMatchObject({ left: 30, top: 40, width: 500, height: 300 });
    expect(debugContent?.currentWindowContentHost?.id).toBe("scene-frame:host:debug-view-1");
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
    const scenePort = sceneView?.framePort as ReturnType<typeof createFramePort> | undefined;
    const runtimeRoot = scenePort?.getRuntimeDockRoot();
    expect(subject.actorSystem.getActor("hierarchy-frame")).toBeNull();
    expect(sceneView?.frameActor.id).toBe("scene-frame");
    expect(hierarchyView?.frameActor.id).toBe("scene-frame");
    expect(runtimeRoot).toMatchObject({
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

  it("isolates Scene into a temporary fullscreen frame when its owner has mixed tabs", () => {
    const floatingFrameCalls: string[] = [];
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, floatingFrameCalls)
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
      source: { frameId: "scene-frame", viewActorId: "scene-view", viewKey: "scene" },
      targetFrameId: "debug-frame-1",
      targetTabsetId: "frame-tabset:target",
      reason: "dock-drop"
    });

    subject.controller.enterViewFullscreen("scene-view", "programmatic");
    const liveScene = subject.controller.getLiveViewByActorId("scene-view");
    const liveDebug = subject.controller.getLiveViewByActorId("debug-view-1");

    expect(subject.cancelCalls).toEqual(["cancel", "cancel"]);
    expect(floatingFrameCalls).toEqual(["create:scene-view:0:0:0:0:runtime"]);
    expect(liveScene?.frameActor.id).toBe("floating-scene-view");
    expect(liveScene?.framePort.presentation).toBe("fullscreen");
    expect(liveScene?.framePort.visiblePath).toBeNull();
    expect(liveScene?.content.currentWindowContentHost?.id).toBe("floating-scene-view:host:scene-view");
    expect(liveDebug?.frameActor.id).toBe("debug-frame-1");
    expect(liveDebug?.framePort.listTabs().map((tab) => tab.viewActorId)).toEqual(["debug-view-1"]);
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
    expect(liveScene?.framePort.listTabs().map((tab) => tab.viewActorId)).toEqual(["debug-view-1", "scene-view"]);
    expect(liveScene?.content.currentWindowContentHost?.id).toBe("debug-frame-1:host:scene-view");
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

    expect(floatingCalls.filter((call) => call.includes(":runtime"))).toHaveLength(3);
    expect(floatingCalls.filter((call) => call.includes(":persistent"))).toHaveLength(3);
  });

  it("omits temporary fullscreen isolation frames from layout snapshots", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, [])
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
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
      createFloatingFrameFactory: (actorSystem) => ({ source, tab, runtimeOnly }) => {
        const frameActor = actorSystem.createActor({
          id: runtimeOnly ? `floating-${source.viewActorId}` : `fallback-${source.viewActorId}`
        });
        return {
          frameActor,
          framePort: createFramePort(frameActor.id, [tab], {
            visiblePath: runtimeOnly ? null : undefined
          })
        };
      }
    });
    subject.controller.openView("scene", "programmatic");
    subject.controller.openView("debug", "programmatic");
    subject.controller.commitDock({
      kind: "merge-tabs",
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
    expect(floatingFrameCalls).toEqual(["create:debug-view-1:10:20:300:160:persistent"]);
  });

  it("rolls back floating when content rehost throws and destroys the new frame", () => {
    const subject = createSubject({
      createFloatingFrameFactory: (actorSystem) => createFloatingFrameFactory(actorSystem, [])
    });
    subject.controller.openView("debug", "programmatic");
    const debugView = subject.controller.getLiveViewByActorId("debug-view-1");
    const debugContent = debugView?.content as ReturnType<typeof createContent>;
    debugContent.throwOnRehost = true;

    const result = subject.controller.commitDock({
      kind: "float-tab",
      source: {
        frameId: "debug-frame-1",
        viewActorId: "debug-view-1",
        viewKey: "debug"
      },
      bounds: { left: 10, top: 20, right: 310, bottom: 180, width: 300, height: 160 },
      reason: "dock-drop"
    });

    expect(result).toEqual({ committed: false, reason: "rehost failed" });
    expect(subject.actorSystem.getActor("floating-debug-view-1")).toBeNull();
    expect(subject.actorSystem.getActor("debug-frame-1")).toBeTruthy();
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!)).toBe("debug-frame-1");
    expect(debugView?.frameActor.id).toBe("debug-frame-1");
    expect(debugView?.framePort.listTabs().map((tab) => tab.viewActorId)).toEqual(["debug-view-1"]);
    expect(debugContent.currentWindowContentHost?.id).toBe("debug-frame-1:host:debug-view-1");
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
    expect(debugView?.framePort.listTabs().map((tab) => tab.viewActorId)).toEqual(["debug-view-1"]);
    expect(debugContent.currentWindowContentHost?.id).toBe("debug-frame-1:host:debug-view-1");
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

function createFramePort(
  frameId: string,
  initialTabs: readonly WindowFrameTab[] = [],
  options: { readonly visiblePath?: WindowFramePort["visiblePath"] } = {}
): WindowFramePort & { readonly calls: string[] } {
  const calls: string[] = [];
  let tabs = initialTabs.map((tab) => ({ ...tab }));
  let activeViewActorId = tabs[0]?.viewActorId ?? null;
  let runtimeRoot: WindowFrameRuntimeDockNode = {
    kind: "tabset",
    id: "frame-tabset:target",
    tabs: tabs.map((tab) => tab.viewActorId),
    activeViewActorId
  };
  let visible = true;
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
    get presentation() {
      return presentation;
    },
    listTabs: () => tabs.map((tab) => ({ ...tab })),
    getRuntimeDockRoot: () => cloneTestRuntimeDockRoot(runtimeRoot),
    restoreRuntimeDockRoot(root, options = {}) {
      calls.push(`restore:${root.id}:${options.activeViewActorId ?? "default"}`);
      const restoredTabs = options.tabs ?? [];
      tabs = restoredTabs.map((tab) => ({ ...tab }));
      activeViewActorId = options.activeViewActorId ?? tabs[0]?.viewActorId ?? null;
      runtimeRoot = activateTestRuntimeDockRoot(cloneTestRuntimeDockRoot(root), activeViewActorId);
    },
    listDockTargetTabsets: () => [{
      targetTabsetId: "frame-tabset:target",
      tabBounds: { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24 },
      contentBounds: { left: 0, top: 24, right: 100, bottom: 100, width: 100, height: 76 }
    }],
    getActiveViewActorId: () => activeViewActorId,
    isViewActiveInFrame: (viewActorId) => isViewActorIdActiveInTestRuntimeRoot(runtimeRoot, viewActorId),
    isViewVisibleInFrame: (viewActorId) => visible && isViewActorIdActiveInTestRuntimeRoot(runtimeRoot, viewActorId),
    addTab(tab, options = {}) {
      calls.push(`add:${tab.viewActorId}:${options.targetTabsetId ?? "default"}`);
      const index = tabs.findIndex((candidate) => candidate.viewActorId === tab.viewActorId);
      if (index >= 0) {
        tabs[index] = { ...tab };
      } else {
        tabs = [...tabs, { ...tab }];
      }
      if (options.active || !activeViewActorId) {
        activeViewActorId = tab.viewActorId;
      }
      runtimeRoot = createTestRuntimeTabsetRoot(tabs, activeViewActorId);
    },
    splitTab(tab, options) {
      calls.push(`split:${tab.viewActorId}:${options.targetTabsetId}:${options.placement}`);
      const index = tabs.findIndex((candidate) => candidate.viewActorId === tab.viewActorId);
      if (index >= 0) {
        tabs[index] = { ...tab };
      } else {
        tabs = [...tabs, { ...tab }];
      }
      if (options.active || !activeViewActorId) {
        activeViewActorId = tab.viewActorId;
      }
      runtimeRoot = createTestRuntimeTabsetRoot(tabs, activeViewActorId);
    },
    removeTab(viewActorId) {
      calls.push(`remove:${viewActorId}`);
      tabs = tabs.filter((tab) => tab.viewActorId !== viewActorId);
      if (activeViewActorId === viewActorId) {
        activeViewActorId = tabs[0]?.viewActorId ?? null;
      }
      runtimeRoot = removeViewActorIdFromTestRuntimeRoot(runtimeRoot, viewActorId) ??
        createTestRuntimeTabsetRoot(tabs, activeViewActorId);
    },
    activateTab(viewActorId) {
      calls.push(`activate:${viewActorId}`);
      if (tabs.some((tab) => tab.viewActorId === viewActorId)) {
        activeViewActorId = viewActorId;
        runtimeRoot = activateTestRuntimeDockRoot(runtimeRoot, viewActorId);
      }
    },
    hasTab: (viewActorId) => tabs.some((tab) => tab.viewActorId === viewActorId),
    hasTabset: (targetTabsetId) => targetTabsetId === "frame-tabset:target",
    getContentHost(viewActorId) {
      return createContentHost(`${frameId}:host:${viewActorId}`);
    },
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
    requestVisible(nextVisible) {
      calls.push(`visible:${nextVisible}`);
      visible = nextVisible;
    }
  };
}

function expectSnapshotTabset(node: unknown): WindowFrameTabsetNode {
  expect(node).toMatchObject({ kind: "tabset" });
  return node as WindowFrameTabsetNode;
}

function createFloatingFrameFactory(
  actorSystem: ActorSystem,
  calls: string[],
  options: { readonly parentNewFrameToView?: boolean } = {}
): WindowFloatingFrameFactory {
  return ({ source, tab, bounds, runtimeOnly }) => {
    calls.push(`create:${source.viewActorId}:${bounds.left}:${bounds.top}:${bounds.width}:${bounds.height}:${runtimeOnly ? "runtime" : "persistent"}`);
    const frameActor = actorSystem.createActor({
      id: `floating-${source.viewActorId}`,
      parent: options.parentNewFrameToView ? source.viewActorId : null
    });
    return {
      frameActor,
      framePort: createFramePort(frameActor.id, [tab], {
        visiblePath: runtimeOnly ? null : undefined
      })
    };
  };
}

function createTestRuntimeTabsetRoot(
  tabs: readonly WindowFrameTab[],
  activeViewActorId: string | null
): WindowFrameRuntimeDockNode {
  return {
    kind: "tabset",
    id: "frame-tabset:target",
    tabs: tabs.map((tab) => tab.viewActorId),
    activeViewActorId
  };
}

function cloneTestRuntimeDockRoot(root: WindowFrameRuntimeDockNode): WindowFrameRuntimeDockNode {
  if (root.kind === "tabset") {
    return {
      ...root,
      tabs: [...root.tabs]
    };
  }
  return {
    ...root,
    first: cloneTestRuntimeDockRoot(root.first),
    second: cloneTestRuntimeDockRoot(root.second)
  };
}

function activateTestRuntimeDockRoot(
  root: WindowFrameRuntimeDockNode,
  viewActorId: string | null
): WindowFrameRuntimeDockNode {
  if (!viewActorId) return root;
  if (root.kind === "tabset") {
    return root.tabs.includes(viewActorId)
      ? { ...root, activeViewActorId: viewActorId }
      : root;
  }
  if (containsTestRuntimeViewActorId(root.first, viewActorId)) {
    return {
      ...root,
      first: activateTestRuntimeDockRoot(root.first, viewActorId)
    };
  }
  if (containsTestRuntimeViewActorId(root.second, viewActorId)) {
    return {
      ...root,
      second: activateTestRuntimeDockRoot(root.second, viewActorId)
    };
  }
  return root;
}

function isViewActorIdActiveInTestRuntimeRoot(root: WindowFrameRuntimeDockNode, viewActorId: string): boolean {
  if (root.kind === "tabset") return root.activeViewActorId === viewActorId;
  return isViewActorIdActiveInTestRuntimeRoot(root.first, viewActorId) ||
    isViewActorIdActiveInTestRuntimeRoot(root.second, viewActorId);
}

function containsTestRuntimeViewActorId(root: WindowFrameRuntimeDockNode, viewActorId: string): boolean {
  if (root.kind === "tabset") return root.tabs.includes(viewActorId);
  return containsTestRuntimeViewActorId(root.first, viewActorId) ||
    containsTestRuntimeViewActorId(root.second, viewActorId);
}

function removeViewActorIdFromTestRuntimeRoot(
  root: WindowFrameRuntimeDockNode,
  viewActorId: string
): WindowFrameRuntimeDockNode | null {
  if (root.kind === "tabset") {
    if (!root.tabs.includes(viewActorId)) return root;
    const tabs = root.tabs.filter((tab) => tab !== viewActorId);
    if (tabs.length === 0) return null;
    return {
      ...root,
      tabs,
      activeViewActorId: root.activeViewActorId === viewActorId
        ? tabs[0] ?? null
        : root.activeViewActorId
    };
  }
  const first = removeViewActorIdFromTestRuntimeRoot(root.first, viewActorId);
  const second = removeViewActorIdFromTestRuntimeRoot(root.second, viewActorId);
  if (!first) return second;
  if (!second) return first;
  return {
    ...root,
    first,
    second
  };
}

function createContent(): WindowContentRehostable & {
  readonly calls: string[];
  throwOnRehost: boolean;
} {
  const calls: string[] = [];
  let currentWindowContentHost: WindowContentHost | null = null;
  return {
    calls,
    throwOnRehost: false,
    get currentWindowContentHost() {
      return currentWindowContentHost;
    },
    rehostWindowContent(host) {
      calls.push(`rehost:${host.id}`);
      if (this.throwOnRehost) {
        throw new Error("rehost failed");
      }
      currentWindowContentHost = host;
    },
    setWindowContentInteractable() {}
  };
}

function createContentHost(id: string): WindowContentHost {
  return {
    id,
    mountContent() {
      throw new Error("not used");
    },
    isContentInteractable: () => true
  };
}


import { describe, expect, it } from "vitest";
import { ActorSystem, type ActorWindowFocusService } from "../actor-runtime";
import { DefaultWindowFrameLifecycleController } from "./window-frame-lifecycle-controller";
import type {
  WindowContentHost,
  WindowContentRehostable,
  WindowFloatingFrameFactory,
  WindowFramePort,
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
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "target frame is source frame" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      source,
      targetFrameId: "missing-frame",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "target frame is missing" });
    expect(subject.controller.validateDockCommit({
      kind: "merge-tabs",
      source,
      targetFrameId: "empty-frame",
      reason: "dock-drop"
    })).toEqual({ valid: false, reason: "target frame has no live views" });
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
    expect(floatingFrameCalls).toEqual(["create:debug-view-1:80:90:280:160"]);
    expect(subject.actorSystem.getParentId(subject.actorSystem.getActor("debug-view-1")!))
      .toBe("floating-debug-view-1");
    expect(debugView?.frameActor.id).toBe("floating-debug-view-1");
    expect(debugView?.framePort.listTabs().map((tab) => tab.viewActorId)).toEqual(["debug-view-1"]);
    expect(debugContent?.currentWindowContentHost?.id).toBe("floating-debug-view-1:host:debug-view-1");
    expect(hierarchyView?.framePort.listTabs().map((tab) => tab.viewActorId)).toEqual(["hierarchy-view"]);
    expect(subject.actorSystem.getActor("hierarchy-frame")).toBeTruthy();
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
    expect(floatingFrameCalls).toEqual(["create:debug-view-1:10:20:300:160"]);
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
  initialTabs: readonly WindowFrameTab[] = []
): WindowFramePort & { readonly calls: string[] } {
  const calls: string[] = [];
  let tabs = initialTabs.map((tab) => ({ ...tab }));
  let activeViewActorId = tabs[0]?.viewActorId ?? null;
  return {
    frameId,
    calls,
    listTabs: () => tabs.map((tab) => ({ ...tab })),
    getActiveViewActorId: () => activeViewActorId,
    addTab(tab, options = {}) {
      calls.push(`add:${tab.viewActorId}`);
      const index = tabs.findIndex((candidate) => candidate.viewActorId === tab.viewActorId);
      if (index >= 0) {
        tabs[index] = { ...tab };
      } else {
        tabs = [...tabs, { ...tab }];
      }
      if (options.active || !activeViewActorId) {
        activeViewActorId = tab.viewActorId;
      }
    },
    removeTab(viewActorId) {
      calls.push(`remove:${viewActorId}`);
      tabs = tabs.filter((tab) => tab.viewActorId !== viewActorId);
      if (activeViewActorId === viewActorId) {
        activeViewActorId = tabs[0]?.viewActorId ?? null;
      }
    },
    activateTab(viewActorId) {
      calls.push(`activate:${viewActorId}`);
      if (tabs.some((tab) => tab.viewActorId === viewActorId)) {
        activeViewActorId = viewActorId;
      }
    },
    hasTab: (viewActorId) => tabs.some((tab) => tab.viewActorId === viewActorId),
    getContentHost(viewActorId) {
      return createContentHost(`${frameId}:host:${viewActorId}`);
    },
    getFloatingBounds: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
  };
}

function createFloatingFrameFactory(
  actorSystem: ActorSystem,
  calls: string[],
  options: { readonly parentNewFrameToView?: boolean } = {}
): WindowFloatingFrameFactory {
  return ({ source, tab, bounds }) => {
    calls.push(`create:${source.viewActorId}:${bounds.left}:${bounds.top}:${bounds.width}:${bounds.height}`);
    const frameActor = actorSystem.createActor({
      id: `floating-${source.viewActorId}`,
      parent: options.parentNewFrameToView ? source.viewActorId : null
    });
    return {
      frameActor,
      framePort: createFramePort(frameActor.id, [tab])
    };
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

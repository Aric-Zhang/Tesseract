import { describe, expect, it } from "vitest";
import { ActorSystem, type ActorWindowFocusService } from "../actor-runtime";
import { DefaultWindowFrameLifecycleController } from "./window-frame-lifecycle-controller";
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

function createSubject() {
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
      return { frameActor, viewActor };
    }
  });

  const controller = new DefaultWindowFrameLifecycleController({
    actorSystem,
    factories: registry,
    actorWindowFocus: createFocusRecorder(focusCalls),
    cancelActiveInput: () => cancelCalls.push("cancel")
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
    expect(subject.focusCalls).toEqual([
      "focus:debug-frame-1:menu-restore",
      "focus:debug-frame-1:menu-restore"
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
        return {
          frameActor,
          viewActor,
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

});

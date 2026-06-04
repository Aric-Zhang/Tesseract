import { describe, expect, it } from "vitest";
import type { Actor, ActorWindowFocusService } from "../actor-runtime";
import { ActorSystem } from "../actor-runtime";
import { createActorWindowFocusServiceProxy } from "./actor-window-focus-service";

function createRecordingService(calls: string[], priority = 123): ActorWindowFocusService {
  return {
    getEffectiveStackPriorityForActor(actor: Actor): number | null {
      calls.push(`priority:${actor.id}`);
      return priority;
    },
    focusActorWindow(actor, reason): void {
      calls.push(`focus:${actor.id}:${reason}`);
    },
    requestFocusOnVisible(actor, reason): void {
      calls.push(`pending:${actor.id}:${reason}`);
    }
  };
}

describe("ActorWindowFocusService proxy", () => {
  it("is a safe no-op before a service is bound", () => {
    const actor = new ActorSystem().createActor({ id: "window" });
    const proxy = createActorWindowFocusServiceProxy();

    expect(proxy.getEffectiveStackPriorityForActor(actor)).toBeNull();
    proxy.focusActorWindow(actor, "pointer-down");
    proxy.requestFocusOnVisible(actor, "menu-restore");
  });

  it("delegates to the currently bound service", () => {
    const actor = new ActorSystem().createActor({ id: "window" });
    const calls: string[] = [];
    const proxy = createActorWindowFocusServiceProxy();

    proxy.bind(createRecordingService(calls, 900));

    expect(proxy.getEffectiveStackPriorityForActor(actor)).toBe(900);
    proxy.focusActorWindow(actor, "pointer-down");
    proxy.requestFocusOnVisible(actor, "menu-restore");
    expect(calls).toEqual([
      "priority:window",
      "focus:window:pointer-down",
      "pending:window:menu-restore"
    ]);
  });

  it("can unbind and dispose without retaining the target service", () => {
    const actor = new ActorSystem().createActor({ id: "window" });
    const calls: string[] = [];
    const proxy = createActorWindowFocusServiceProxy();
    proxy.bind(createRecordingService(calls));

    proxy.unbind();
    expect(proxy.getEffectiveStackPriorityForActor(actor)).toBeNull();
    proxy.focusActorWindow(actor, "programmatic");
    expect(calls).toEqual([]);

    proxy.bind(createRecordingService(calls, 321));
    expect(proxy.getEffectiveStackPriorityForActor(actor)).toBe(321);
    proxy.dispose();
    expect(proxy.getEffectiveStackPriorityForActor(actor)).toBeNull();
    expect(calls).toEqual(["priority:window"]);
  });
});

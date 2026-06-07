import { describe, expect, it } from "vitest";
import type { Actor } from "../actor-runtime";
import { ActorSystem } from "../actor-runtime";
import type { ActorInputStackPrioritySource } from "../gizmo-runtime";
import type { WindowFocusCommandPort } from "./window-focus-command-port";
import { createWindowFocusServiceProxy } from "./window-focus-service-proxy";

function createRecordingService(
  calls: string[],
  priority = 123
): ActorInputStackPrioritySource & WindowFocusCommandPort {
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

describe("WindowFocusService proxy", () => {
  it("is a safe no-op before a service is bound", () => {
    const actor = new ActorSystem().createActor({ id: "window" });
    const proxy = createWindowFocusServiceProxy();

    expect(proxy.getEffectiveStackPriorityForActor(actor)).toBeNull();
    proxy.focusActorWindow(actor, "pointer-down");
    proxy.requestFocusOnVisible(actor, "menu-restore");
  });

  it("delegates to the currently bound service", () => {
    const actor = new ActorSystem().createActor({ id: "window" });
    const calls: string[] = [];
    const proxy = createWindowFocusServiceProxy();

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
    const proxy = createWindowFocusServiceProxy();
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

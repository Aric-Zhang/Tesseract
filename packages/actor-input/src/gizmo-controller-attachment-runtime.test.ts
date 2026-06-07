import { describe, expect, it } from "vitest";
import type { GizmoController, GizmoHit, ScreenPoint } from "gizmo-core";
import { ActorSystem } from "actor-core";
import type { Component } from "actor-core";
import { componentAttachmentKind } from "actor-core";
import {
  gizmoControllerAttachment,
  GizmoControllerAttachmentRuntime
} from "./gizmo-controller-attachment-runtime";

function createComponent(): Component & GizmoController {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "actor" });
  return {
    id: "gizmo",
    type: "gizmo",
    actor,
    enabled: true,
    priority: 10,
    hitTest(_point: ScreenPoint): GizmoHit | null {
      return null;
    }
  };
}

describe("GizmoControllerAttachmentRuntime", () => {
  it("registers components with the gizmo controller attachment", () => {
    const calls: string[] = [];
    const component = createComponent();
    const runtime = new GizmoControllerAttachmentRuntime({
      registry: {
        register(controller) {
          calls.push(`register:${controller.id}`);
          return {
            dispose() {
              calls.push(`dispose:${controller.id}`);
            }
          };
        },
        dispose() {
          calls.push("registry-dispose");
        }
      }
    });

    const registration = runtime.attach(component.actor, component, [gizmoControllerAttachment]);
    registration.dispose();

    expect(calls).toEqual(["register:gizmo", "dispose:gizmo"]);
  });

  it("ignores components without the gizmo controller attachment", () => {
    const calls: string[] = [];
    const component = createComponent();
    const runtime = new GizmoControllerAttachmentRuntime({
      registry: {
        register() {
          calls.push("register");
          return { dispose() {} };
        },
        dispose() {}
      }
    });

    runtime.attach(component.actor, component, [{
      kind: componentAttachmentKind("other")
    }]);

    expect(calls).toEqual([]);
  });

  it("requires attached components to implement GizmoController", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "actor" });
    const component: Component = {
      id: "not-gizmo",
      type: "not-gizmo",
      actor,
      enabled: true
    };
    const runtime = new GizmoControllerAttachmentRuntime({
      registry: {
        register() {
          throw new Error("should not register");
        },
        dispose() {}
      }
    });

    expect(() => runtime.attach(actor, component, [gizmoControllerAttachment])).toThrow(/GizmoController/);
  });
});



import { describe, expect, it } from "vitest";
import type { GizmoController, GizmoHit, ScreenPoint } from "gizmo-core";
import type { RuntimeObject, RuntimeRegistration, SceneStateObserver, SceneUpdateCommand } from "../../../scene-runtime";
import { AppRuntimeContext } from "../../../app-runtime";
import type { Camera3CommandSink } from "../../../camera3-control";
import { Camera3ProjectionModeController } from "../../../features/camera3/model";
import type { Camera3Gizmo, Camera3GizmoOptions } from "../camera3-gizmo";
import { createCamera3Gizmo } from "./camera3-gizmo-factory";

type FakeCamera3Gizmo = RuntimeObject & GizmoController & {
  update(): void;
  dispose(): void;
};

function createRegistration(label: string, calls: string[]): RuntimeRegistration {
  return {
    dispose() {
      calls.push(label);
    }
  };
}

function createContext(failAt?: "scene" | "gizmo") {
  const calls: string[] = [];
  const context = new AppRuntimeContext({
    sceneRuntime: {
      register(object: RuntimeObject): RuntimeRegistration {
        calls.push(`scene-register:${object.id}`);
        if (failAt === "scene") throw new Error("scene failed");
        return createRegistration("scene-dispose", calls);
      },
      dispose(): void {
        calls.push("scene-system-dispose");
      }
    },
    gizmoEventSystem: {
      register(object: GizmoController): RuntimeRegistration {
        calls.push(`gizmo-register:${object.id}`);
        if (failAt === "gizmo") throw new Error("gizmo failed");
        return createRegistration("gizmo-dispose", calls);
      },
      dispose(): void {
        calls.push("gizmo-system-dispose");
      }
    },
    frameStateController: {
      submit(_command: SceneUpdateCommand): void {
        calls.push("frame-submit");
      },
      subscribe(_observer: SceneStateObserver): RuntimeRegistration {
        calls.push("observer-subscribe");
        return createRegistration("observer-dispose", calls);
      },
      dispose(): void {
        calls.push("frame-system-dispose");
      }
    }
  });
  return { calls, context };
}

function createCommandSink(): Camera3CommandSink {
  return {
    submit() {
      // Test sink.
    }
  };
}

function createGizmoFactory(calls: string[]) {
  const receivedOptions: Camera3GizmoOptions[] = [];
  const createGizmo = (options: Camera3GizmoOptions): Camera3Gizmo => {
    receivedOptions.push(options);
    const object: FakeCamera3Gizmo = {
      id: "camera3-view-gizmo",
      priority: 100,
      hitTest(_point: ScreenPoint): GizmoHit | null {
        return null;
      },
      update(): void {
        calls.push("gizmo-update");
      },
      dispose(): void {
        calls.push("gizmo-object-dispose");
      }
    };
    return object as unknown as Camera3Gizmo;
  };
  return { createGizmo, receivedOptions };
}

describe("createCamera3Gizmo", () => {
  it("creates a gizmo with narrow dependencies and registers it through runtime context", () => {
    const { calls, context } = createContext();
    const { createGizmo, receivedOptions } = createGizmoFactory(calls);
    const projectionMode = new Camera3ProjectionModeController();
    const commandSink = createCommandSink();

    createCamera3Gizmo(context, {
      projectionMode,
      commandSink,
      parent: {} as HTMLElement
    }, createGizmo);

    expect(receivedOptions[0]?.projectionMode).toBe(projectionMode);
    expect(receivedOptions[0]?.commandSink).toBe(commandSink);
    expect("context" in (receivedOptions[0] as unknown as Record<string, unknown>)).toBe(false);
    expect(calls).toEqual([
      "scene-register:actor-system",
      "scene-register:camera3-view-gizmo",
      "gizmo-register:camera3-view-gizmo"
    ]);
  });

  it("disposes the created gizmo when registration fails", () => {
    const { calls, context } = createContext("gizmo");
    const { createGizmo } = createGizmoFactory(calls);

    expect(() => createCamera3Gizmo(context, {
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink(),
      parent: {} as HTMLElement
    }, createGizmo)).toThrow("gizmo failed");

    expect(calls).toEqual([
      "scene-register:actor-system",
      "scene-register:camera3-view-gizmo",
      "gizmo-register:camera3-view-gizmo",
      "scene-dispose",
      "gizmo-object-dispose"
    ]);
  });

  it("returns an idempotent handle that unregisters before disposing the gizmo", () => {
    const { calls, context } = createContext();
    const { createGizmo } = createGizmoFactory(calls);
    const handle = createCamera3Gizmo(context, {
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink(),
      parent: {} as HTMLElement
    }, createGizmo);
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(calls).toEqual([
      "gizmo-dispose",
      "scene-dispose",
      "gizmo-object-dispose"
    ]);
  });

  it("lets runtime context dispose a still-live tracked gizmo", () => {
    const { calls, context } = createContext();
    const { createGizmo } = createGizmoFactory(calls);
    createCamera3Gizmo(context, {
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink(),
      parent: {} as HTMLElement
    }, createGizmo);
    calls.length = 0;

    context.dispose();

    expect(calls).toEqual([
      "gizmo-dispose",
      "scene-dispose",
      "gizmo-object-dispose",
      "scene-dispose",
      "gizmo-system-dispose",
      "frame-system-dispose",
      "scene-system-dispose"
    ]);
  });
});

import { describe, expect, it } from "vitest";
import type { GizmoController, GizmoHit, ScreenPoint } from "gizmo-core";
import type {
  RuntimeObject,
  RuntimeRegistration,
  SceneStateObserver,
  SceneUpdateCommand
} from "../../scene-runtime";
import { AppRuntimeContext } from "../../app-runtime";
import { createDefaultDebugWindowState } from "../debug-window-parameters";
import type { DebugLogWindow, DebugLogWindowOptions } from "./debug-log-window";
import { createDebugLogWindow } from "./debug-log-window-factory";

type FakeDebugLogWindow = RuntimeObject & GizmoController & SceneStateObserver & {
  append(): void;
  dispose(): void;
};

type FailurePoint = "scene" | "gizmo" | "observer";

function createRegistration(label: string, calls: string[]): RuntimeRegistration {
  return {
    dispose() {
      calls.push(label);
    }
  };
}

function createSystems(failAt?: FailurePoint) {
  const calls: string[] = [];
  const frameStateController = {
    submit(_command: SceneUpdateCommand): void {
      calls.push("frame-submit");
    },
    subscribe(observer: SceneStateObserver): RuntimeRegistration {
      calls.push(`observer-subscribe:${(observer as unknown as RuntimeObject).id}`);
      if (failAt === "observer") throw new Error("observer failed");
      return createRegistration("observer-dispose", calls);
    },
    dispose(): void {
      calls.push("frame-system-dispose");
    }
  };
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
    frameStateController
  });
  return { calls, context, frameStateController };
}

function createWindowFactory(calls: string[], created: FakeDebugLogWindow[] = []) {
  const receivedOptions: DebugLogWindowOptions[] = [];
  const createWindow = (options: DebugLogWindowOptions): DebugLogWindow => {
    receivedOptions.push(options);
    const object: FakeDebugLogWindow = {
      id: "debug-log-window",
      priority: 1000,
      hitTest(_point: ScreenPoint): GizmoHit | null {
        return null;
      },
      onSceneStateChanged(): void {
        calls.push("window-state-change");
      },
      append(): void {
        calls.push("window-append");
      },
      dispose(): void {
        calls.push("window-dispose");
      }
    };
    created.push(object);
    return object as unknown as DebugLogWindow;
  };
  return { createWindow, receivedOptions };
}

describe("legacy createDebugLogWindow", () => {
  it("creates a window with narrow dependencies and registers it across all systems", () => {
    const { calls, context, frameStateController } = createSystems();
    const { createWindow, receivedOptions } = createWindowFactory(calls);

    createDebugLogWindow(context, {
      parent: {} as HTMLElement,
      initialState: createDefaultDebugWindowState()
    }, createWindow);

    expect(receivedOptions[0]?.commandSink).toBe(frameStateController);
    expect("context" in (receivedOptions[0] as unknown as Record<string, unknown>)).toBe(false);
    expect(calls).toEqual([
      "scene-register:actor-system",
      "scene-register:debug-log-window",
      "gizmo-register:debug-log-window",
      "observer-subscribe:debug-log-window"
    ]);
  });

  it("disposes the created window when registration fails", () => {
    const { calls, context } = createSystems("gizmo");
    const { createWindow } = createWindowFactory(calls);

    expect(() => createDebugLogWindow(context, {
      parent: {} as HTMLElement,
      initialState: createDefaultDebugWindowState()
    }, createWindow)).toThrow("gizmo failed");

    expect(calls).toEqual([
      "scene-register:actor-system",
      "scene-register:debug-log-window",
      "gizmo-register:debug-log-window",
      "scene-dispose",
      "window-dispose"
    ]);
  });

  it("returns an idempotent handle that unregisters before disposing the window", () => {
    const { calls, context } = createSystems();
    const { createWindow } = createWindowFactory(calls);
    const handle = createDebugLogWindow(context, {
      parent: {} as HTMLElement,
      initialState: createDefaultDebugWindowState()
    }, createWindow);
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(calls).toEqual([
      "observer-dispose",
      "gizmo-dispose",
      "scene-dispose",
      "window-dispose"
    ]);
  });

  it("lets runtime context dispose a still-live tracked window", () => {
    const { calls, context } = createSystems();
    const { createWindow } = createWindowFactory(calls);
    createDebugLogWindow(context, {
      parent: {} as HTMLElement,
      initialState: createDefaultDebugWindowState()
    }, createWindow);
    calls.length = 0;

    context.dispose();

    expect(calls).toEqual([
      "observer-dispose",
      "gizmo-dispose",
      "scene-dispose",
      "window-dispose",
      "scene-dispose",
      "gizmo-system-dispose",
      "frame-system-dispose",
      "scene-system-dispose"
    ]);
  });
});

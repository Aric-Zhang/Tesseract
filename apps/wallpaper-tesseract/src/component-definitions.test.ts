import { describe, expect, it } from "vitest";
import {
  gizmoEventBindingComponentDefinition,
  gizmoEventBindingComponentType,
  installActorInputComponentDefinitions
} from "actor-input";
import {
  debugLogContentComponentType,
  hierarchyPanelComponentType,
  camera3GizmoComponentType,
  installEditorComponentDefinitions,
  sceneModeToggleComponentType,
  sceneViewportComponentType,
  stateObserverBindingComponentType
} from "editor";
import {
  camera3MotionComponentType,
  installWallpaperRuntimeComponentDefinitions
} from "wallpaper-runtime";
import {
  installSceneComponentDefinitions,
  sceneCamera3ViewportBindingComponentType
} from "./features/scene/components";
import {
  floatingWindowComponentType,
  installWindowComponentDefinitions
} from "./window-runtime";
import { createTestComponentRegistry } from "./test-support";

function createRegistry() {
  return createTestComponentRegistry().registry;
}

describe("component definition installers", () => {
  it("installs gizmo runtime definitions explicitly", () => {
    const registry = createRegistry();

    installActorInputComponentDefinitions(registry);

    expect(registry.getDefinition(gizmoEventBindingComponentType).type).toBe(
      gizmoEventBindingComponentDefinition.type
    );
  });

  it("installs editor component definitions through the editor package", () => {
    const registry = createRegistry();

    installEditorComponentDefinitions(registry);

    expect(registry.getDefinition(stateObserverBindingComponentType).type).toBe(stateObserverBindingComponentType);
    expect(registry.getDefinition(sceneViewportComponentType).type).toBe(sceneViewportComponentType);
    expect(registry.getDefinition(sceneModeToggleComponentType).type).toBe(sceneModeToggleComponentType);
    expect(registry.getDefinition(camera3GizmoComponentType).type).toBe(camera3GizmoComponentType);
    expect(registry.getDefinition(debugLogContentComponentType).type).toBe(debugLogContentComponentType);
    expect(registry.getDefinition(hierarchyPanelComponentType).type).toBe(hierarchyPanelComponentType);
  });

  it("installs window component definitions explicitly", () => {
    const registry = createRegistry();

    installWindowComponentDefinitions(registry);

    expect(registry.getDefinition(floatingWindowComponentType).type).toBe(floatingWindowComponentType);
  });

  it("installs runtime component definitions explicitly", () => {
    const registry = createRegistry();

    installWallpaperRuntimeComponentDefinitions(registry);

    expect(registry.getDefinition(camera3MotionComponentType).type).toBe(camera3MotionComponentType);
  });

  it("installs runtime and scene definitions through separate owner paths", () => {
    const registry = createRegistry();

    installWallpaperRuntimeComponentDefinitions(registry);
    installSceneComponentDefinitions(registry);

    expect(registry.getDefinition(camera3MotionComponentType).type).toBe(camera3MotionComponentType);
    expect(registry.getDefinition(sceneCamera3ViewportBindingComponentType).type).toBe(
      sceneCamera3ViewportBindingComponentType
    );
    expect(() => registry.getDefinition(gizmoEventBindingComponentType)).toThrow(/is not registered/);
    expect(() => registry.getDefinition(stateObserverBindingComponentType)).toThrow(/is not registered/);
    expect(() => registry.getDefinition(floatingWindowComponentType)).toThrow(/is not registered/);
    expect(() => registry.getDefinition(camera3GizmoComponentType)).toThrow(/is not registered/);
  });

  it("allows repeated installation of the same runtime binding definitions", () => {
    const registry = createRegistry();

    installActorInputComponentDefinitions(registry);
    installActorInputComponentDefinitions(registry);

    expect(registry.getDefinition(gizmoEventBindingComponentType).type).toBe(
      gizmoEventBindingComponentDefinition.type
    );
  });

  it("allows repeated installation of the same window definitions", () => {
    const registry = createRegistry();

    installWindowComponentDefinitions(registry);
    installWindowComponentDefinitions(registry);

    expect(registry.getDefinition(floatingWindowComponentType).type).toBe(floatingWindowComponentType);
  });

  it("allows repeated installation of the same editor definitions", () => {
    const registry = createRegistry();

    installEditorComponentDefinitions(registry);
    installEditorComponentDefinitions(registry);

    expect(registry.getDefinition(hierarchyPanelComponentType).type).toBe(hierarchyPanelComponentType);
  });

  it("does not install window definitions as runtime binding definitions", () => {
    const registry = createRegistry();

    installActorInputComponentDefinitions(registry);

    expect(() => registry.getDefinition(floatingWindowComponentType)).toThrow(/is not registered/);
  });

  it("throws when a component type is already installed with a different definition", () => {
    const registry = createRegistry();
    registry.registerDefinition({
      type: gizmoEventBindingComponentType,
      singleton: true,
      createId(actor) {
        return `${actor.id}:other-binding`;
      },
      create(actor) {
        return {
          id: `${actor.id}:other-binding`,
          type: gizmoEventBindingComponentType,
          actor,
          enabled: true
        };
      }
    });

    expect(() => installActorInputComponentDefinitions(registry)).toThrow(/different definition/);
  });
});

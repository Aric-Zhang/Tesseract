import { describe, expect, it } from "vitest";
import { installWallpaperComponentDefinitions } from "./app/install-component-definitions";
import {
  debugLogContentComponentType,
  hierarchyPanelComponentType,
  installDebugLogComponentDefinitions,
  installHierarchyComponentDefinitions,
  installSceneComponentDefinitions,
  sceneModeToggleComponentType,
  sceneViewportComponentType
} from "editor";
import {
  camera3GizmoComponentType,
  installCamera3ComponentDefinitions
} from "./gizmos/camera3/components";
import {
  gizmoEventBindingComponentDefinition,
  gizmoEventBindingComponentType,
  installGizmoRuntimeComponentDefinitions
} from "./gizmo-runtime";
import {
  installEditorStateObserverComponentDefinitions,
  stateObserverBindingComponentType
} from "editor";
import {
  tesseract4ComponentType,
  installTesseract4ComponentDefinitions
} from "./tesseract4/components";
import {
  floatingWindowComponentType,
  installWindowComponentDefinitions
} from "./window-runtime";
import { createTestComponentRegistry } from "./test-support";

function createRegistry() {
  return createTestComponentRegistry().registry;
}

describe("component definition installers", () => {
  it("installs gizmo and state runtime definitions explicitly", () => {
    const registry = createRegistry();

    installGizmoRuntimeComponentDefinitions(registry);
    installEditorStateObserverComponentDefinitions(registry);

    expect(registry.getDefinition(gizmoEventBindingComponentType).type).toBe(
      gizmoEventBindingComponentDefinition.type
    );
    expect(registry.getDefinition(stateObserverBindingComponentType).type).toBe(
      stateObserverBindingComponentType
    );
  });

  it("installs camera3 component definitions explicitly", () => {
    const registry = createRegistry();

    installCamera3ComponentDefinitions(registry);

    expect(registry.getDefinition(camera3GizmoComponentType).type).toBe(camera3GizmoComponentType);
  });

  it("installs debug component definitions explicitly", () => {
    const registry = createRegistry();

    installDebugLogComponentDefinitions(registry);

    expect(registry.getDefinition(debugLogContentComponentType).type).toBe(debugLogContentComponentType);
  });

  it("installs hierarchy component definitions explicitly", () => {
    const registry = createRegistry();

    installHierarchyComponentDefinitions(registry);

    expect(registry.getDefinition(hierarchyPanelComponentType).type).toBe(hierarchyPanelComponentType);
  });

  it("installs window component definitions explicitly", () => {
    const registry = createRegistry();

    installWindowComponentDefinitions(registry);

    expect(registry.getDefinition(floatingWindowComponentType).type).toBe(floatingWindowComponentType);
  });

  it("installs scene component definitions explicitly", () => {
    const registry = createRegistry();

    installSceneComponentDefinitions(registry);

    expect(registry.getDefinition(sceneViewportComponentType).type).toBe(sceneViewportComponentType);
    expect(registry.getDefinition(sceneModeToggleComponentType).type).toBe(sceneModeToggleComponentType);
  });

  it("installs tesseract4 component definitions explicitly", () => {
    const registry = createRegistry();

    installTesseract4ComponentDefinitions(registry);

    expect(registry.getDefinition(tesseract4ComponentType).type).toBe(tesseract4ComponentType);
  });

  it("installs the wallpaper app component definitions from app composition", () => {
    const registry = createRegistry();

    installWallpaperComponentDefinitions(registry);

    expect(registry.getDefinition(gizmoEventBindingComponentType).type).toBe(gizmoEventBindingComponentType);
    expect(registry.getDefinition(stateObserverBindingComponentType).type).toBe(stateObserverBindingComponentType);
    expect(registry.getDefinition(floatingWindowComponentType).type).toBe(floatingWindowComponentType);
    expect(registry.getDefinition(sceneViewportComponentType).type).toBe(sceneViewportComponentType);
    expect(registry.getDefinition(sceneModeToggleComponentType).type).toBe(sceneModeToggleComponentType);
    expect(registry.getDefinition(camera3GizmoComponentType).type).toBe(camera3GizmoComponentType);
    expect(registry.getDefinition(debugLogContentComponentType).type).toBe(debugLogContentComponentType);
    expect(registry.getDefinition(hierarchyPanelComponentType).type).toBe(hierarchyPanelComponentType);
    expect(registry.getDefinition(tesseract4ComponentType).type).toBe(tesseract4ComponentType);
  });

  it("allows repeated installation of the same runtime binding definitions", () => {
    const registry = createRegistry();

    installGizmoRuntimeComponentDefinitions(registry);
    installEditorStateObserverComponentDefinitions(registry);
    installGizmoRuntimeComponentDefinitions(registry);
    installEditorStateObserverComponentDefinitions(registry);

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

  it("allows repeated installation of the same hierarchy definitions", () => {
    const registry = createRegistry();

    installHierarchyComponentDefinitions(registry);
    installHierarchyComponentDefinitions(registry);

    expect(registry.getDefinition(hierarchyPanelComponentType).type).toBe(hierarchyPanelComponentType);
  });

  it("does not install window definitions as runtime binding definitions", () => {
    const registry = createRegistry();

    installGizmoRuntimeComponentDefinitions(registry);
    installEditorStateObserverComponentDefinitions(registry);

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

    expect(() => installGizmoRuntimeComponentDefinitions(registry)).toThrow(/different definition/);
  });
});

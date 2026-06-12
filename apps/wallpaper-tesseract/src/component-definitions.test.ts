import { describe, expect, it } from "vitest";
import { installWallpaperComponentDefinitions } from "./app/install-component-definitions";
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
  gizmoEventBindingComponentDefinition,
  gizmoEventBindingComponentType,
  installGizmoRuntimeComponentDefinitions
} from "./gizmo-runtime";
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
  it("installs gizmo runtime definitions explicitly", () => {
    const registry = createRegistry();

    installGizmoRuntimeComponentDefinitions(registry);

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
    installGizmoRuntimeComponentDefinitions(registry);

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

    installGizmoRuntimeComponentDefinitions(registry);

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

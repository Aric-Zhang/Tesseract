import { describe, expect, it } from "vitest";
import { ActorSystem, type Actor } from "../actor-runtime";
import { installGizmoRuntimeComponentDefinitions } from "../gizmo-runtime";
import { installStateRuntimeComponentDefinitions } from "../state-runtime";
import { createTestComponentRegistry } from "../test-support";
import {
  FloatingWindowComponent,
  floatingWindowComponentType,
  type FloatingWindowMenuOptions,
  type FloatingWindowPresentation
} from "./floating-window-component";
import { installWindowComponentDefinitions } from "./install-component-definitions";
import { uiLayoutPath, uiVec2, type FloatingWindowParameterPaths } from "ui-framework";
import type { WindowFramePort } from "./window-frame-port";
import { WindowFramePortRegistry } from "./window-frame-port-registry";
import { WindowViewFactoryRegistry } from "./window-view-factory-registry";
import { createWindowWorkspaceViewCatalog } from "./window-workspace-view-catalog";
import {
  WINDOW_FLOATING_FOCUS_LAYER_START,
  WindowWorkspaceController
} from "./window-workspace-controller";
import { createWindowWorkspaceStackPriorityPort } from "./window-workspace-stack-priority-port";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  className = "";
  textContent = "";
  hidden = false;
  type = "";
  tabIndex = 0;
  ariaLabel = "";
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return {
      x: 0,
      y: 0,
      width: 320,
      height: 180,
      left: 0,
      top: 0,
      right: 320,
      bottom: 180,
      toJSON() {
        return this;
      }
    };
  }
}

interface WindowFixture {
  readonly actor: Actor;
  readonly component: FloatingWindowComponent;
  readonly parent: FakeElement;
  readonly paths: FloatingWindowParameterPaths;
}

interface CreateWorkspaceOptions {
  readonly windows: readonly CreateWindowOptions[];
}

interface CreateWindowOptions {
  readonly actorId: string;
  readonly parentActor?: Actor;
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly priority: number;
  readonly presentation?: FloatingWindowPresentation;
  readonly windowMenu?: FloatingWindowMenuOptions;
}

function createWorkspace(options: CreateWorkspaceOptions) {
  const actorSystem = new ActorSystem();
  const document = new FakeDocument();
  const { registry } = createTestComponentRegistry({ actorSystem });
  installGizmoRuntimeComponentDefinitions(registry);
  installStateRuntimeComponentDefinitions(registry);
  installWindowComponentDefinitions(registry);
  const framePorts = new WindowFramePortRegistry();
  const windows: Record<string, WindowFixture> = {};
  for (const windowOptions of options.windows) {
    const actor = actorSystem.createActor({
      id: windowOptions.actorId,
      parent: windowOptions.parentActor,
      enabled: windowOptions.enabled
    });
    const parent = document.createElement("div");
    const paths = createPaths(windowOptions.actorId);
    const component = registry.addComponent(actor, floatingWindowComponentType, {
      id: `floating-window:${windowOptions.actorId}`,
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      title: windowOptions.actorId,
      paths,
      initialState: {
        position: uiVec2(12, 24),
        size: uiVec2(320, 180),
        visible: windowOptions.visible ?? true
      },
      priority: windowOptions.priority,
      presentation: windowOptions.presentation,
      windowMenu: windowOptions.windowMenu,
      framePortRegistry: framePorts
    });
    windows[windowOptions.actorId] = { actor, component, parent, paths };
  }
  const catalog = createWindowWorkspaceViewCatalog({
    actorSystem,
    factories: new WindowViewFactoryRegistry(),
    locations: createEmptyLocationSource(),
    framePorts
  });
  const controller = new WindowWorkspaceController({
    actorSystem,
    catalog,
    stackPriorityPort: createWindowWorkspaceStackPriorityPort(framePorts)
  });
  return { actorSystem, catalog, controller, document, framePorts, registry, windows };
}

function createPaths(prefix: string): FloatingWindowParameterPaths {
  return {
    position: uiLayoutPath(`${prefix}.position`),
    size: uiLayoutPath(`${prefix}.size`),
    visible: uiLayoutPath(`${prefix}.visible`)
  };
}

function priorityOf(fixture: WindowFixture): number {
  return fixture.component.inputStackPriority;
}

describe("WindowWorkspaceController", () => {
  it("assigns dense effective priorities from base priority and source order", () => {
    const { controller, windows } = createWorkspace({
      windows: [
        { actorId: "debug", priority: 1000 },
        { actorId: "scene", priority: 500 },
        { actorId: "hierarchy", priority: 1100 }
      ]
    });

    expect(controller.listStackEntries().map((entry) => entry.actorId)).toEqual([
      "scene",
      "debug",
      "hierarchy"
    ]);
    expect(priorityOf(windows.scene!)).toBe(WINDOW_FLOATING_FOCUS_LAYER_START);
    expect(priorityOf(windows.debug!)).toBe(WINDOW_FLOATING_FOCUS_LAYER_START + 1);
    expect(priorityOf(windows.hierarchy!)).toBe(WINDOW_FLOATING_FOCUS_LAYER_START + 2);
  });

  it("brings a visible window to front without priority drift", () => {
    const { controller, windows } = createWorkspace({
      windows: [
        { actorId: "scene", priority: 500 },
        { actorId: "debug", priority: 1000 },
        { actorId: "hierarchy", priority: 1100 }
      ]
    });

    controller.bringToFront(windows.debug!.actor);
    controller.bringToFront(windows.debug!.actor);

    expect(controller.listStackEntries().map((entry) => [entry.actorId, entry.effectivePriority])).toEqual([
      ["scene", WINDOW_FLOATING_FOCUS_LAYER_START],
      ["hierarchy", WINDOW_FLOATING_FOCUS_LAYER_START + 1],
      ["debug", WINDOW_FLOATING_FOCUS_LAYER_START + 2]
    ]);
  });

  it("excludes hidden, inactive, and fullscreen windows from dense stack priority", () => {
    const { controller, windows } = createWorkspace({
      windows: [
        { actorId: "visible", priority: 500 },
        { actorId: "hidden", priority: 900, visible: false },
        { actorId: "inactive", priority: 1000, enabled: false },
        { actorId: "fullscreen", priority: 1100, presentation: "fullscreen" }
      ]
    });

    expect(controller.getEffectivePriority("visible")).toBe(WINDOW_FLOATING_FOCUS_LAYER_START);
    expect(controller.getEffectivePriority("hidden")).toBeNull();
    expect(controller.getEffectivePriority("inactive")).toBeNull();
    expect(controller.getEffectivePriority("fullscreen")).toBeNull();
    expect(priorityOf(windows.hidden!)).toBe(900);
    expect(priorityOf(windows.inactive!)).toBe(1000);
    expect(priorityOf(windows.fullscreen!)).toBe(1100);
  });

  it("lets children of a fullscreen floating frame inherit its own input priority", () => {
    const { actorSystem, controller, windows } = createWorkspace({
      windows: [
        { actorId: "fullscreen", priority: 1100, presentation: "fullscreen" },
        { actorId: "scene", priority: 500 }
      ]
    });
    const fullscreenChild = actorSystem.createActor({
      id: "fullscreen-child",
      parent: windows.fullscreen!.actor
    });

    expect(controller.getEffectivePriority("fullscreen")).toBeNull();
    expect(controller.getEffectiveStackPriorityForActor(fullscreenChild)).toBe(
      windows.fullscreen!.component.inputStackPriority
    );
  });

  it("focuses a pending hidden restore only after it becomes visible", () => {
    const { controller, windows } = createWorkspace({
      windows: [
        { actorId: "scene", priority: 500 },
        { actorId: "debug", priority: 1000, visible: false },
        { actorId: "hierarchy", priority: 1100 }
      ]
    });

    controller.requestFocusOnVisible(windows.debug!.actor, "menu-restore");

    expect(controller.getEffectivePriority("debug")).toBeNull();
    windows.debug!.component.state.visible = true;
    controller.reconcile();

    expect(controller.listStackEntries().at(-1)?.actorId).toBe("debug");
    expect(controller.getEffectivePriority("debug")).toBe(WINDOW_FLOATING_FOCUS_LAYER_START + 2);
  });

  it("clears pending focus when the target is destroyed", () => {
    const workspace = createWorkspace({
      windows: [
        { actorId: "debug", priority: 1000, visible: false },
        { actorId: "diagnostics", priority: 1100, visible: false }
      ]
    });

    workspace.controller.requestFocusOnVisible(workspace.windows.debug!.actor, "menu-restore");
    workspace.actorSystem.destroyActor(workspace.windows.debug!.actor);
    workspace.controller.reconcile();
    workspace.controller.requestFocusOnVisible(workspace.windows.diagnostics!.actor, "menu-restore");
    workspace.windows.diagnostics!.component.state.visible = true;
    workspace.controller.reconcile();

    expect(workspace.controller.listStackEntries().map((entry) => entry.actorId)).toEqual(["diagnostics"]);
    expect(workspace.controller.getEffectivePriority("debug")).toBeNull();
    expect(workspace.controller.getEffectivePriority("diagnostics")).toBe(WINDOW_FLOATING_FOCUS_LAYER_START);
  });

  it("finds the nearest owning window actor through the parent chain", () => {
    const workspace = createWorkspace({
      windows: [
        { actorId: "scene", priority: 500 },
        { actorId: "debug", priority: 1000 }
      ]
    });
    const camera = workspace.actorSystem.createActor({
      id: "camera",
      parent: workspace.windows.scene!.actor
    });
    const cameraChild = workspace.actorSystem.createActor({
      id: "camera-child",
      parent: camera
    });

    expect(workspace.controller.findOwningWindowActor(cameraChild)?.id).toBe("scene");
    expect(workspace.controller.getEffectiveStackPriorityForActor(cameraChild)).toBe(
      WINDOW_FLOATING_FOCUS_LAYER_START
    );
  });

  it("inherits stack priority from a registered non-floating frame through the parent chain", () => {
    const actorSystem = new ActorSystem();
    const framePorts = new WindowFramePortRegistry();
    const rootFrame = actorSystem.createActor({ id: "workspace-root-frame" });
    const sceneView = actorSystem.createActor({ id: "scene-view", parent: rootFrame });
    const modeToggle = actorSystem.createActor({ id: "scene-mode-toggle", parent: sceneView });
    framePorts.register({
      frameActor: rootFrame,
      framePort: createFramePort("workspace-root-frame"),
      getStackPriority: () => 100,
      destroyWhenEmpty: false
    });
    const catalog = createWindowWorkspaceViewCatalog({
      actorSystem,
      factories: new WindowViewFactoryRegistry(),
      locations: createEmptyLocationSource(),
      framePorts
    });
    const controller = new WindowWorkspaceController({
      actorSystem,
      catalog,
      stackPriorityPort: createWindowWorkspaceStackPriorityPort(framePorts)
    });

    expect(controller.findOwningWindowActor(modeToggle)).toBeNull();
    expect(controller.getEffectiveStackPriorityForActor(modeToggle)).toBe(100);
    expect(controller.getEffectiveStackPriorityForActor(rootFrame)).toBe(100);
  });

  it("prunes destroyed windows and ignores mutations after dispose", () => {
    const { actorSystem, controller, windows } = createWorkspace({
      windows: [
        { actorId: "scene", priority: 500 },
        { actorId: "debug", priority: 1000 }
      ]
    });
    actorSystem.destroyActor(windows.debug!.actor);

    controller.reconcile();

    expect(controller.listStackEntries().map((entry) => entry.actorId)).toEqual(["scene"]);
    const scenePriority = priorityOf(windows.scene!);
    controller.dispose();
    controller.bringToFront(windows.scene!.actor);
    controller.reconcile();

    expect(priorityOf(windows.scene!)).toBe(scenePriority);
    expect(controller.listStackEntries()).toEqual([]);
  });
});

function createEmptyLocationSource() {
  return {
    listLocations: () => [],
    getLocationByViewKey: () => null,
    getLocationByViewActorId: () => null
  };
}

function createFramePort(frameId: string): WindowFramePort {
  return {
    frameId,
    visiblePath: null,
    visible: true,
    effectiveVisible: true,
    persistable: true,
    presentationSuppressed: false,
    presentation: "windowed",
    getFloatingBounds: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    restoreFloatingState() {},
    setPresentation() {},
    setPresentationSuppressed() {},
    requestVisible() {}
  };
}




import { describe, expect, it } from "vitest";
import { ActorSystem, type Actor } from "../actor-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import { parameterPath, vec2 } from "../scene-runtime";
import { createTestComponentRegistry } from "../test-support";
import { floatingWindowComponentType, type FloatingWindowMenuOptions } from "./floating-window-component";
import { installWindowComponentDefinitions } from "./install-component-definitions";
import type { FloatingWindowParameterPaths } from "./floating-window-state";
import { createWindowControlSource } from "./window-control-source";

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

interface WindowFixtureOptions {
  readonly actorId: string;
  readonly name?: string;
  readonly title?: string;
  readonly parentActor?: Actor;
  readonly actorEnabled?: boolean;
  readonly visible?: boolean;
  readonly priority?: number;
  readonly windowMenu?: FloatingWindowMenuOptions;
}

function createPaths(prefix: string): FloatingWindowParameterPaths {
  return {
    position: parameterPath(`${prefix}.position`),
    size: parameterPath(`${prefix}.size`),
    visible: parameterPath(`${prefix}.visible`)
  };
}

function createWindowFixture(
  actorSystem: ActorSystem,
  document: FakeDocument,
  options: WindowFixtureOptions
): FloatingWindowParameterPaths {
  const { registry } = createTestComponentRegistry({ actorSystem });
  installCoreComponentDefinitions(registry);
  installWindowComponentDefinitions(registry);
  const actor = actorSystem.createActor({
    id: options.actorId,
    name: options.name ?? options.title ?? options.actorId,
    enabled: options.actorEnabled,
    parent: options.parentActor
  });
  const parent = document.createElement("div");
  const paths = createPaths(options.actorId);
  registry.addComponent(actor, floatingWindowComponentType, {
    id: `floating-window:${options.actorId}`,
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    title: options.title ?? actor.name,
    paths,
    initialState: {
      position: vec2(12, 24),
      size: vec2(320, 180),
      visible: options.visible ?? true
    },
    priority: options.priority,
    windowMenu: options.windowMenu
  });
  return paths;
}

describe("WindowControlSource", () => {
  it("discovers included floating windows from actors and exposes their visible paths", () => {
    const actorSystem = new ActorSystem();
    const document = new FakeDocument();
    const debugPaths = createWindowFixture(actorSystem, document, {
      actorId: "debug-log-window",
      title: "Debug Log",
      priority: 1000
    });
    const scenePaths = createWindowFixture(actorSystem, document, {
      actorId: "scene-window",
      title: "Scene",
      priority: 500,
      windowMenu: { label: "Scene", order: 0 }
    });
    createWindowFixture(actorSystem, document, {
      actorId: "internal-window",
      title: "Internal",
      priority: 900,
      windowMenu: { include: false, activationMode: "none" }
    });
    const hierarchyPaths = createWindowFixture(actorSystem, document, {
      actorId: "hierarchy-panel",
      title: "Hierarchy",
      priority: 1100,
      windowMenu: { label: "Hierarchy Panel", order: 10, group: "tools" }
    });
    const source = createWindowControlSource({ actorSystem });

    expect(source.listWindows().map((item) => ({
      actorId: item.actorId,
      componentId: item.componentId,
      label: item.label,
      order: item.order,
      group: item.group,
      visible: item.visible,
      activeSelf: item.activeSelf,
      activeInHierarchy: item.activeInHierarchy,
      activationMode: item.activationMode,
      canToggle: item.canToggle
    }))).toEqual([
      {
        actorId: "scene-window",
        componentId: "floating-window:scene-window",
        label: "Scene",
        order: 0,
        group: null,
        visible: true,
        activeSelf: true,
        activeInHierarchy: true,
        activationMode: "visible",
        canToggle: true
      },
      {
        actorId: "hierarchy-panel",
        componentId: "floating-window:hierarchy-panel",
        label: "Hierarchy Panel",
        order: 10,
        group: "tools",
        visible: true,
        activeSelf: true,
        activeInHierarchy: true,
        activationMode: "visible",
        canToggle: true
      },
      {
        actorId: "debug-log-window",
        componentId: "floating-window:debug-log-window",
        label: "Debug Log",
        order: 1000,
        group: null,
        visible: true,
        activeSelf: true,
        activeInHierarchy: true,
        activationMode: "visible",
        canToggle: true
      }
    ]);
    expect(source.findWindowByVisiblePath(scenePaths.visible)?.actorId).toBe("scene-window");
    expect(source.findWindowByVisiblePath(debugPaths.visible)?.actorId).toBe("debug-log-window");
    expect(source.findWindowByVisiblePath(hierarchyPaths.visible)?.actorId).toBe("hierarchy-panel");
    expect(source.findWindowByVisiblePath(createPaths("unknown").visible)).toBeNull();
  });

  it("reports hidden and inherited inactive state without removing the window item", () => {
    const actorSystem = new ActorSystem();
    const document = new FakeDocument();
    const parentActor = actorSystem.createActor({ id: "tools", enabled: false });
    createWindowFixture(actorSystem, document, {
      actorId: "debug-log-window",
      title: "Debug Log",
      parentActor,
      visible: false
    });
    const source = createWindowControlSource({ actorSystem });

    expect(source.listWindows()).toHaveLength(1);
    expect(source.listWindows()[0]).toMatchObject({
      actorId: "debug-log-window",
      visible: false,
      activeSelf: true,
      activeInHierarchy: false
    });
  });

  it("exposes included activation-none windows as disabled menu items", () => {
    const actorSystem = new ActorSystem();
    const document = new FakeDocument();
    createWindowFixture(actorSystem, document, {
      actorId: "diagnostics-window",
      title: "Diagnostics",
      windowMenu: {
        include: true,
        activationMode: "none",
        label: "Diagnostics",
        order: 20
      }
    });
    const source = createWindowControlSource({ actorSystem });

    expect(source.listWindows()).toHaveLength(1);
    expect(source.listWindows()[0]).toMatchObject({
      actorId: "diagnostics-window",
      label: "Diagnostics",
      activationMode: "none",
      canToggle: false,
      visible: true
    });
  });
});

import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "../actor-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import { parameterPath, vec2 } from "../scene-runtime";
import { createDockTargetRegionSource } from "./dock-target-region-source";
import { floatingWindowComponentType } from "./floating-window-component";
import { installWindowComponentDefinitions } from "./install-component-definitions";
import type { WindowFramePort } from "./window-frame-port";
import { WindowFramePortRegistry } from "./window-frame-port-registry";

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
  rect: DOMRectReadOnly = createRect(0, 0, 320, 180);

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) {
      this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return this.rect;
  }
}

function createRect(x: number, y: number, width: number, height: number): DOMRectReadOnly {
  return {
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return this;
    }
  };
}

function createRegistry(actorSystem: ActorSystem): ComponentRegistry {
  const registry = new ComponentRegistry({ actorSystem });
  installCoreComponentDefinitions(registry);
  installWindowComponentDefinitions(registry);
  return registry;
}

describe("DockTargetRegionSource", () => {
  it("lists registered non-floating frame ports, including empty root-like targets", () => {
    const actorSystem = new ActorSystem();
    const frameActor = actorSystem.createActor({ id: "workspace-root-frame" });
    const framePorts = new WindowFramePortRegistry();
    framePorts.register({
      frameActor,
      framePort: createFramePort("workspace-root-frame", createRect(0, 24, 1024, 720)),
      getStackPriority: () => 100
    });
    const source = createDockTargetRegionSource({ actorSystem, framePorts });

    expect(source.listDockTargetRegions()).toEqual([{
      frameId: "workspace-root-frame",
      targetTabsetId: "workspace-root-frame:tabset",
      stackPriority: 100,
      bounds: {
        left: 0,
        top: 24,
        right: 1024,
        bottom: 744,
        width: 1024,
        height: 720
      },
      tabBounds: {
        left: 0,
        top: 24,
        right: 1024,
        bottom: 48,
        width: 1024,
        height: 24
      },
      contentBounds: {
        left: 0,
        top: 48,
        right: 1024,
        bottom: 744,
        width: 1024,
        height: 696
      }
    }]);
  });

  it("lists each floating frame region once even when the frame has multiple tabs", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const frameActor = actorSystem.createActor({ id: "merged-frame" });
    const component = registry.addComponent(frameActor, floatingWindowComponentType, {
      id: "floating-window:merged",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      title: "Debug",
      paths: {
        position: parameterPath("merged.position"),
        size: parameterPath("merged.size"),
        visible: parameterPath("merged.visible")
      },
      initialState: {
        position: vec2(20, 30),
        size: vec2(420, 260),
        visible: true
      },
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ],
      activeViewActorId: "debug-view"
    });
    const root = parent.children[0];
    root.rect = createRect(20, 30, 420, 260);
    component.setEffectivePriority(1500);
    const targetTabsetId = component.getRuntimeDockRoot().id;
    const source = createDockTargetRegionSource({ actorSystem });

    const regions = source.listDockTargetRegions();

    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({
      frameId: "merged-frame",
      targetTabsetId,
      stackPriority: 1500,
      bounds: {
        left: 20,
        top: 30,
        width: 420,
        height: 260
      }
    });
  });

  it("lists each split pane tabset as a separate dock target region for the same frame", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const frameActor = actorSystem.createActor({ id: "split-frame" });
    const component = registry.addComponent(frameActor, floatingWindowComponentType, {
      id: "floating-window:split",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      title: "Hierarchy",
      paths: {
        position: parameterPath("split.position"),
        size: parameterPath("split.size"),
        visible: parameterPath("split.visible")
      },
      initialState: {
        position: vec2(20, 30),
        size: vec2(420, 260),
        visible: true
      },
      tabs: [
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ],
      activeViewActorId: "hierarchy-view"
    });
    component.splitTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      {
        targetTabsetId: component.listDockTargetTabsets()[0]?.targetTabsetId ?? "missing",
        placement: "left",
        active: true
      }
    );
    parent.children[0].rect = createRect(20, 30, 420, 260);
    const runtimeRoot = component.getRuntimeDockRoot();
    if (runtimeRoot.kind !== "split") throw new Error("Expected split runtime root.");
    const source = createDockTargetRegionSource({ actorSystem });

    const regions = source.listDockTargetRegions();

    expect(regions.map((region) => region.frameId)).toEqual(["split-frame", "split-frame"]);
    expect(regions.map((region) => region.targetTabsetId)).toEqual([
      runtimeRoot.first.id,
      runtimeRoot.second.id
    ]);
  });

  it("skips hidden and inactive frames", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const visibleFrame = actorSystem.createActor({ id: "visible-frame" });
    const hiddenFrame = actorSystem.createActor({ id: "hidden-frame" });
    const disabledFrame = actorSystem.createActor({ id: "disabled-frame" });
    disabledFrame.enabled = false;
    for (const [actor, visible] of [
      [visibleFrame, true],
      [hiddenFrame, false],
      [disabledFrame, true]
    ] as const) {
      registry.addComponent(actor, floatingWindowComponentType, {
        id: `floating-window:${actor.id}`,
        parent: parent as unknown as HTMLElement,
        document: document as unknown as Document,
        title: actor.id,
        paths: {
          position: parameterPath(`${actor.id}.position`),
          size: parameterPath(`${actor.id}.size`),
          visible: parameterPath(`${actor.id}.visible`)
        },
        initialState: {
          position: vec2(0, 0),
          size: vec2(320, 180),
          visible
        }
      });
    }
    const source = createDockTargetRegionSource({ actorSystem });

    expect(source.listDockTargetRegions().map((region) => region.frameId)).toEqual(["visible-frame"]);
  });
});

function createFramePort(frameId: string, bounds: DOMRectReadOnly): WindowFramePort {
  return {
    frameId,
    visiblePath: null,
    visible: true,
    effectiveVisible: true,
    presentationSuppressed: false,
    presentation: "windowed",
    listTabs: () => [],
    getRuntimeDockRoot: () => ({
      kind: "tabset",
      id: `${frameId}:tabset`,
      tabs: [],
      activeViewActorId: null
    }),
    restoreRuntimeDockRoot() {},
    listDockTargetTabsets: () => [{
      targetTabsetId: `${frameId}:tabset`,
      tabBounds: {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.top + 24,
        width: bounds.width,
        height: 24
      },
      contentBounds: {
        left: bounds.left,
        top: bounds.top + 24,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height - 24
      }
    }],
    getActiveViewActorId: () => null,
    isViewActiveInFrame: () => false,
    isViewVisibleInFrame: () => false,
    addTab() {},
    splitTab() {},
    removeTab() {},
    activateTab() {},
    hasTab: () => false,
    hasTabset: (targetTabsetId) => targetTabsetId === `${frameId}:tabset`,
    getContentHost: () => ({
      id: `${frameId}:host`,
      mountContent() {
        throw new Error("not used");
      },
      isContentInteractable: () => true
    }),
    getFloatingBounds: () => ({
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height
    }),
    restoreFloatingState() {},
    setPresentation() {},
    setPresentationSuppressed() {},
    requestVisible() {}
  };
}

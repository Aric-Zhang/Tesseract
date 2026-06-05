import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "../actor-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import { parameterPath, vec2 } from "../scene-runtime";
import { createDockTargetFrameSource } from "./dock-target-frame-source";
import { floatingWindowComponentType } from "./floating-window-component";
import { installWindowComponentDefinitions } from "./install-component-definitions";

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
  const registry = new ComponentRegistry({
    actorSystem,
    commandSink: { submit() {} }
  });
  installCoreComponentDefinitions(registry);
  installWindowComponentDefinitions(registry);
  return registry;
}

describe("DockTargetFrameSource", () => {
  it("lists each floating frame once even when the frame has multiple tabs", () => {
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
    const source = createDockTargetFrameSource({ actorSystem });

    const frames = source.listDockTargetFrames();

    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      frameId: "merged-frame",
      targetTabsetId: "frame-tabset:debug-view+hierarchy-view",
      stackPriority: 1500,
      bounds: {
        left: 20,
        top: 30,
        width: 420,
        height: 260
      }
    });
  });

  it("lists each split pane tabset as a separate dock target for the same frame", () => {
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
    const source = createDockTargetFrameSource({ actorSystem });

    const frames = source.listDockTargetFrames();

    expect(frames.map((frame) => frame.frameId)).toEqual(["split-frame", "split-frame"]);
    expect(frames.map((frame) => frame.targetTabsetId)).toEqual([
      "frame-tabset:debug-view",
      "frame-tabset:hierarchy-view"
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
    const source = createDockTargetFrameSource({ actorSystem });

    expect(source.listDockTargetFrames().map((frame) => frame.frameId)).toEqual(["visible-frame"]);
  });
});

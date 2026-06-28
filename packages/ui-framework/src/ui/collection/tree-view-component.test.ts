import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-core";
import { installActorInputComponentDefinitions } from "actor-input";
import {
  installUiComponentDefinitions,
  treeViewComponentType,
  treeViewItemComponentType,
  uiElementComponentType,
  type TreeViewActivation
} from "..";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly style: Record<string, string> & { setProperty: (name: string, value: string) => void };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: KeyboardEvent) => void>>();
  parentElement: FakeElement | null = null;
  className = "";
  textContent = "";
  hidden = false;
  tabIndex = -1;
  rect: DOMRectReadOnly = createRect(0, 0, 0, 0);

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
    this.style = {
      setProperty: (name: string, value: string) => {
        this.style[name] = value;
      }
    } as Record<string, string> & { setProperty: (name: string, value: string) => void };
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
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return this.rect;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchKey(key: string): void {
    const event = {
      key,
      preventDefault() {}
    } as KeyboardEvent;
    for (const listener of this.listeners.get("keydown") ?? []) {
      listener(event);
    }
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

describe("TreeViewComponent", () => {
  it("renders direct child item actors as private row DOM with descriptor depth", () => {
    const fixture = createFixture();
    const root = fixture.createTreeRoot();
    fixture.addItem("scene", { itemId: "scene", label: "Scene", order: 1 });
    fixture.addItem("camera", {
      itemId: "camera",
      label: "Camera3",
      parentItemId: "scene",
      selected: true,
      muted: true
    });

    root.tree.refreshItems();

    expect(root.element.children.map((child) => child.dataset.uiTreeItemId)).toEqual(["scene", "camera"]);
    expect(root.element.children[1]?.dataset.uiTreeDepth).toBe("2");
    expect(root.element.children[1]?.dataset.uiTreeSelected).toBe("true");
    expect(root.element.children[1]?.dataset.uiTreeMuted).toBe("true");
    expect(fixture.actorSystem.listChildren(root.actor).map((actor) => actor.id)).toEqual(["scene", "camera"]);
  });

  it("routes pointer and keyboard activation through the same generic sink", () => {
    const fixture = createFixture();
    const activations: TreeViewActivation[] = [];
    const root = fixture.createTreeRoot({
      activateTreeItem(activation) {
        activations.push(activation);
      }
    });
    fixture.addItem("scene", { itemId: "scene", label: "Scene" });
    root.tree.refreshItems();
    const row = root.element.children[0]!;
    row.rect = createRect(0, 0, 140, 20);

    const hit = root.tree.hitTestInput({ x: 12, y: 8 });
    root.tree.onInputEnd({
      hit: hit!,
      wasClick: true,
      buttons: 0,
      point: { x: 12, y: 8 },
      startPoint: { x: 12, y: 8 },
      pointerId: 1,
      pointerType: "mouse",
      totalDelta: { dx: 0, dy: 0 },
      gizmo: null as never,
      timeStamp: 1
    });
    row.dispatchKey("Enter");

    expect(hit?.partId).toBe("tree-row");
    expect(activations).toEqual([
      { itemActorId: "scene", itemId: "scene", inputKind: "pointer" },
      { itemActorId: "scene", itemId: "scene", inputKind: "keyboard" }
    ]);
  });

  it("removes stale private rows when item actors are destroyed", () => {
    const fixture = createFixture();
    const root = fixture.createTreeRoot();
    fixture.addItem("scene", { itemId: "scene", label: "Scene" });
    fixture.addItem("camera", { itemId: "camera", label: "Camera", parentItemId: "scene" });
    root.tree.refreshItems();

    fixture.actorSystem.destroyActor(fixture.actorSystem.getActor("scene")!);
    root.tree.refreshItems();

    expect(root.element.children.map((child) => child.dataset.uiTreeItemId)).toEqual(["camera"]);
    expect(fixture.actorSystem.listActors().map((actor) => actor.id)).toEqual(["tree", "camera"]);
  });

  it("keeps item descriptors immutable and rejects invalid scalar values", () => {
    const fixture = createFixture();
    const root = fixture.createTreeRoot();
    const item = fixture.addItem("scene", { itemId: "scene", label: "Scene", order: 1 });
    const descriptor = item.descriptor as { order: number; label: string };

    expect(() => {
      descriptor.order = 99;
    }).toThrow(TypeError);
    expect(() => {
      descriptor.label = "Changed";
    }).toThrow(TypeError);
    expect(item.descriptor).toMatchObject({ itemId: "scene", label: "Scene", order: 1 });
    expect(() => item.setDescriptor({ parentItemId: "" })).toThrow(/parentItemId/);
    expect(root.tree.type).toBe(treeViewComponentType);
  });
});

function createFixture(): {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly document: FakeDocument;
  readonly createTreeRoot: (sink?: { activateTreeItem(activation: TreeViewActivation): void }) => {
    readonly actor: ReturnType<ActorSystem["createActor"]>;
    readonly element: FakeElement;
    readonly tree: import("./tree-view-component").TreeViewComponent;
  };
  readonly addItem: (
    actorId: string,
    descriptor: Parameters<ComponentRegistry["addComponent"]>[2] extends never
      ? never
      : import("./collection-types").TreeViewItemDescriptor
  ) => import("./tree-view-item-component").TreeViewItemComponent;
} {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(componentRegistry);
  installUiComponentDefinitions(componentRegistry);
  const document = new FakeDocument();
  let rootActor: ReturnType<ActorSystem["createActor"]> | null = null;
  return {
    actorSystem,
    componentRegistry,
    document,
    createTreeRoot(sink) {
      const actor = actorSystem.createActor({ id: "tree" });
      rootActor = actor;
      const element = componentRegistry.addComponent(actor, uiElementComponentType, {
        document: document as unknown as Document
      }).element as unknown as FakeElement;
      const tree = componentRegistry.addComponent(actor, treeViewComponentType, {
        activationSink: sink
      });
      return { actor, element, tree };
    },
    addItem(actorId, descriptor) {
      if (!rootActor) throw new Error("createTreeRoot() must be called first.");
      const actor = actorSystem.createActor({ id: actorId, parent: rootActor });
      return componentRegistry.addComponent(actor, treeViewItemComponentType, {
        descriptor
      });
    }
  };
}

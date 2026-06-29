import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import {
  installUiComponentDefinitions,
  listViewComponentType,
  listViewItemComponentType,
  uiElementComponentType
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
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  parentElement: FakeElement | null = null;
  className = "";
  textContent = "";
  appendCallCount = 0;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
    this.appendCallCount += 1;
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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

describe("ListViewComponent", () => {
  it("renders direct child item actors as private row DOM", () => {
    const fixture = createFixture();
    const root = fixture.createListRoot();
    fixture.addItem("second", { itemId: "second", text: "Second", order: 2 });
    fixture.addItem("first", { itemId: "first", text: "First", order: 1, selected: true });

    root.list.refreshItems();

    expect(root.element.children.map((child) => child.dataset.uiListItemId)).toEqual(["first", "second"]);
    expect(root.element.children[0]?.textContent).toBe("First");
    expect(root.element.children[0]?.dataset.uiListSelected).toBe("true");
    expect(root.element.children[0]?.dataset.uiListItemActorId).toBe("first");
    expect(fixture.actorSystem.listChildren(root.actor).map((actor) => actor.id)).toEqual(["second", "first"]);
  });

  it("removes stale private rows when item actors are destroyed", () => {
    const fixture = createFixture();
    const root = fixture.createListRoot();
    fixture.addItem("one", { itemId: "one", text: "One" });
    fixture.addItem("two", { itemId: "two", text: "Two" });
    root.list.refreshItems();

    fixture.actorSystem.destroyActor(fixture.actorSystem.getActor("one")!);
    root.list.refreshItems();

    expect(root.element.children.map((child) => child.dataset.uiListItemId)).toEqual(["two"]);
    expect(fixture.actorSystem.listActors().map((actor) => actor.id)).toEqual(["list", "two"]);
  });

  it("skips DOM work when explicit refresh sees an unchanged signature", () => {
    const fixture = createFixture();
    const root = fixture.createListRoot();
    fixture.addItem("one", { itemId: "one", text: "One" });
    root.list.refreshItems();
    const appendCallCount = root.element.appendCallCount;

    root.list.refreshItems();

    expect(root.element.appendCallCount).toBe(appendCallCount);
  });

  it("restores list state it applied on dispose", () => {
    const fixture = createFixture();
    const root = fixture.createListRoot((element) => {
      element.className = "external";
      element.setAttribute("role", "presentation");
      element.dataset.uiListView = "external-list";
      element.dataset.uiListTextStyle = "external-style";
    });
    fixture.addItem("one", { itemId: "one", text: "One" });
    root.list.refreshItems();

    root.list.dispose();

    expect(root.element.className).toBe("external");
    expect(root.element.getAttribute("role")).toBe("presentation");
    expect(root.element.dataset.uiListView).toBe("external-list");
    expect(root.element.dataset.uiListTextStyle).toBe("external-style");
    expect(root.element.dataset.uiListTextWrap).toBeUndefined();
    expect(root.element.dataset.uiListRowCount).toBeUndefined();
    expect(root.element.children).toEqual([]);
  });

  it("removes role on dispose when the list component created it", () => {
    const fixture = createFixture();
    const root = fixture.createListRoot();

    root.list.dispose();

    expect(root.element.getAttribute("role")).toBeNull();
  });

  it("keeps descriptors immutable and rejects invalid scalar values", () => {
    const fixture = createFixture();
    fixture.createListRoot();
    const item = fixture.addItem("log", { itemId: "log", text: "", order: 1 });
    const descriptor = item.descriptor as { order: number; text: string };

    expect(() => {
      descriptor.order = 99;
    }).toThrow(TypeError);
    expect(() => {
      descriptor.text = "Changed";
    }).toThrow(TypeError);
    expect(item.descriptor).toMatchObject({ itemId: "log", text: "", order: 1 });
    expect(() => item.setDescriptor({ itemId: "" })).toThrow(/itemId/);
    expect(() => item.setDescriptor({ text: null as never })).toThrow(/text/);
  });

  it("does not import actor-input or implement participant hooks", () => {
    const source = readFileSync(new URL("./list-view-component.ts", import.meta.url), "utf8");
    const definitionSource = readFileSync(new URL("./list-view-definition.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/actor-input/);
    expect(source).not.toMatch(/ActorInputParticipant/);
    expect(source).not.toMatch(/hitTestInput/);
    expect(source).not.toMatch(/onInputEnd/);
    expect(source).not.toMatch(/FrameUpdateParticipant|updateFrame/);
    expect(definitionSource).not.toMatch(/frameUpdateAttachment|attachments/);
  });
});

function createFixture(): {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly document: FakeDocument;
  readonly createListRoot: (prepareElement?: (element: FakeElement) => void) => {
    readonly actor: ReturnType<ActorSystem["createActor"]>;
    readonly element: FakeElement;
    readonly list: import("./list-view-component").ListViewComponent;
  };
  readonly addItem: (
    actorId: string,
    descriptor: import("./collection-types").ListViewItemDescriptor
  ) => import("./list-view-item-component").ListViewItemComponent;
} {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installUiComponentDefinitions(componentRegistry);
  const document = new FakeDocument();
  let rootActor: ReturnType<ActorSystem["createActor"]> | null = null;
  return {
    actorSystem,
    componentRegistry,
    document,
    createListRoot(prepareElement) {
      const actor = actorSystem.createActor({ id: "list" });
      rootActor = actor;
      const element = componentRegistry.addComponent(actor, uiElementComponentType, {
        document: document as unknown as Document
      }).element as unknown as FakeElement;
      prepareElement?.(element);
      const list = componentRegistry.addComponent(actor, listViewComponentType, {
        textStyle: "mono",
        textWrap: "wrap"
      });
      return { actor, element, list };
    },
    addItem(actorId, descriptor) {
      if (!rootActor) throw new Error("createListRoot() must be called first.");
      const actor = actorSystem.createActor({ id: actorId, parent: rootActor });
      return componentRegistry.addComponent(actor, listViewItemComponentType, {
        descriptor
      });
    }
  };
}

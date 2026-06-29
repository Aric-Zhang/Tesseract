import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import { installActorUiComponentDefinitions } from "../../actor-ui";
import { installControlComponentDefinitions } from "../../controls";
import { installMenuComponentDefinitions } from "../../menu";
import { installThemeComponentDefinitions } from "../../theme";
import { scrollViewComponentType } from "../scroll";
import { uiElementComponentType } from "../element";
import { virtualListViewComponentType, type VirtualListDataSource, type VirtualListItemSnapshot } from "./index";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly #listeners = new Map<string, Set<() => void>>();
  parentElement: FakeElement | null = null;
  className = "";
  textContent = "";
  scrollLeft = 0;
  scrollTop = 0;
  clientWidth = 100;
  clientHeight = 40;
  scrollWidth = 100;
  scrollHeight = 40;
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

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatchEvent(type: string): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener();
    }
  }
}

class TestVirtualListSource implements VirtualListDataSource {
  revision = 0;
  items: VirtualListItemSnapshot[];

  constructor(count: number) {
    this.items = Array.from({ length: count }, (_, index) => ({
      key: `item-${index}`,
      text: `Item ${index}`
    }));
  }

  getItemCount(): number {
    return this.items.length;
  }

  getItem(index: number): VirtualListItemSnapshot {
    const item = this.items[index];
    if (!item) throw new Error(`Missing test item ${index}.`);
    return item;
  }

  replace(index: number, text: string): void {
    this.items[index] = {
      key: `item-${index}`,
      text
    };
    this.revision += 1;
  }
}

describe("VirtualListViewComponent", () => {
  it("renders only visible rows plus overscan from a large data source", () => {
    const fixture = createFixture();
    const source = new TestVirtualListSource(100);
    const root = fixture.createVirtualListRoot(source);
    const spacer = root.element.children[0]!;

    expect(root.element.dataset.uiVirtualListItemCount).toBe("100");
    expect(root.element.dataset.uiVirtualListFirstIndex).toBe("0");
    expect(root.element.dataset.uiVirtualListLastIndex).toBe("4");
    expect(root.element.dataset.uiVirtualListRowPoolSize).toBe("5");
    expect(spacer.children).toHaveLength(5);
    expect(spacer.children.map((row) => row.dataset.uiVirtualListKey)).toEqual([
      "item-0",
      "item-1",
      "item-2",
      "item-3",
      "item-4"
    ]);
    expect(spacer.style.height).toBe("1000px");
  });

  it("reuses the bounded row pool when scrolling changes the visible range", () => {
    const fixture = createFixture();
    const source = new TestVirtualListSource(100);
    const root = fixture.createVirtualListRoot(source);
    const spacer = root.element.children[0]!;
    const firstRows = [...spacer.children];

    root.element.scrollHeight = 1000;
    root.element.scrollTop = 300;
    root.element.dispatchEvent("scroll");

    expect(root.element.dataset.uiVirtualListFirstIndex).toBe("29");
    expect(root.element.dataset.uiVirtualListLastIndex).toBe("34");
    expect(root.element.dataset.uiVirtualListRowPoolSize).toBe("6");
    expect(spacer.children.slice(0, firstRows.length)).toEqual(firstRows);
    expect(spacer.children.map((row) => row.dataset.uiVirtualListIndex)).toEqual([
      "29",
      "30",
      "31",
      "32",
      "33",
      "34"
    ]);
    expect(root.element.dataset.uiScrollAtEnd).toBe("false");
  });

  it("does not rebind rows when source revision and visible range are unchanged", () => {
    const fixture = createFixture();
    const source = new TestVirtualListSource(100);
    const root = fixture.createVirtualListRoot(source);
    const spacer = root.element.children[0]!;
    const appendCallCount = spacer.appendCallCount;

    root.virtualList.refreshItems();

    expect(spacer.appendCallCount).toBe(appendCallCount);

    source.replace(0, "Changed");
    root.virtualList.refreshItems();

    expect(spacer.children[0]?.textContent).toBe("Changed");
  });

  it("restores state and removes private row pool on dispose", () => {
    const fixture = createFixture();
    const source = new TestVirtualListSource(10);
    const root = fixture.createVirtualListRoot(source, (element) => {
      element.className = "external";
      element.setAttribute("role", "presentation");
      element.dataset.uiVirtualListView = "external";
    });

    root.virtualList.dispose();

    expect(root.element.className).toBe("external ui-scroll-view");
    expect(root.element.getAttribute("role")).toBe("presentation");
    expect(root.element.dataset.uiVirtualListView).toBe("external");
    expect(root.element.dataset.uiVirtualListItemCount).toBeUndefined();
    expect(root.element.children).toEqual([]);
  });

  it("requires explicit UiElement and ScrollView dependencies", () => {
    const { actorSystem, componentRegistry } = createFixture();
    const actor = actorSystem.createActor({ id: "virtual-list" });

    expect(() => componentRegistry.addComponent(actor, virtualListViewComponentType, {
      source: new TestVirtualListSource(1)
    })).toThrow(/Required component is missing/);
  });

  it("does not import product or actor-input concepts", () => {
    const source = readFileSync(new URL("./virtual-list-view-component.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/actor-input|ActorInputParticipant|hitTestInput|onInputEnd/);
    expect(source).not.toMatch(/Debug|Hierarchy|WindowWorkspace|Scene|Camera3|Tesseract|wallpaper/);
  });
});

function createFixture(): {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly document: FakeDocument;
  readonly createVirtualListRoot: (
    source: VirtualListDataSource,
    prepareElement?: (element: FakeElement) => void
  ) => {
    readonly actor: ReturnType<ActorSystem["createActor"]>;
    readonly element: FakeElement;
    readonly virtualList: import("./virtual-list-view-component").VirtualListViewComponent;
  };
} {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installActorUiComponentDefinitions(componentRegistry);
  installControlComponentDefinitions(componentRegistry);
  installMenuComponentDefinitions(componentRegistry);
  installThemeComponentDefinitions(componentRegistry);
  const document = new FakeDocument();
  return {
    actorSystem,
    componentRegistry,
    document,
    createVirtualListRoot(source, prepareElement) {
      const actor = actorSystem.createActor({ id: "virtual-list" });
      const element = componentRegistry.addComponent(actor, uiElementComponentType, {
        document: document as unknown as Document
      }).element as unknown as FakeElement;
      element.clientHeight = 40;
      prepareElement?.(element);
      componentRegistry.addComponent(actor, scrollViewComponentType, {
        orientation: "vertical"
      });
      const virtualList = componentRegistry.addComponent(actor, virtualListViewComponentType, {
        source,
        rowHeightPx: 10,
        overscan: 1,
        textStyle: "mono"
      });
      return { actor, element, virtualList };
    }
  };
}

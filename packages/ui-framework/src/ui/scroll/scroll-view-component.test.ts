import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-core";
import {
  installUiComponentDefinitions,
  scrollViewComponentType,
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
  readonly style: Record<string, string> = {};
  className = "";
  hidden = false;
  scrollLeft = 0;
  scrollTop = 0;
  clientWidth = 100;
  clientHeight = 100;
  scrollWidth = 100;
  scrollHeight = 100;
  readonly #listeners = new Map<string, Set<() => void>>();

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  remove(): void {}

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

describe("ScrollViewComponent", () => {
  it("adds native scroll diagnostics to the same actor element", () => {
    const { actorSystem, componentRegistry, document } = createFixture();
    const actor = actorSystem.createActor({ id: "scroll" });
    const element = componentRegistry.addComponent(actor, uiElementComponentType, {
      document: document as unknown as Document
    }).element as unknown as FakeElement;

    const scroll = componentRegistry.addComponent(actor, scrollViewComponentType, {
      orientation: "vertical"
    });

    expect(scroll.element).toBe(element as unknown as HTMLElement);
    expect(element.className).toContain("ui-scroll-view");
    expect(element.style.overflowY).toBe("auto");
    expect(element.style.overflowX).toBe("hidden");
    expect(element.dataset.uiScrollView).toBe("true");
    expect(element.dataset.uiScrollOrientation).toBe("vertical");
    expect(element.dataset.uiScrollAtStart).toBe("true");
    expect(element.dataset.uiScrollAtEnd).toBe("true");
  });

  it("restores only scroll state it applied on dispose", () => {
    const { actorSystem, componentRegistry, document } = createFixture();
    const actor = actorSystem.createActor({ id: "scroll" });
    const element = componentRegistry.addComponent(actor, uiElementComponentType, {
      document: document as unknown as Document
    }).element as unknown as FakeElement;
    element.className = "external";
    element.style.overflowX = "clip";
    element.style.overflowY = "scroll";
    element.dataset.uiScrollView = "external";
    const scroll = componentRegistry.addComponent(actor, scrollViewComponentType, {
      orientation: "both",
      className: "custom"
    });

    scroll.dispose();

    expect(element.className).toBe("external");
    expect(element.style.overflowX).toBe("clip");
    expect(element.style.overflowY).toBe("scroll");
    expect(element.dataset.uiScrollView).toBe("external");
  });

  it("preserves end position across synchronous content mutation", () => {
    const { actorSystem, componentRegistry, document } = createFixture();
    const actor = actorSystem.createActor({ id: "scroll" });
    const element = componentRegistry.addComponent(actor, uiElementComponentType, {
      document: document as unknown as Document
    }).element as unknown as FakeElement;
    element.clientHeight = 50;
    element.scrollHeight = 100;
    element.scrollTop = 49;
    const scroll = componentRegistry.addComponent(actor, scrollViewComponentType, {
      orientation: "vertical"
    });

    scroll.preserveEndOnMutation(() => {
      element.scrollHeight = 180;
    });

    expect(element.scrollTop).toBe(130);
    expect(element.dataset.uiScrollAtEnd).toBe("true");
  });

  it("keeps non-end scroll offsets stable across content mutation", () => {
    const { actorSystem, componentRegistry, document } = createFixture();
    const actor = actorSystem.createActor({ id: "scroll" });
    const element = componentRegistry.addComponent(actor, uiElementComponentType, {
      document: document as unknown as Document
    }).element as unknown as FakeElement;
    element.clientWidth = 30;
    element.clientHeight = 50;
    element.scrollWidth = 120;
    element.scrollHeight = 180;
    element.scrollLeft = 12;
    element.scrollTop = 20;
    const scroll = componentRegistry.addComponent(actor, scrollViewComponentType, {
      orientation: "both"
    });

    scroll.preserveEndOnMutation(() => {
      element.scrollWidth = 200;
      element.scrollHeight = 240;
    });

    expect(element.scrollLeft).toBe(12);
    expect(element.scrollTop).toBe(20);
    expect(element.dataset.uiScrollAtEnd).toBe("false");
  });

  it("updates scroll diagnostics when the user scrolls the element", () => {
    const { actorSystem, componentRegistry, document } = createFixture();
    const actor = actorSystem.createActor({ id: "scroll" });
    const element = componentRegistry.addComponent(actor, uiElementComponentType, {
      document: document as unknown as Document
    }).element as unknown as FakeElement;
    element.clientHeight = 50;
    element.scrollHeight = 120;
    element.scrollTop = 70;
    componentRegistry.addComponent(actor, scrollViewComponentType, {
      orientation: "vertical"
    });

    expect(element.dataset.uiScrollAtEnd).toBe("true");

    element.scrollTop = 20;
    element.dispatchEvent("scroll");

    expect(element.dataset.uiScrollAtStart).toBe("false");
    expect(element.dataset.uiScrollAtEnd).toBe("false");
  });

  it("does not swallow mutation errors", () => {
    const { actorSystem, componentRegistry, document } = createFixture();
    const actor = actorSystem.createActor({ id: "scroll" });
    const element = componentRegistry.addComponent(actor, uiElementComponentType, {
      document: document as unknown as Document
    }).element as unknown as FakeElement;
    const scroll = componentRegistry.addComponent(actor, scrollViewComponentType, {
      orientation: "vertical"
    });

    expect(() => scroll.preserveEndOnMutation(() => {
      throw new Error("boom");
    })).toThrow("boom");
    expect(element.dataset.uiScrollAtEnd).toBe("true");
  });

  it("fails through required UiElement dependency instead of creating hidden DOM", () => {
    const { actorSystem, componentRegistry } = createFixture();
    const actor = actorSystem.createActor({ id: "scroll" });

    expect(() => componentRegistry.addComponent(actor, scrollViewComponentType)).toThrow(
      /Required component is missing/
    );
  });
});

function createFixture(): {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly document: FakeDocument;
} {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installUiComponentDefinitions(componentRegistry);
  return {
    actorSystem,
    componentRegistry,
    document: new FakeDocument()
  };
}

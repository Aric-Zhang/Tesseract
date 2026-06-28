import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-core";
import { installUiComponentDefinitions } from "../install-ui-component-definitions";
import { uiElementComponentType } from "../element";
import {
  renderViewportComponentType,
  type RenderViewportResizeObserverFactory,
  type RenderViewportTarget
} from "./index";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly style: Record<string, string | undefined> = {};
  readonly children: FakeElement[] = [];
  readonly classList = {
    values: new Set<string>(),
    add: (...classNames: string[]) => {
      for (const className of classNames) {
        this.classList.values.add(className);
      }
    },
    contains: (className: string) => this.classList.values.has(className)
  };
  parentElement: FakeElement | null = null;
  hidden = false;
  rect = createRect(0, 0, 0, 0);

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

describe("RenderViewportComponent", () => {
  it("resizes a borrowed target without disposing it", () => {
    const fixture = createFixture();
    fixture.host.rect = createRect(0, 0, 320.9, 200.1);
    const target = createTarget(fixture.document);
    let pixelRatio = 1;

    const viewport = fixture.registry.addComponent(fixture.actor, renderViewportComponentType, {
      target,
      targetOwnership: "borrowed",
      devicePixelRatio: () => pixelRatio
    });

    expect(fixture.host.children).toEqual([target.element]);
    expect(target.setSizeCalls).toEqual([{ width: 320, height: 200, pixelRatio: 1 }]);
    expect(viewport.getSize()).toEqual({ width: 320, height: 200, pixelRatio: 1 });

    pixelRatio = 2;
    viewport.measureNow();

    expect(target.setSizeCalls.at(-1)).toEqual({ width: 320, height: 200, pixelRatio: 2 });

    viewport.dispose();
    viewport.dispose();

    expect(target.disposeCalls).toBe(0);
    expect(target.element.parentElement).toBeNull();
    expect(fixture.host.children).toEqual([]);
  });

  it("disposes an owned target exactly once", () => {
    const fixture = createFixture();
    fixture.host.rect = createRect(0, 0, 100, 80);
    const target = createTarget(fixture.document);

    const viewport = fixture.registry.addComponent(fixture.actor, renderViewportComponentType, {
      target,
      targetOwnership: "owned"
    });

    viewport.dispose();
    viewport.dispose();

    expect(target.disposeCalls).toBe(1);
  });

  it("notifies subscribers only for real size or pixel ratio changes", () => {
    const fixture = createFixture();
    const target = createTarget(fixture.document);
    const observed: unknown[] = [];
    fixture.host.rect = createRect(0, 0, 0, 0);
    let pixelRatio = 1;
    const viewport = fixture.registry.addComponent(fixture.actor, renderViewportComponentType, {
      target,
      devicePixelRatio: () => pixelRatio
    });
    viewport.subscribeResize((size) => observed.push(size));

    expect(target.setSizeCalls).toEqual([]);
    fixture.host.rect = createRect(0, 0, 10, 11);
    viewport.measureNow();
    viewport.measureNow();
    pixelRatio = 3;
    viewport.measureNow();

    expect(target.setSizeCalls).toEqual([
      { width: 10, height: 11, pixelRatio: 1 },
      { width: 10, height: 11, pixelRatio: 3 }
    ]);
    expect(observed).toEqual([
      { width: 10, height: 11, pixelRatio: 1 },
      { width: 10, height: 11, pixelRatio: 3 }
    ]);
  });

  it("disconnects resize observer and subscribers on dispose", () => {
    const fixture = createFixture();
    fixture.host.rect = createRect(0, 0, 20, 21);
    const observer = new FakeResizeObserver();
    const target = createTarget(fixture.document);
    const observed: unknown[] = [];

    const viewport = fixture.registry.addComponent(fixture.actor, renderViewportComponentType, {
      target,
      createResizeObserver: observer.factory
    });
    viewport.subscribeResize((size) => observed.push(size));

    fixture.host.rect = createRect(0, 0, 30, 31);
    observer.callback?.();
    viewport.dispose();
    fixture.host.rect = createRect(0, 0, 40, 41);
    observer.callback?.();

    expect(observer.observed).toEqual([fixture.host]);
    expect(observer.disconnectCalls).toBe(1);
    expect(target.setSizeCalls.at(-1)).toEqual({ width: 30, height: 31, pixelRatio: 1 });
    expect(observed).toEqual([{ width: 30, height: 31, pixelRatio: 1 }]);
  });

  it("fails through the required UI element dependency", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const actor = actorSystem.createActor({ id: "viewport" });
    const target = createTarget(new FakeDocument());

    expect(() => registry.addComponent(actor, renderViewportComponentType, { target })).toThrow(
      /Required component is missing/
    );
  });
});

function createFixture() {
  const actorSystem = new ActorSystem();
  const registry = createRegistry(actorSystem);
  const document = new FakeDocument();
  const actor = actorSystem.createActor({ id: "viewport" });
  const host = registry.addComponent(actor, uiElementComponentType, {
    element: document.createElement("section") as unknown as HTMLElement
  }).element as unknown as FakeElement;
  return { actorSystem, registry, document, actor, host };
}

function createRegistry(actorSystem: ActorSystem): ComponentRegistry {
  const registry = new ComponentRegistry({ actorSystem });
  installUiComponentDefinitions(registry);
  return registry;
}

function createTarget(document: FakeDocument): {
  readonly element: FakeElement;
  readonly setSizeCalls: Array<{ readonly width: number; readonly height: number; readonly pixelRatio: number }>;
  disposeCalls: number;
} & RenderViewportTarget {
  const element = document.createElement("canvas");
  const target = {
    element,
    domElement: element as unknown as HTMLElement,
    setSizeCalls: [] as Array<{ readonly width: number; readonly height: number; readonly pixelRatio: number }>,
    disposeCalls: 0,
    setSize(width: number, height: number, pixelRatio: number) {
      target.setSizeCalls.push({ width, height, pixelRatio });
    },
    dispose() {
      target.disposeCalls += 1;
    }
  };
  return target;
}

class FakeResizeObserver {
  observed: unknown[] = [];
  disconnectCalls = 0;
  callback: (() => void) | null = null;

  readonly factory: RenderViewportResizeObserverFactory = (callback) => {
    this.callback = callback;
    return {
      observe: (target) => {
        this.observed.push(target);
      },
      disconnect: () => {
        this.disconnectCalls += 1;
      }
    };
  };
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

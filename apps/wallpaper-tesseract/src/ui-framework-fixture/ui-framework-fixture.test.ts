import { describe, expect, it } from "vitest";
import {
  installUiFrameworkFixture
} from "./install-ui-framework-fixture";
import { WORKSPACE_ROOT_FRAME_ID, windowViewTypeKey } from "../window-runtime";
import { UiFixtureLayoutStorage } from "./fixture-state";

describe("ui-framework fixture", () => {
  it("installs a product-free root workspace, floating frame, and menu", () => {
    const { document, parent } = createFakeFixtureDom();

    const fixture = installUiFrameworkFixture({ parent, document });

    expect(fixture.rootFrameSlot.children.length).toBeGreaterThan(0);
    expect(fixture.floatingFrameParent.children.length).toBeGreaterThan(0);
    expect(fixture.menuSlot.textContent).toContain("Window");
    expect(fixture.actorSystem.listActors().map((actor) => actor.name)).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("Scene"),
        expect.stringContaining("Debug"),
        expect.stringContaining("Hierarchy"),
        expect.stringContaining("Camera"),
        expect.stringContaining("Tesseract")
      ])
    );

    fixture.dispose();
  });

  it("opens, focuses, and closes generic view instances by type and identity", () => {
    const { document, parent } = createFakeFixtureDom();
    const fixture = installUiFrameworkFixture({ parent, document });

    const firstPanel = fixture.workspace.lifecycle.openOrFocusViewType("fixture-panel", "programmatic", {
      preferredFrameId: WORKSPACE_ROOT_FRAME_ID
    });
    fixture.tick();
    const secondPanel = fixture.workspace.lifecycle.createViewInstance("fixture-panel", "programmatic", {
      preferredFrameId: WORKSPACE_ROOT_FRAME_ID
    });
    fixture.tick();

    expect(firstPanel?.typeKey).toBe("fixture-panel");
    expect(secondPanel?.typeKey).toBe("fixture-panel");
    expect(firstPanel?.instanceId).not.toBe(secondPanel?.instanceId);

    const livePanels = fixture.workspace.catalog.listViewEntries()
      .filter((view) => view.identity.typeKey === "fixture-panel" && view.live);
    expect(livePanels.map((view) => view.identity.instanceId).sort()).toEqual([
      "fixture-panel:alpha",
      "fixture-panel:beta"
    ]);

    const betaView = livePanels.find((view) => view.identity.instanceId === "fixture-panel:beta");
    expect(betaView?.viewActorId).toBeTruthy();
    const closeResult = fixture.workspace.lifecycle.closeView(betaView!.viewActorId!, "programmatic");
    fixture.tick();

    expect(closeResult.closed).toBe(true);
    const remainingPanels = fixture.workspace.catalog.listViewEntries()
      .filter((view) => view.identity.typeKey === "fixture-panel" && view.live);
    expect(remainingPanels.map((view) => view.identity.instanceId)).toEqual(["fixture-panel:alpha"]);

    const liveLog = fixture.workspace.catalog.listViewEntries()
      .find((view) => view.identity.typeKey === "fixture-log" && view.live);
    expect(liveLog?.viewActorId).toBeTruthy();
    expect(fixture.workspace.lifecycle.closeView(liveLog!.viewActorId!, "programmatic").closed).toBe(true);
    fixture.tick();
    expect(fixture.workspace.catalog.listViewEntries()
      .find((view) => view.identity.typeKey === "fixture-log" && view.live)
    ).toBeUndefined();

    const reopenedLog = fixture.workspace.lifecycle.openOrFocusViewType(
      windowViewTypeKey("fixture-log"),
      "programmatic"
    );
    fixture.tick();
    expect(reopenedLog?.instanceId).toBe("fixture-log:main");
    expect(fixture.workspace.catalog.listViewEntries()
      .find((view) => view.identity.instanceId === "fixture-log:main" && view.live)
    ).toBeDefined();

    fixture.dispose();
  });

  it("persists product-free logical view identities without actor ids", () => {
    const { document, parent } = createFakeFixtureDom();
    const fixture = installUiFrameworkFixture({ parent, document });

    fixture.tick();
    const stored = fixture.layoutStorage.getItem("wallpaper-tesseract.windowWorkspaceFrameLayout.v1");

    expect(stored).toBeTruthy();
    expect(stored).toContain("fixture-panel:alpha");
    expect(stored).toContain("fixture-log:main");
    expect(stored).not.toMatch(/ui-fixture-view:/);
    expect(stored).not.toMatch(/viewActorId|frameActorId|actorId/);

    fixture.dispose();
  });

  it("hydrates product-free logical view identities from persisted fixture storage", () => {
    const storage = new UiFixtureLayoutStorage();
    const firstDom = createFakeFixtureDom();
    const firstFixture = installUiFrameworkFixture({
      parent: firstDom.parent,
      document: firstDom.document,
      layoutStorage: storage
    });
    firstFixture.workspace.lifecycle.createViewInstance("fixture-panel", "programmatic", {
      preferredFrameId: WORKSPACE_ROOT_FRAME_ID
    });
    firstFixture.tick();
    firstFixture.dispose();

    const secondDom = createFakeFixtureDom();
    const secondFixture = installUiFrameworkFixture({
      parent: secondDom.parent,
      document: secondDom.document,
      layoutStorage: storage,
      autoOpen: false,
      autoTick: false
    });
    expect(secondFixture.workspace.restorePersistedLayout()).toBe(true);
    secondFixture.tick();

    const liveIdentities = secondFixture.workspace.catalog.listViewEntries()
      .filter((view) => view.live)
      .map((view) => `${view.identity.typeKey}/${view.identity.instanceId}`)
      .sort();

    expect(liveIdentities).toEqual([
      "fixture-log/fixture-log:main",
      "fixture-panel/fixture-panel:alpha",
      "fixture-panel/fixture-panel:beta"
    ]);
    expect(storage.getItem("wallpaper-tesseract.windowWorkspaceFrameLayout.v1")).not.toMatch(
      /viewActorId|frameActorId|actorId/
    );

    secondFixture.dispose();
  });
});

function createFakeFixtureDom(): { document: Document; parent: HTMLElement } {
  const document = new FakeDocument();
  return {
    document: document as unknown as Document,
    parent: document.body as unknown as HTMLElement
  };
}

class FakeDocument {
  readonly body: FakeElement;

  constructor() {
    this.body = new FakeElement(this, "body");
    this.body.rect = createRect(0, 0, 1280, 720);
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly style = Object.create(null) as CSSStyleDeclaration;
  readonly dataset = Object.create(null) as DOMStringMap;
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  className = "";
  hidden = false;
  type = "";
  tabIndex = 0;
  disabled = false;
  rect: DOMRectReadOnly = createRect(0, 0, 240, 32);
  #textContent = "";
  #attributes = new Map<string, string>();
  #listeners = new Map<string, EventListenerOrEventListenerObject[]>();

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
  }

  get textContent(): string {
    return `${this.#textContent}${this.children.map((child) => child.textContent).join("")}`;
  }

  set textContent(value: string | null) {
    this.#textContent = value ?? "";
    this.children.length = 0;
  }

  append(...children: (FakeElement | string)[]): void {
    for (const child of children) {
      if (typeof child === "string") {
        const textNode = new FakeElement(this.ownerDocument, "#text");
        textNode.textContent = child;
        this.append(textNode);
        continue;
      }
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: (FakeElement | string)[]): void {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children.length = 0;
    this.#textContent = "";
    this.append(...children);
  }

  remove(): void {
    const parent = this.parentElement;
    if (!parent) return;
    const index = parent.children.indexOf(this);
    if (index >= 0) {
      parent.children.splice(index, 1);
    }
    this.parentElement = null;
  }

  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.#attributes.delete(name);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.#listeners.get(type) ?? [];
    listeners.push(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
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
  } as DOMRectReadOnly;
}

import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import { installActorInputComponentDefinitions } from "actor-system/input";
import {
  installUiComponentDefinitions,
  menuBarComponentType,
  menuBarItemComponentType,
  menuItemComponentType,
  popupMenuComponentType,
  uiElementComponentType,
  uiLayoutHostComponentType,
  uiLayoutItemComponentType
} from "..";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  className = "";
  textContent = "";
  hidden = false;
  type = "";
  disabled = false;
  parentElement: FakeElement | null = null;
  rect: DOMRectReadOnly = createRect(0, 0, 0, 0);

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

  replaceChildren(...children: FakeElement[]): void {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children.length = 0;
    this.append(...children);
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

  removeAttribute(name: string): void {
    this.attributes.delete(name);
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

function createSubject() {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(componentRegistry);
  installUiComponentDefinitions(componentRegistry);
  const documentRef = new FakeDocument();
  return { actorSystem, componentRegistry, documentRef };
}

function addElement(
  componentRegistry: ComponentRegistry,
  actor: ReturnType<ActorSystem["createActor"]>,
  documentRef: FakeDocument,
  tagName: "div" | "button" = "div"
): FakeElement {
  return componentRegistry.addComponent(actor, uiElementComponentType, {
    tagName,
    document: documentRef as unknown as Document
  }).element as unknown as FakeElement;
}

function findRegion(root: FakeElement, region: string): FakeElement {
  const stack = [...root.children];
  while (stack.length > 0) {
    const next = stack.shift()!;
    if (next.dataset.uiLayoutRegion === region) return next;
    stack.push(...next.children);
  }
  throw new Error(`Expected layout region: ${region}`);
}

describe("menu layout fixture", () => {
  it("proves menu, fill, and overlay children are composed by UiLayoutHost", () => {
    const { actorSystem, componentRegistry, documentRef } = createSubject();
    const rootActor = actorSystem.createActor({ id: "root" });
    const menuActor = actorSystem.createActor({ id: "menu", parent: rootActor });
    const menuItemActor = actorSystem.createActor({ id: "menu-window", parent: menuActor });
    const popupActor = actorSystem.createActor({ id: "menu-window-popup", parent: menuItemActor });
    const popupItemActor = actorSystem.createActor({ id: "menu-window-scene", parent: popupActor });
    const fillActor = actorSystem.createActor({ id: "body", parent: rootActor });
    const overlayActor = actorSystem.createActor({ id: "overlay", parent: rootActor });
    const root = addElement(componentRegistry, rootActor, documentRef);
    const menuElement = addElement(componentRegistry, menuActor, documentRef);
    const fillElement = addElement(componentRegistry, fillActor, documentRef);
    const overlayElement = addElement(componentRegistry, overlayActor, documentRef);
    addElement(componentRegistry, menuItemActor, documentRef, "button");
    addElement(componentRegistry, popupActor, documentRef);
    const popupItemElement = addElement(componentRegistry, popupItemActor, documentRef, "button");

    const host = componentRegistry.addComponent(rootActor, uiLayoutHostComponentType, {});
    componentRegistry.addComponent(menuActor, uiLayoutItemComponentType, { slot: "top" });
    componentRegistry.addComponent(menuActor, menuBarComponentType, {});
    componentRegistry.addComponent(menuItemActor, menuBarItemComponentType, {
      descriptor: { id: "window", label: "Window" }
    });
    const popup = componentRegistry.addComponent(popupActor, popupMenuComponentType, {});
    componentRegistry.addComponent(popupItemActor, menuItemComponentType, {
      descriptor: { id: "scene", label: "Scene" }
    });
    componentRegistry.addComponent(fillActor, uiLayoutItemComponentType, { slot: "fill" });
    componentRegistry.addComponent(overlayActor, uiLayoutItemComponentType, { slot: "overlay", layer: 10 });

    const commit = host.refreshLayout();

    expect(commit.contributions.map((entry) => `${entry.actorId}:${entry.slot}`)).toEqual([
      "menu:top",
      "body:fill",
      "overlay:overlay"
    ]);
    expect(findRegion(root, "top").children[0].children).toContain(menuElement);
    expect(findRegion(root, "fill").children[0].children).toContain(fillElement);
    expect(findRegion(root, "overlay").children[0].children).toContain(overlayElement);

    popupItemElement.rect = createRect(0, 0, 100, 20);
    popup.setOpen(true);
    popup.hitTestInput({ x: 5, y: 5 });
    expect(popup.highlightedItemActorId).toBe("menu-window-scene");
    expect(popupItemElement.parentElement).toBe(popup.element);

    actorSystem.destroyActor(menuActor);
    const nextCommit = host.refreshLayout();

    expect(nextCommit.contributions.map((entry) => entry.actorId)).toEqual(["body", "overlay"]);
    expect(findRegion(root, "top").children).toEqual([]);
  });
});

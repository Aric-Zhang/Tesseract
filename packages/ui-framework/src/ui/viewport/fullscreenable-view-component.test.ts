import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import {
  actorInputScopeRoutePriority,
  getActorInputScopeRoutePriority,
  installActorInputComponentDefinitions
} from "actor-system/input";
import { installUiComponentDefinitions } from "../install-ui-component-definitions";
import { uiElementComponentType } from "../element";
import {
  type FullscreenableViewComponent,
  fullscreenableViewComponentType,
  type FullscreenableViewIntent
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
  parentElement: FakeElement | null = null;
  className = "";
  hidden = false;
  type = "";
  tabIndex = 0;
  ariaLabel: string | null = null;
  title = "";
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

describe("FullscreenableViewComponent", () => {
  it("emits source actor fullscreen and restore intents through actor input", () => {
    const fixture = createFixture();
    const intents: FullscreenableViewIntent[] = [];

    const component = fixture.registry.addComponent(fixture.actor, fullscreenableViewComponentType, {
      intentSink: {
        requestFullscreen: (intent: FullscreenableViewIntent) => intents.push(intent)
      },
      document: fixture.document as unknown as Document
    });
    const button = component.controlElement as unknown as FakeElement;
    button.rect = createRect(4, 5, 20, 21);

    const hit = component.hitTestInput({ x: 10, y: 10 })!;
    expect(hit.scopeRoutePriority).toBeUndefined();
    expect(getActorInputScopeRoutePriority(hit)).toBe(actorInputScopeRoutePriority.actorOverlay);
    component.onInputEnd(inputEndEvent(component, hit, true, 12));

    component.setFullscreen(true);
    component.onInputEnd(inputEndEvent(component, hit, true, 13));

    expect(intents).toEqual([
      {
        kind: "enter",
        sourceActorId: "view",
        componentId: "ui-fullscreenable-view",
        reason: "actor-system/input",
        timeStamp: 12
      },
      {
        kind: "restore",
        sourceActorId: "view",
        componentId: "ui-fullscreenable-view",
        reason: "actor-system/input",
        timeStamp: 13
      }
    ]);
  });

  it("does not emit intent for misses, non-click end events, or non-control hits", () => {
    const fixture = createFixture();
    const intents: FullscreenableViewIntent[] = [];

    const component = fixture.registry.addComponent(fixture.actor, fullscreenableViewComponentType, {
      intentSink: {
        requestFullscreen: (intent: FullscreenableViewIntent) => intents.push(intent)
      },
      document: fixture.document as unknown as Document
    });
    (component.controlElement as unknown as FakeElement).rect = createRect(4, 5, 20, 21);

    expect(component.hitTestInput({ x: 99, y: 99 })).toBeNull();
    component.onInputEnd(inputEndEvent(component, component.hitTestInput({ x: 10, y: 10 })!, false, 12));
    component.onInputEnd(inputEndEvent(component, {
        componentId: component.id,
        partId: "other",
        kind: "chrome",
        region: "actor-overlay",
        scopeRoutePriority: 0,
        localRoutePriority: 0,
        hitPriority: 0,
        path: []
      },
      true,
      13
    ));

    expect(intents).toEqual([]);
  });

  it("updates control state and removes only its control on dispose", () => {
    const fixture = createFixture();
    const component = fixture.registry.addComponent(fixture.actor, fullscreenableViewComponentType, {
      intentSink: {
        requestFullscreen() {}
      },
      initialFullscreen: true,
      document: fixture.document as unknown as Document
    });
    const button = component.controlElement as unknown as FakeElement;

    expect(button.dataset.uiFullscreenState).toBe("fullscreen");
    expect(button.ariaLabel).toBe("Restore view");

    component.setFullscreen(false);
    component.dispose();
    component.dispose();

    expect(button.dataset.uiFullscreenState).toBe("windowed");
    expect(fixture.host.children).toEqual([]);
    expect(component.enabled).toBe(false);
  });

  it("fails through required dependencies and required intent sink", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const actorWithoutElement = actorSystem.createActor({ id: "missing-element" });

    expect(() => registry.addComponent(actorWithoutElement, fullscreenableViewComponentType, {
      intentSink: {
        requestFullscreen() {}
      }
    })).toThrow(/Required component is missing/);

    const fixture = createFixture();
    expect(() => fixture.registry.addComponent(fixture.actor, fullscreenableViewComponentType)).toThrow(
      /requires an intent sink/
    );
  });
});

function createFixture() {
  const actorSystem = new ActorSystem();
  const registry = createRegistry(actorSystem);
  const document = new FakeDocument();
  const actor = actorSystem.createActor({ id: "view" });
  const host = registry.addComponent(actor, uiElementComponentType, {
    element: document.createElement("section") as unknown as HTMLElement
  }).element as unknown as FakeElement;
  return { actorSystem, registry, document, actor, host };
}

function createRegistry(actorSystem: ActorSystem): ComponentRegistry {
  const registry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(registry);
  installUiComponentDefinitions(registry);
  return registry;
}

function inputEndEvent(
  component: FullscreenableViewComponent,
  hit: ReturnType<FullscreenableViewComponent["hitTestInput"]> extends infer THit ? NonNullable<THit> : never,
  wasClick: boolean,
  timeStamp: number
): Parameters<FullscreenableViewComponent["onInputEnd"]>[0] {
  return {
    hit,
    wasClick,
    timeStamp
  } as unknown as Parameters<typeof component.onInputEnd>[0];
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

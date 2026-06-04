import { describe, expect, it } from "vitest";
import { ActorSystem, type Actor } from "../actor-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import {
  parameterPath,
  vec2,
  type SceneFrame,
  type SceneStateChangedEvent
} from "../scene-runtime";
import { createTestComponentRegistry } from "../test-support";
import {
  FloatingWindowComponent,
  floatingWindowComponentType,
  type FloatingWindowMenuOptions
} from "./floating-window-component";
import { installWindowComponentDefinitions } from "./install-component-definitions";
import type { FloatingWindowParameterPaths } from "./floating-window-state";
import { createWindowControlSource } from "./window-control-source";
import { WindowVisibilityActivationController } from "./window-visibility-activation-controller";

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

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
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
    return {
      x: 0,
      y: 0,
      width: 320,
      height: 180,
      left: 0,
      top: 0,
      right: 320,
      bottom: 180,
      toJSON() {
        return this;
      }
    };
  }
}

interface WindowFixtureOptions {
  readonly actorId: string;
  readonly title?: string;
  readonly actorEnabled?: boolean;
  readonly visible?: boolean;
  readonly windowMenu?: FloatingWindowMenuOptions;
}

interface WindowFixture {
  readonly actor: Actor;
  readonly component: FloatingWindowComponent;
  readonly paths: FloatingWindowParameterPaths;
}

function createPaths(prefix: string): FloatingWindowParameterPaths {
  return {
    position: parameterPath(`${prefix}.position`),
    size: parameterPath(`${prefix}.size`),
    visible: parameterPath(`${prefix}.visible`)
  };
}

function createWindowFixture(
  actorSystem: ActorSystem,
  document: FakeDocument,
  options: WindowFixtureOptions
): WindowFixture {
  const { registry } = createTestComponentRegistry({ actorSystem });
  installCoreComponentDefinitions(registry);
  installWindowComponentDefinitions(registry);
  const actor = actorSystem.createActor({
    id: options.actorId,
    name: options.title ?? options.actorId,
    enabled: options.actorEnabled
  });
  const parent = document.createElement("div");
  const paths = createPaths(options.actorId);
  const component = registry.addComponent(actor, floatingWindowComponentType, {
    id: `floating-window:${options.actorId}`,
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    title: options.title ?? actor.name,
    paths,
    initialState: {
      position: vec2(12, 24),
      size: vec2(320, 180),
      visible: options.visible ?? true
    },
    windowMenu: options.windowMenu
  });
  return { actor, component, paths };
}

function createVisibleChangedEvent(
  paths: FloatingWindowParameterPaths,
  previousValue: boolean,
  nextValue: boolean
): SceneStateChangedEvent {
  return {
    frame: createFrame(),
    changes: [{
      path: paths.visible,
      previousValue,
      nextValue,
      sources: [],
      commands: []
    }]
  };
}

function createFrame(): SceneFrame {
  return {
    timeMs: 0,
    deltaMs: 0,
    frameIndex: 0
  };
}

describe("WindowVisibilityActivationController", () => {
  it("syncs visible window state to actor enabled on init and state changes", () => {
    const actorSystem = new ActorSystem();
    const document = new FakeDocument();
    const { actor, component, paths } = createWindowFixture(actorSystem, document, {
      actorId: "debug-log-window",
      title: "Debug Log",
      actorEnabled: false,
      visible: true
    });
    const source = createWindowControlSource({ actorSystem });

    const controller = new WindowVisibilityActivationController({ source });

    expect(actor.enabled).toBe(true);

    const hiddenEvent = createVisibleChangedEvent(paths, true, false);
    component.onSceneStateChanged(hiddenEvent);
    controller.onSceneStateChanged(hiddenEvent);

    expect(actor.enabled).toBe(false);

    const visibleEvent = createVisibleChangedEvent(paths, false, true);
    component.onSceneStateChanged(visibleEvent);
    controller.onSceneStateChanged(visibleEvent);

    expect(actor.enabled).toBe(true);
  });

  it("cascades Scene window visibility activation to child actors through active-in-hierarchy", () => {
    const actorSystem = new ActorSystem();
    const document = new FakeDocument();
    const { actor: sceneActor, component, paths } = createWindowFixture(actorSystem, document, {
      actorId: "scene-window",
      title: "Scene",
      visible: true
    });
    const cameraActor = actorSystem.createActor({
      id: "camera-3",
      name: "Camera3",
      parent: sceneActor
    });
    const tesseractActor = actorSystem.createActor({
      id: "tesseract-4",
      name: "Tesseract4",
      parent: sceneActor
    });
    const controller = new WindowVisibilityActivationController({
      source: createWindowControlSource({ actorSystem })
    });

    const hiddenEvent = createVisibleChangedEvent(paths, true, false);
    component.onSceneStateChanged(hiddenEvent);
    controller.onSceneStateChanged(hiddenEvent);

    expect(sceneActor.enabled).toBe(false);
    expect(cameraActor.enabled).toBe(true);
    expect(tesseractActor.enabled).toBe(true);
    expect(actorSystem.isActorActive(sceneActor)).toBe(false);
    expect(actorSystem.isActorActive(cameraActor)).toBe(false);
    expect(actorSystem.isActorActive(tesseractActor)).toBe(false);

    const visibleEvent = createVisibleChangedEvent(paths, false, true);
    component.onSceneStateChanged(visibleEvent);
    controller.onSceneStateChanged(visibleEvent);

    expect(sceneActor.enabled).toBe(true);
    expect(actorSystem.isActorActive(sceneActor)).toBe(true);
    expect(actorSystem.isActorActive(cameraActor)).toBe(true);
    expect(actorSystem.isActorActive(tesseractActor)).toBe(true);
  });

  it("corrects externally inactive visible windows on frame reconciliation", () => {
    const actorSystem = new ActorSystem();
    const document = new FakeDocument();
    const { actor } = createWindowFixture(actorSystem, document, {
      actorId: "hierarchy-panel",
      title: "Hierarchy",
      visible: true
    });
    const controller = new WindowVisibilityActivationController({
      source: createWindowControlSource({ actorSystem })
    });
    actor.enabled = false;

    controller.updateFrame(createFrame());

    expect(actor.enabled).toBe(true);
  });

  it("does not mutate actors whose window activation mode is none", () => {
    const actorSystem = new ActorSystem();
    const document = new FakeDocument();
    const { actor } = createWindowFixture(actorSystem, document, {
      actorId: "scene-window",
      title: "Scene",
      actorEnabled: false,
      visible: true,
      windowMenu: { include: true, activationMode: "none" }
    });

    new WindowVisibilityActivationController({
      source: createWindowControlSource({ actorSystem })
    });

    expect(actor.enabled).toBe(false);
  });
});

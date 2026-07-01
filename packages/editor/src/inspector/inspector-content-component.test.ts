import { describe, expect, it } from "vitest";
import {
  ActorSystem,
  ComponentRegistry,
  componentType,
  normalizeActorSelectionSnapshot,
  type ActorSelectionSnapshot,
  type Component,
  type ComponentDefinition
} from "actor-system/core";
import { type UiElementComponent } from "ui-framework/actor-ui";

import type { AppStateChangedEvent } from "../app-state";
import { editorStatePaths } from "../editor-state";
import {
  createActorSystemInspectorActorDetailsSource,
  type InspectorActorDetailsSource
} from "./inspector-actor-details-source";
import { createInspectorComponentDescriptorRegistry } from "./inspector-component-descriptor-registry";
import { InspectorContentComponent, type InspectorLockStateSink } from "./inspector-content-component";
import type {
  InspectorEditablePropertyControlSpec,
  InspectorPropertyControlReconcilerPort
} from "./inspector-property-control-actor-reconciler";
import type { InspectorSelectionSnapshotSource } from "./inspector-selection-source";

interface TestComponent extends Component {
  label: string;
}

const testComponentType = componentType<TestComponent>("test-component");
const duplicateComponentType = componentType<TestComponent>("duplicate-component");

describe("InspectorContentComponent", () => {
  it("renders the current active selection with Component sections", () => {
    const fixture = createFixture({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });

    expect(textOf(fixture.element)).toContain("Scene View");
    expect(fixture.element.dataset.inspectorState).toBe("inspecting");
    expect(fixture.element.dataset.inspectorActorId).toBe("scene");
    expect(fixture.element.dataset.inspectorComponentCount).toBe("2");
    expect(componentSections(fixture.element).map((section) => section.dataset.inspectorComponentId)).toEqual([
      "scene-component",
      "scene-duplicate"
    ]);
    expect(componentSections(fixture.element).map((section) => section.dataset.inspectorComponentType)).toEqual([
      "test-component",
      "duplicate-component"
    ]);
    expect(componentSections(fixture.element).map((section) => section.dataset.inspectorComponentEnabled)).toEqual([
      "true",
      "false"
    ]);
  });

  it("renders no-selection and missing-actor states deterministically", () => {
    const empty = createFixture();
    expect(textOf(empty.element)).toBe("No actor selected");
    expect(empty.element.dataset.inspectorState).toBe("empty");
    expect(empty.element.dataset.inspectorComponentCount).toBe("0");

    const missing = createFixture(undefined, {
      initialLocked: true,
      initialInspectedActorId: "deleted"
    });
    expect(textOf(missing.element)).toBe("Missing actor: deleted");
    expect(missing.element.dataset.inspectorState).toBe("missing");
    expect(missing.element.dataset.inspectorComponentCount).toBe("0");
  });

  it("renders actors with no components deterministically", () => {
    const fixture = createFixture({
      selectedActorIds: ["empty-actor"],
      activeActorId: "empty-actor"
    });

    expect(fixture.element.dataset.inspectorState).toBe("inspecting");
    expect(fixture.element.dataset.inspectorComponentCount).toBe("0");
    expect(textOf(fixture.element)).toContain("Empty Actor");
    expect(textOf(fixture.element)).toContain("No components");
  });

  it("ignores initial inspected actor id unless initially locked", () => {
    const unlocked = createFixture({
      selectedActorIds: ["camera"],
      activeActorId: "camera"
    }, {
      initialInspectedActorId: "scene"
    });
    const locked = createFixture({
      selectedActorIds: ["camera"],
      activeActorId: "camera"
    }, {
      initialLocked: true,
      initialInspectedActorId: "scene"
    });

    expect(unlocked.inspector.inspectedActorId).toBe("camera");
    expect(textOf(unlocked.element)).toContain("Camera3");
    expect(locked.inspector.inspectedActorId).toBe("scene");
    expect(textOf(locked.element)).toContain("Scene View");
  });

  it("follows active selection while unlocked and ignores unrelated state changes", () => {
    const fixture = createFixture({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });

    fixture.emitSelection({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "camera"
    });
    expect(fixture.inspector.inspectedActorId).toBe("camera");
    expect(textOf(fixture.element)).toContain("Camera3");
    expect(fixture.element.dataset.inspectorComponentCount).toBe("1");

    fixture.inspector.onStateChanged({
      frame: {} as never,
      changes: [{
        path: "workspace.mode",
        previousValue: "editor",
        nextValue: "run",
        sources: [],
        commands: []
      }]
    });
    expect(fixture.inspector.inspectedActorId).toBe("camera");
  });

  it("locks local inspected actor state, notifies lock sink, and catches up when unlocked", () => {
    const sinkCalls: boolean[] = [];
    const locked = createFixture({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    }, {
      initialLocked: true,
      initialInspectedActorId: "scene",
      lockStateSink: createLockSink(sinkCalls)
    });
    const unlocked = createFixture({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });

    locked.updateSource({
      selectedActorIds: ["camera"],
      activeActorId: "camera"
    });
    unlocked.updateSource({
      selectedActorIds: ["camera"],
      activeActorId: "camera"
    });
    const event = selectionChangedEvent({
      selectedActorIds: ["camera"],
      activeActorId: "camera"
    });
    locked.inspector.onStateChanged(event);
    unlocked.inspector.onStateChanged(event);

    expect(locked.inspector.inspectedActorId).toBe("scene");
    expect(textOf(locked.element)).toContain("Scene View");
    expect(unlocked.inspector.inspectedActorId).toBe("camera");
    expect(textOf(unlocked.element)).toContain("Camera3");

    locked.inspector.setLocked(false);

    expect(locked.inspector.locked).toBe(false);
    expect(locked.inspector.inspectedActorId).toBe("camera");
    expect(textOf(locked.element)).toContain("Camera3");
    expect(sinkCalls).toEqual([false]);
  });

  it("notifies lock sink on direct setLocked calls", () => {
    const sinkCalls: boolean[] = [];
    const fixture = createFixture(undefined, {
      lockStateSink: createLockSink(sinkCalls)
    });

    fixture.inspector.setLocked(true);
    fixture.inspector.setLocked(false);

    expect(sinkCalls).toEqual([true, false]);
  });

  it("keeps two real Inspector components divergent with one shared selection source", () => {
    const { actorSystem, registry } = createActorFixture();
    actorSystem.createActor({ id: "inspector:a" });
    actorSystem.createActor({ id: "inspector:b" });
    const scene = actorSystem.createActor({ id: "scene", name: "Scene View" });
    const camera = actorSystem.createActor({ id: "camera", name: "Camera3" });
    registry.addComponent(scene, testComponentType, { id: "scene-component", label: "scene" });
    registry.addComponent(camera, testComponentType, { id: "camera-component", label: "camera" });
    const source = new MutableSelectionSource({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });
    const descriptorRegistry = createInspectorComponentDescriptorRegistry();
    const detailsSource = createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry });
    const locked = createInspector(actorSystem, "inspector:a", source, detailsSource, {
      initialLocked: true,
      initialInspectedActorId: "scene"
    });
    const unlocked = createInspector(actorSystem, "inspector:b", source, detailsSource);
    const nextSelection = normalizeActorSelectionSnapshot({
      selectedActorIds: ["camera"],
      activeActorId: "camera"
    });

    source.snapshot = nextSelection;
    const event = selectionChangedEvent(nextSelection);
    locked.inspector.onStateChanged(event);
    unlocked.inspector.onStateChanged(event);

    expect(locked.inspector.inspectedActorId).toBe("scene");
    expect(textOf(locked.element)).toContain("Scene View");
    expect(unlocked.inspector.inspectedActorId).toBe("camera");
    expect(textOf(unlocked.element)).toContain("Camera3");
    expect(locked.source).toBe(unlocked.source);
  });

  it("refreshes descriptor property rows on frame updates without replacing unchanged content", () => {
    const { actorSystem, registry, descriptorRegistry } = createActorFixture();
    const actor = actorSystem.createActor({ id: "inspector:view" });
    const scene = actorSystem.createActor({ id: "scene", name: "Scene View" });
    const component = registry.addComponent(scene, testComponentType, { id: "scene-component", label: "before" });
    descriptorRegistry.register({
      componentType: "test-component",
      readProperties(readComponent) {
        return [{
          id: "label",
          label: "Label",
          value: (readComponent as TestComponent).label,
          kind: "text"
        }];
      }
    });
    const source = new MutableSelectionSource({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });
    const fixture = createInspector(
      actorSystem,
      actor.id,
      source,
      createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry })
    );
    const fakeElement = fixture.element as unknown as FakeElement;
    const replaceCount = fakeElement.replaceChildrenCount;

    component.label = "after";
    fixture.inspector.updateFrame({} as never);

    expect(propertyRows(fixture.element).map((row) => row.dataset.inspectorPropertyId)).toEqual(["label"]);
    expect(textOf(fixture.element)).toContain("after");
    expect(fakeElement.replaceChildrenCount).toBe(replaceCount + 1);

    fixture.inspector.updateFrame({} as never);

    expect(fakeElement.replaceChildrenCount).toBe(replaceCount + 1);
  });

  it("rehosts editable property control elements supplied by the property control reconciler", () => {
    const { actorSystem, registry, descriptorRegistry } = createActorFixture();
    const actor = actorSystem.createActor({ id: "inspector:view" });
    const scene = actorSystem.createActor({ id: "scene", name: "Scene View" });
    registry.addComponent(scene, testComponentType, { id: "scene-component", label: "before" });
    descriptorRegistry.register({
      componentType: "test-component",
      readProperties() {
        return [{
          id: "fov",
          label: "FOV",
          value: "45.00 deg",
          kind: "number",
          edit: {
            control: "number",
            value: 45,
            min: 1,
            max: 120,
            step: 0.1
          }
        }];
      }
    });
    const controlElement = createFakeElement();
    controlElement.className = "fake-number-control";
    const reconciler = new FakePropertyControlReconciler(new Map([[
      "scene\u0000scene-component\u0000fov",
      controlElement as unknown as HTMLElement
    ]]));
    const fixture = createInspector(
      actorSystem,
      actor.id,
      new MutableSelectionSource({
        selectedActorIds: ["scene"],
        activeActorId: "scene"
      }),
      createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry }),
      { propertyControlReconciler: reconciler }
    );

    expect(reconciler.lastSpecs.map((spec) => [spec.actorId, spec.componentId, spec.property.id])).toEqual([
      ["scene", "scene-component", "fov"]
    ]);
    expect(propertyRows(fixture.element)[0].findByClass("fake-number-control")).toEqual([controlElement]);
    expect(controlElement.parentElement?.className).toBe("inspector-window__property-value");
  });

  it("disposes the property control reconciler with the content component", () => {
    const reconciler = new FakePropertyControlReconciler();
    const fixture = createFixture(undefined, { propertyControlReconciler: reconciler });

    fixture.inspector.dispose();

    expect(reconciler.disposeCount).toBe(1);
  });

  it("can inspect explicitly without mutating editor selection", () => {
    const fixture = createFixture({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });

    fixture.inspector.inspectActor("camera");

    expect(fixture.inspector.inspectedActorId).toBe("camera");
    expect(fixture.source.getSelectionSnapshot()).toEqual({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });
  });

  it("disposes without removing its UiElement body", () => {
    const fixture = createFixture();
    const parent = createFakeElement();
    parent.append(fixture.element as unknown as FakeElement);

    fixture.inspector.dispose();

    expect(fixture.inspector.enabled).toBe(false);
    expect((fixture.element as unknown as FakeElement).parentElement).toBe(parent);
  });
});

function createFixture(
  initialSelection?: ActorSelectionSnapshot,
  options: {
    readonly initialLocked?: boolean;
    readonly initialInspectedActorId?: string | null;
    readonly lockStateSink?: InspectorLockStateSink;
    readonly propertyControlReconciler?: InspectorPropertyControlReconcilerPort;
  } = {}
): {
  readonly element: HTMLElement;
  readonly inspector: InspectorContentComponent;
  readonly source: MutableSelectionSource;
  updateSource(snapshot: ActorSelectionSnapshot): void;
  emitSelection(snapshot: ActorSelectionSnapshot): void;
} {
  const { actorSystem, registry, descriptorRegistry } = createActorFixture();
  const actor = actorSystem.createActor({ id: "inspector:view" });
  const scene = actorSystem.createActor({ id: "scene", name: "Scene View" });
  const camera = actorSystem.createActor({ id: "camera", name: "Camera3" });
  actorSystem.createActor({ id: "empty-actor", name: "Empty Actor" });
  registry.addComponent(scene, testComponentType, { id: "scene-component", label: "scene" });
  registry.addComponent(scene, duplicateComponentType, {
    id: "scene-duplicate",
    label: "scene duplicate",
    enabled: false
  });
  registry.addComponent(camera, testComponentType, { id: "camera-component", label: "camera" });
  const source = new MutableSelectionSource(initialSelection);
  const fixture = createInspector(
    actorSystem,
    actor.id,
    source,
    createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry }),
    options
  );
  return {
    ...fixture,
    updateSource(snapshot: ActorSelectionSnapshot): void {
      source.snapshot = normalizeActorSelectionSnapshot(snapshot);
    },
    emitSelection(snapshot: ActorSelectionSnapshot): void {
      source.snapshot = normalizeActorSelectionSnapshot(snapshot);
      fixture.inspector.onStateChanged(selectionChangedEvent(snapshot));
    }
  };
}

function createInspector(
  actorSystem: ActorSystem,
  actorId: string,
  source: MutableSelectionSource,
  actorDetailsSource: InspectorActorDetailsSource,
  options: {
    readonly initialLocked?: boolean;
    readonly initialInspectedActorId?: string | null;
    readonly lockStateSink?: InspectorLockStateSink;
    readonly propertyControlReconciler?: InspectorPropertyControlReconcilerPort;
  } = {}
): {
  readonly element: HTMLElement;
  readonly inspector: InspectorContentComponent;
  readonly source: MutableSelectionSource;
} {
  const actor = actorSystem.getActor(actorId) ?? actorSystem.createActor({ id: actorId });
  const element = createFakeElement() as unknown as HTMLElement;
  const inspector = new InspectorContentComponent(
    actor,
    { element } as UiElementComponent,
    {
      actorDetailsSource,
      selectionSource: source,
      propertyControlReconciler: options.propertyControlReconciler ?? new FakePropertyControlReconciler(),
      ...options
    }
  );

  return {
    element,
    inspector,
    source
  };
}

class MutableSelectionSource implements InspectorSelectionSnapshotSource {
  snapshot: ActorSelectionSnapshot;

  constructor(initial?: ActorSelectionSnapshot) {
    this.snapshot = normalizeActorSelectionSnapshot(initial);
  }

  getSelectionSnapshot(): ActorSelectionSnapshot {
    return this.snapshot;
  }
}

class FakePropertyControlReconciler implements InspectorPropertyControlReconcilerPort {
  readonly #elements: ReadonlyMap<string, HTMLElement>;
  lastSpecs: readonly InspectorEditablePropertyControlSpec[] = [];
  disposeCount = 0;

  constructor(elements: ReadonlyMap<string, HTMLElement> = new Map()) {
    this.#elements = elements;
  }

  reconcile(specs: readonly InspectorEditablePropertyControlSpec[]): ReadonlyMap<string, HTMLElement> {
    this.lastSpecs = specs;
    return this.#elements;
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

function selectionChangedEvent(snapshot: ActorSelectionSnapshot): AppStateChangedEvent {
  return {
    frame: {} as never,
    changes: [{
      path: editorStatePaths.selection.snapshot,
      previousValue: normalizeActorSelectionSnapshot(null),
      nextValue: snapshot,
      sources: [],
      commands: []
    }]
  };
}

function createLockSink(calls: boolean[]): InspectorLockStateSink {
  return {
    inspectorLockStateChanged(locked) {
      calls.push(locked);
    }
  };
}

function createActorFixture(): {
  readonly actorSystem: ActorSystem;
  readonly registry: ComponentRegistry;
  readonly descriptorRegistry: ReturnType<typeof createInspectorComponentDescriptorRegistry>;
} {
  const actorSystem = new ActorSystem();
  const registry = new ComponentRegistry({ actorSystem });
  const descriptorRegistry = createInspectorComponentDescriptorRegistry();
  registry.registerDefinition(createTestComponentDefinition(testComponentType));
  registry.registerDefinition(createTestComponentDefinition(duplicateComponentType));
  return { actorSystem, registry, descriptorRegistry };
}

function createTestComponentDefinition(type: typeof testComponentType | typeof duplicateComponentType):
ComponentDefinition<TestComponent, { readonly id: string; readonly label: string; readonly enabled?: boolean }> {
  return {
    type,
    createId(_actor, options) {
      if (!options?.id) throw new Error("id is required");
      return options.id;
    },
    create(actor, _context, options) {
      if (!options?.id) throw new Error("id is required");
      return {
        actor,
        id: options.id,
        type,
        label: options.label,
        enabled: options.enabled ?? true
      };
    }
  };
}

function createFakeElement(): FakeElement {
  return new FakeElement("div");
}

function componentSections(element: HTMLElement): FakeElement[] {
  return (element as unknown as FakeElement).findByClass("inspector-window__component-section");
}

function propertyRows(element: HTMLElement): FakeElement[] {
  return (element as unknown as FakeElement).findByClass("inspector-window__property-row");
}

function textOf(element: HTMLElement | FakeElement): string {
  const fake = element as unknown as FakeElement;
  if (fake.children.length === 0) return fake.textContent;
  return [fake.textContent, ...fake.children.map((child) => textOf(child))]
    .join("")
    .trim();
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly children: FakeElement[] = [];
  className = "";
  textContent = "";
  parentElement: FakeElement | null = null;
  replaceChildrenCount = 0;

  constructor(tagName: string, ownerDocument: FakeDocument = new FakeDocument()) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      if (child.parentElement) {
        const index = child.parentElement.children.indexOf(child);
        if (index >= 0) child.parentElement.children.splice(index, 1);
      }
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeElement[]): void {
    this.replaceChildrenCount += 1;
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children.length = 0;
    this.textContent = "";
    this.append(...children);
  }

  findByClass(className: string): FakeElement[] {
    return [
      ...(this.className === className ? [this] : []),
      ...this.children.flatMap((child) => child.findByClass(className))
    ];
  }
}

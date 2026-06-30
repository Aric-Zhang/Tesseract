import { describe, expect, it } from "vitest";
import { ActorSystem, normalizeActorSelectionSnapshot, type ActorSelectionSnapshot } from "actor-system/core";
import { type UiElementComponent } from "ui-framework/actor-ui";

import type { AppStateChangedEvent } from "../app-state";
import { editorStatePaths } from "../editor-state";
import { createActorSystemInspectorActorDisplaySource } from "./inspector-actor-display-source";
import { InspectorContentComponent, type InspectorLockStateSink } from "./inspector-content-component";
import type { InspectorSelectionSnapshotSource } from "./inspector-selection-source";

describe("InspectorContentComponent", () => {
  it("renders the current active selection", () => {
    const fixture = createFixture({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });

    expect(fixture.element.textContent).toBe("Inspecting: Scene View");
    expect(fixture.element.dataset.inspectorState).toBe("inspecting");
    expect(fixture.element.dataset.inspectorActorId).toBe("scene");
  });

  it("renders no-selection and missing-actor states deterministically", () => {
    const empty = createFixture();
    expect(empty.element.textContent).toBe("No actor selected");
    expect(empty.element.dataset.inspectorState).toBe("empty");

    const missing = createFixture(undefined, {
      initialLocked: true,
      initialInspectedActorId: "deleted"
    });
    expect(missing.element.textContent).toBe("Missing actor: deleted");
    expect(missing.element.dataset.inspectorState).toBe("missing");
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
    expect(unlocked.element.textContent).toBe("Inspecting: Camera3");
    expect(locked.inspector.inspectedActorId).toBe("scene");
    expect(locked.element.textContent).toBe("Inspecting: Scene View");
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
    expect(fixture.element.textContent).toBe("Inspecting: Camera3");

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
    expect(locked.element.textContent).toBe("Inspecting: Scene View");
    expect(unlocked.inspector.inspectedActorId).toBe("camera");
    expect(unlocked.element.textContent).toBe("Inspecting: Camera3");

    locked.inspector.setLocked(false);

    expect(locked.inspector.locked).toBe(false);
    expect(locked.inspector.inspectedActorId).toBe("camera");
    expect(locked.element.textContent).toBe("Inspecting: Camera3");
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
    const actorSystem = new ActorSystem();
    actorSystem.createActor({ id: "inspector:a" });
    actorSystem.createActor({ id: "inspector:b" });
    actorSystem.createActor({ id: "scene", name: "Scene View" });
    actorSystem.createActor({ id: "camera", name: "Camera3" });
    const source = new MutableSelectionSource({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });
    const displaySource = createActorSystemInspectorActorDisplaySource(actorSystem);
    const locked = createInspector(actorSystem, "inspector:a", source, displaySource, {
      initialLocked: true,
      initialInspectedActorId: "scene"
    });
    const unlocked = createInspector(actorSystem, "inspector:b", source, displaySource);
    const nextSelection = normalizeActorSelectionSnapshot({
      selectedActorIds: ["camera"],
      activeActorId: "camera"
    });

    source.snapshot = nextSelection;
    const event = selectionChangedEvent(nextSelection);
    locked.inspector.onStateChanged(event);
    unlocked.inspector.onStateChanged(event);

    expect(locked.inspector.inspectedActorId).toBe("scene");
    expect(locked.element.textContent).toBe("Inspecting: Scene View");
    expect(unlocked.inspector.inspectedActorId).toBe("camera");
    expect(unlocked.element.textContent).toBe("Inspecting: Camera3");
    expect(locked.source).toBe(unlocked.source);
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
    parent.append(fixture.element);

    fixture.inspector.dispose();

    expect(fixture.inspector.enabled).toBe(false);
    expect(fixture.element.parentElement).toBe(parent);
  });
});

function createFixture(
  initialSelection?: ActorSelectionSnapshot,
  options: {
    readonly initialLocked?: boolean;
    readonly initialInspectedActorId?: string | null;
    readonly lockStateSink?: InspectorLockStateSink;
  } = {}
): {
  readonly element: HTMLElement;
  readonly inspector: InspectorContentComponent;
  readonly source: MutableSelectionSource;
  updateSource(snapshot: ActorSelectionSnapshot): void;
  emitSelection(snapshot: ActorSelectionSnapshot): void;
} {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "inspector:view" });
  actorSystem.createActor({ id: "scene", name: "Scene View" });
  actorSystem.createActor({ id: "camera", name: "Camera3" });
  const source = new MutableSelectionSource(initialSelection);
  const fixture = createInspector(
    actorSystem,
    actor.id,
    source,
    createActorSystemInspectorActorDisplaySource(actorSystem),
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
  actorDisplaySource: ReturnType<typeof createActorSystemInspectorActorDisplaySource>,
  options: {
    readonly initialLocked?: boolean;
    readonly initialInspectedActorId?: string | null;
    readonly lockStateSink?: InspectorLockStateSink;
  } = {}
): {
  readonly element: HTMLElement;
  readonly inspector: InspectorContentComponent;
  readonly source: MutableSelectionSource;
} {
  const actor = actorSystem.getActor(actorId) ?? actorSystem.createActor({ id: actorId });
  const element = createFakeElement();
  const inspector = new InspectorContentComponent(
    actor,
    { element } as UiElementComponent,
    {
      actorDisplaySource,
      selectionSource: source,
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

function createFakeElement(): HTMLElement {
  return {
    dataset: {},
    textContent: "",
    parentElement: null,
    append(child: { parentElement: HTMLElement | null }) {
      child.parentElement = this as unknown as HTMLElement;
    }
  } as unknown as HTMLElement;
}

import { describe, expect, it } from "vitest";
import { ActorSystem, normalizeActorSelectionSnapshot, type ActorSelectionSnapshot } from "actor-system/core";
import { type UiElementComponent } from "ui-framework/actor-ui";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "ui-framework/window";

import type { AppStateChangedEvent } from "../app-state";
import { editorStatePaths } from "../editor-state";
import { createActorSystemInspectorActorDisplaySource } from "./inspector-actor-display-source";
import { InspectorContentComponent } from "./inspector-content-component";
import type { InspectorSelectionSnapshotSource } from "./inspector-selection-source";

class FakeWindowContentRegistry implements WindowContentRegistrationPort {
  registered: { readonly contentId: string; readonly element: HTMLElement } | null = null;

  registerContent(request: { readonly contentId: string; readonly element: HTMLElement }): WindowRegisteredContent {
    this.registered = request;
    return {
      contentId: request.contentId,
      element: request.element,
      interactable: true,
      setInteractable() {},
      subscribeLayoutCommit(_callback: (commit: WindowContentLayoutCommit) => void): WindowContentLayoutCommitRegistration {
        return { dispose() {} };
      },
      dispose: () => {
        if (this.registered?.contentId === request.contentId) {
          this.registered = null;
        }
      }
    };
  }
}

describe("InspectorContentComponent", () => {
  it("registers the UiElement root and renders the current active selection", () => {
    const fixture = createFixture({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });

    expect(fixture.contentRegistration.registered?.element).toBe(fixture.element);
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

  it("locks local inspected actor state and catches up when unlocked", () => {
    const locked = createFixture({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    }, {
      initialLocked: true,
      initialInspectedActorId: "scene"
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

  it("disposes the window content registration", () => {
    const fixture = createFixture();
    fixture.inspector.dispose();

    expect(fixture.inspector.enabled).toBe(false);
    expect(fixture.contentRegistration.registered).toBeNull();
  });
});

function createFixture(
  initialSelection?: ActorSelectionSnapshot,
  options: {
    readonly initialLocked?: boolean;
    readonly initialInspectedActorId?: string | null;
  } = {}
): {
  readonly element: HTMLElement;
  readonly contentRegistration: FakeWindowContentRegistry;
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
  } = {}
): {
  readonly element: HTMLElement;
  readonly contentRegistration: FakeWindowContentRegistry;
  readonly inspector: InspectorContentComponent;
  readonly source: MutableSelectionSource;
} {
  const actor = actorSystem.getActor(actorId) ?? actorSystem.createActor({ id: actorId });
  const element = createFakeElement();
  const contentRegistration = new FakeWindowContentRegistry();
  const inspector = new InspectorContentComponent(
    actor,
    { element } as UiElementComponent,
    {
      contentId: "content:inspector",
      contentRegistration,
      actorDisplaySource,
      selectionSource: source,
      ...options
    }
  );

  return {
    element,
    contentRegistration,
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

function createFakeElement(): HTMLElement {
  return {
    dataset: {},
    textContent: ""
  } as unknown as HTMLElement;
}

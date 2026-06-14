import { describe, expect, it } from "vitest";
import {
  createWindowWorkspaceFrameLayout,
  type WindowFrameDockNode,
  type WindowFrameSplitNode,
  type WindowFrameTabsetNode,
  type WindowWorkspaceFrameLayout
} from "./window-workspace-layout";
import {
  hydrateWindowWorkspaceFrameLayout,
  getPersistedViewDescriptorIdentity,
  getPersistedViewDescriptorRuntimeViewKey,
  parsePersistedWindowWorkspaceFrameLayout,
  serializeWindowWorkspaceFrameLayout,
  WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION,
  type PersistedWindowWorkspaceViewDescriptor
} from "./window-workspace-layout-persistence";
import { windowViewInstanceId, windowViewTypeKey } from "./window-view-identity";
import { windowViewKey } from "./window-view-key";

describe("window workspace frame layout persistence", () => {
  it("serializes logical view instance identities without storing runtime actor ids", () => {
    const layout = createSubjectLayout();

    const persisted = serializeWindowWorkspaceFrameLayout(layout);

    expect(persisted.version).toBe(WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION);
    expect(persisted.views).toEqual([
      { typeKey: "scene", instanceId: "scene:default", title: "Scene", canDock: undefined, singleton: true },
      { typeKey: "debug", instanceId: "debug:default", title: "Debug Log", canDock: undefined, singleton: true },
      { typeKey: "hierarchy", instanceId: "hierarchy:default", title: "Hierarchy", canDock: undefined, singleton: true }
    ]);
    expect(JSON.stringify(persisted)).not.toContain("scene-view-actor");
    expect(JSON.stringify(persisted)).not.toContain("debug-view-actor");
    expect(JSON.stringify(persisted)).not.toContain("actorId");
    expect(JSON.stringify(persisted)).not.toContain("viewActorId");
    expect(JSON.stringify(persisted)).not.toContain("frameActorId");
    const persistedSplit = expectPersistedSplit(persisted.frames[0]?.root);
    const persistedSceneTabset = expectPersistedTabset(persistedSplit.first);
    const persistedToolsTabset = expectPersistedTabset(persistedSplit.second);
    expect(persistedSceneTabset.tabs)
      .toEqual(["scene:default"]);
    expect(persistedSceneTabset.activeTabId).toBe("scene:default");
    expect(persistedToolsTabset.tabs)
      .toEqual(["debug:default", "hierarchy:default"]);
    expect(persistedToolsTabset.activeTabId).toBe("hierarchy:default");
  });

  it("hydrates persisted logical layout with fresh runtime actor ids", () => {
    const persisted = serializeWindowWorkspaceFrameLayout(createSubjectLayout());

    const hydrated = hydrateWindowWorkspaceFrameLayout(persisted, [
      { viewKey: "scene", actorId: "scene-view-actor-2", title: "Scene Runtime 2" },
      { viewKey: "debug", actorId: "debug-view-actor-2", title: "Debug Runtime 2" },
      { viewKey: "hierarchy", actorId: "hierarchy-view-actor-2", title: "Hierarchy Runtime 2" }
    ]);

    expect(hydrated.views["scene"]?.actorId).toBe("scene-view-actor-2");
    expect(hydrated.views["debug"]?.actorId).toBe("debug-view-actor-2");
    expect(hydrated.views["hierarchy"]?.actorId).toBe("hierarchy-view-actor-2");
    const hydratedSplit = expectSplit(hydrated.frames[0]?.root);
    expect(expectTabset(hydratedSplit.first)).toMatchObject({
      tabs: ["scene"],
      activeTabId: "scene"
    });
    expect(expectTabset(hydratedSplit.second)).toMatchObject({
      tabs: ["debug", "hierarchy"],
      activeTabId: "hierarchy"
    });
  });

  it("round trips v2 layouts with two instances of the same view type", () => {
    const inspectorType = windowViewTypeKey("inspector");
    const inspectorA = windowViewInstanceId("inspector:a");
    const inspectorB = windowViewInstanceId("inspector:b");
    const layout = createWindowWorkspaceFrameLayout({
      views: [
        {
          viewKey: windowViewKey("inspector:a"),
          identity: {
            viewKey: windowViewKey("inspector:a"),
            typeKey: inspectorType,
            instanceId: inspectorA,
            multiplicity: "multi-instance"
          },
          actorId: "inspector-a-view-actor",
          title: "Inspector A"
        },
        {
          viewKey: windowViewKey("inspector:b"),
          identity: {
            viewKey: windowViewKey("inspector:b"),
            typeKey: inspectorType,
            instanceId: inspectorB,
            multiplicity: "multi-instance"
          },
          actorId: "inspector-b-view-actor",
          title: "Inspector B"
        }
      ],
      frames: [{
        frameId: "inspector-frame",
        bounds: {
          position: { x: 20, y: 30 },
          size: { x: 420, y: 260 },
          visible: true
        },
        presentation: "windowed",
        root: {
          kind: "tabset",
          id: "inspectors",
          tabs: [windowViewKey("inspector:a"), windowViewKey("inspector:b")],
          activeTabId: windowViewKey("inspector:b")
        }
      }]
    });

    const persisted = serializeWindowWorkspaceFrameLayout(layout);

    expect(persisted.version).toBe(WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION);
    expect(persisted.views.map((view) => getPersistedViewDescriptorIdentity(view).typeKey))
      .toEqual(["inspector", "inspector"]);
    expect(persisted.views.map((view) => getPersistedViewDescriptorIdentity(view).instanceId))
      .toEqual(["inspector:a", "inspector:b"]);
    expect(expectPersistedTabset(persisted.frames[0]?.root).tabs).toEqual(["inspector:a", "inspector:b"]);
    expect(JSON.stringify(persisted)).not.toContain("inspector-a-view-actor");
    expect(JSON.stringify(persisted)).not.toContain("inspector-b-view-actor");

    const hydrated = hydrateWindowWorkspaceFrameLayout(persisted, [
      {
        viewKey: windowViewKey("runtime-inspector-a"),
        identity: {
          viewKey: windowViewKey("runtime-inspector-a"),
          typeKey: inspectorType,
          instanceId: inspectorA,
          multiplicity: "multi-instance"
        },
        actorId: "fresh-a-view-actor",
        title: "Fresh Inspector A"
      },
      {
        viewKey: windowViewKey("runtime-inspector-b"),
        identity: {
          viewKey: windowViewKey("runtime-inspector-b"),
          typeKey: inspectorType,
          instanceId: inspectorB,
          multiplicity: "multi-instance"
        },
        actorId: "fresh-b-view-actor",
        title: "Fresh Inspector B"
      }
    ]);

    expect(Object.keys(hydrated.views)).toEqual(["runtime-inspector-a", "runtime-inspector-b"]);
    expect(hydrated.views["runtime-inspector-a"]?.actorId).toBe("fresh-a-view-actor");
    expect(hydrated.views["runtime-inspector-b"]?.actorId).toBe("fresh-b-view-actor");
    expect(expectTabset(hydrated.frames[0]?.root).tabs)
      .toEqual(["runtime-inspector-a", "runtime-inspector-b"]);
    expect(expectTabset(hydrated.frames[0]?.root).activeTabId).toBe("runtime-inspector-b");
  });

  it("maps persisted v2 descriptors back to runtime keys without collapsing multi-instance rows", () => {
    expect(getPersistedViewDescriptorRuntimeViewKey({
      typeKey: windowViewTypeKey("scene"),
      instanceId: windowViewInstanceId("scene:default"),
      title: "Scene",
      singleton: true
    })).toBe("scene");
    expect(getPersistedViewDescriptorRuntimeViewKey({
      typeKey: windowViewTypeKey("inspector"),
      instanceId: windowViewInstanceId("inspector:a"),
      title: "Inspector 1"
    })).toBe("inspector:a");
  });

  it("normalizes unknown views during hydration", () => {
    const persisted = serializeWindowWorkspaceFrameLayout(createSubjectLayout());

    const hydrated = hydrateWindowWorkspaceFrameLayout(persisted, [
      { viewKey: "scene", actorId: "scene-view-actor-2", title: "Scene Runtime 2" }
    ]);

    expect(Object.keys(hydrated.views)).toEqual(["scene"]);
    expect(hydrated.frames).toHaveLength(1);
    expect(expectTabset(hydrated.frames[0]?.root).tabs).toEqual(["scene"]);
  });

  it("hydrates mixed known and unknown views while collapsing now-empty split branches", () => {
    const persisted = parsePersistedWindowWorkspaceFrameLayout({
      version: WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION,
      views: [
        { typeKey: "missing", instanceId: "missing:default", title: "Missing", singleton: true },
        { typeKey: "scene", instanceId: "scene:default", title: "Scene", singleton: true },
        { typeKey: "debug", instanceId: "debug:default", title: "Debug Log", singleton: true }
      ],
      frames: [{
        frameId: "mixed-frame",
        bounds: {
          position: { x: 10, y: 20 },
          size: { x: 500, y: 320 },
          visible: true
        },
        presentation: "windowed",
        root: {
          kind: "split",
          id: "persisted-split",
          direction: "horizontal",
          ratio: 0.35,
          first: {
            kind: "tabset",
            id: "unknown-branch",
            tabs: ["missing:default"],
            activeTabId: "missing:default"
          },
          second: {
            kind: "tabset",
            id: "known-branch",
            tabs: ["scene:default", "debug:default"],
            activeTabId: "debug:default"
          }
        }
      }],
      hiddenViewKeys: ["missing", "hierarchy"]
    });
    expect(persisted).not.toBeNull();

    const hydrated = hydrateWindowWorkspaceFrameLayout(persisted!, [
      { viewKey: "scene", actorId: "scene-view-actor-2", title: "Scene Runtime 2" },
      { viewKey: "debug", actorId: "debug-view-actor-2", title: "Debug Runtime 2" }
    ]);

    expectValidFrameLayout(hydrated);
    expect(Object.keys(hydrated.views)).toEqual(["scene", "debug"]);
    expect(expectTabset(hydrated.frames[0]?.root).tabs).toEqual(["scene", "debug"]);
    expect(expectTabset(hydrated.frames[0]?.root).activeTabId).toBe("debug");
    expect(hydrated.hiddenViewKeys).toEqual([]);
  });

  it("normalizes duplicate persisted views and duplicate tabs deterministically", () => {
    const persisted = parsePersistedWindowWorkspaceFrameLayout({
      version: WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION,
      views: [
        { typeKey: "scene", instanceId: "scene:default", title: "Old Scene", singleton: true },
        { typeKey: "debug", instanceId: "debug:default", title: "Debug Log", singleton: true },
        { typeKey: "scene", instanceId: "scene:default", title: "New Scene", singleton: true }
      ],
      frames: [{
        frameId: "duplicate-frame",
        bounds: {
          position: { x: 10, y: 20 },
          size: { x: 500, y: 320 },
          visible: true
        },
        presentation: "windowed",
        root: {
          kind: "tabset",
          id: "duplicate-tabset",
          tabs: ["scene:default", "scene:default", "debug:default"],
          activeTabId: "scene:default"
        }
      }],
      hiddenViewKeys: ["debug", "debug"]
    });
    expect(persisted).not.toBeNull();

    const hydrated = hydrateWindowWorkspaceFrameLayout(persisted!, [
      { viewKey: "scene", actorId: "scene-view-actor-2", title: "Runtime Scene" },
      { viewKey: "debug", actorId: "debug-view-actor-2", title: "Runtime Debug" }
    ]);

    expectValidFrameLayout(hydrated);
    expect(hydrated.views["scene"]?.title).toBe("New Scene");
    expect(expectTabset(hydrated.frames[0]?.root).tabs).toEqual(["scene", "debug"]);
    expect(hydrated.hiddenViewKeys).toEqual([]);
  });

  it("parses valid v2 persisted JSON and rejects invalid versions", () => {
    const persisted = serializeWindowWorkspaceFrameLayout(createSubjectLayout());

    const parsed = parsePersistedWindowWorkspaceFrameLayout(JSON.parse(JSON.stringify(persisted)));

    expect(parsed?.version).toBe(WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION);
    expect(parsed?.views.map((view) => getPersistedViewDescriptorIdentity(view).instanceId))
      .toEqual(["scene:default", "debug:default", "hierarchy:default"]);
    expect(parsed?.frames.map((frame) => frame.frameId)).toEqual(["frame:scene-tools"]);
    expect(parsePersistedWindowWorkspaceFrameLayout({ ...persisted, version: 999 })).toBeNull();
    expect(parsePersistedWindowWorkspaceFrameLayout("not layout")).toBeNull();
  });

  it("rejects v1 persisted view keys instead of carrying legacy schema migration", () => {
    const legacy = parsePersistedWindowWorkspaceFrameLayout({
      version: 1,
      views: [
        { viewKey: "scene", title: "Scene" },
        { viewKey: "debug", title: "Debug Log" }
      ],
      frames: [{
        frameId: "legacy-frame",
        bounds: {
          position: { x: 10, y: 20 },
          size: { x: 500, y: 320 },
          visible: true
        },
        presentation: "windowed",
        root: {
          kind: "tabset",
          id: "legacy-tabset",
          tabs: ["scene", "debug"],
          activeTabId: "debug"
        }
      }],
      hiddenViewKeys: []
    });
    expect(legacy).toBeNull();
  });

  it("parses top-level-valid payloads by pruning malformed entries", () => {
    const parsed = parsePersistedWindowWorkspaceFrameLayout({
      version: WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION,
      views: [
        { typeKey: "scene", instanceId: "scene:default", title: "Scene", singleton: true },
        { typeKey: "debug" },
        42
      ],
      frames: [
        {
          frameId: "valid-frame",
          bounds: {
            position: { x: 10, y: 20 },
            size: { x: 500, y: 320 },
            visible: true
          },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "valid-tabset",
            tabs: ["scene:default"],
            activeTabId: "scene:default"
          }
        },
        {
          frameId: "",
          bounds: {
            position: { x: 0, y: 0 },
            size: { x: 100, y: 100 },
            visible: true
          },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "missing-frame-id",
            tabs: ["scene:default"],
            activeTabId: "scene:default"
          }
        },
        {
          frameId: "empty-tabset-frame",
          bounds: {
            position: { x: 0, y: 0 },
            size: { x: 100, y: 100 },
            visible: true
          },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "empty",
            tabs: [],
            activeTabId: "scene"
          }
        }
      ],
      hiddenViewKeys: ["debug", "", 7]
    });

    expect(parsed?.views.map(getPersistedViewKeyForTest)).toEqual(["scene"]);
    expect(parsed?.frames.map((frame) => frame.frameId)).toEqual(["valid-frame"]);
    expect(parsed?.hiddenViewKeys).toEqual(["debug"]);
  });

  it("rejects malformed top-level storage shapes instead of partially guessing", () => {
    const persisted = serializeWindowWorkspaceFrameLayout(createSubjectLayout());

    expect(parsePersistedWindowWorkspaceFrameLayout({ ...persisted, frames: "bad" })).toBeNull();
    expect(parsePersistedWindowWorkspaceFrameLayout({ ...persisted, views: "bad" })).toBeNull();
    expect(parsePersistedWindowWorkspaceFrameLayout({ ...persisted, hiddenViewKeys: "bad" })).toBeNull();
  });
});

function createSubjectLayout(): WindowWorkspaceFrameLayout {
  return createWindowWorkspaceFrameLayout({
    views: [
      { viewKey: "scene", actorId: "scene-view-actor", title: "Scene" },
      { viewKey: "debug", actorId: "debug-view-actor", title: "Debug Log" },
      { viewKey: "hierarchy", actorId: "hierarchy-view-actor", title: "Hierarchy" }
    ],
    frames: [{
      frameId: "frame:scene-tools",
      bounds: {
        position: { x: 10, y: 20 },
        size: { x: 500, y: 320 },
        visible: true
      },
      presentation: "windowed",
      root: {
        kind: "split",
        id: "persisted-root",
        direction: "horizontal",
        ratio: 0.4,
        first: {
          kind: "tabset",
          id: "persisted-scene",
          tabs: ["scene"],
          activeTabId: "scene"
        },
        second: {
          kind: "tabset",
          id: "persisted-tools",
          tabs: ["debug", "hierarchy"],
          activeTabId: "hierarchy"
        }
      }
    }]
  });
}

function expectSplit(node: unknown): WindowFrameSplitNode {
  expect(node).toMatchObject({ kind: "split" });
  return node as WindowFrameSplitNode;
}

function expectTabset(node: unknown): WindowFrameTabsetNode {
  expect(node).toMatchObject({ kind: "tabset" });
  return node as WindowFrameTabsetNode;
}

function expectPersistedSplit(node: unknown): WindowFrameSplitNode {
  expect(node).toMatchObject({ kind: "split" });
  return node as WindowFrameSplitNode;
}

function expectPersistedTabset(node: unknown): {
  readonly tabs: readonly string[];
  readonly activeTabId: string;
} {
  expect(node).toMatchObject({ kind: "tabset" });
  return node as { readonly tabs: readonly string[]; readonly activeTabId: string };
}

function getPersistedViewKeyForTest(view: PersistedWindowWorkspaceViewDescriptor): string {
  return view.typeKey;
}

function expectValidFrameLayout(layout: WindowWorkspaceFrameLayout): void {
  const visibleViewKeys = new Set<string>();

  for (const frame of layout.frames) {
    visitDockNode(frame.root, layout, visibleViewKeys);
  }

  expect(Object.keys(layout.views).sort()).toEqual([...visibleViewKeys].sort());
  for (const hiddenViewKey of layout.hiddenViewKeys) {
    expect(visibleViewKeys.has(hiddenViewKey)).toBe(false);
  }
}

function visitDockNode(
  node: WindowFrameDockNode,
  layout: WindowWorkspaceFrameLayout,
  visibleViewKeys: Set<string>
): void {
  if (node.kind === "tabset") {
    expect(node.tabs.length).toBeGreaterThan(0);
    expect(node.tabs.includes(node.activeTabId)).toBe(true);
    expect(new Set(node.tabs).size).toBe(node.tabs.length);
    for (const viewKey of node.tabs) {
      expect(layout.views[viewKey]).toBeDefined();
      expect(visibleViewKeys.has(viewKey)).toBe(false);
      visibleViewKeys.add(viewKey);
    }
    return;
  }
  expect(node.ratio).toBeGreaterThanOrEqual(0.1);
  expect(node.ratio).toBeLessThanOrEqual(0.9);
  visitDockNode(node.first, layout, visibleViewKeys);
  visitDockNode(node.second, layout, visibleViewKeys);
}

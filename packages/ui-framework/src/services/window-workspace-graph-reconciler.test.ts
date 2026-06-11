import { describe, expect, it } from "vitest";
import {
  createWindowWorkspaceGraphCommit,
  createWindowWorkspaceGraphSnapshot,
  createWindowWorkspaceRealizationMap,
  reconcileWindowWorkspaceGraphTransaction,
  reconcileWindowWorkspaceGraphCommit,
  windowWorkspaceContentId,
  windowWorkspaceFrameId,
  windowWorkspaceSplitId,
  windowWorkspaceTabsetId,
  type WindowFrameSurfaceSnapshot,
  type WindowRegisteredContent,
  type WindowWorkspaceGraphContentInput,
  type WindowWorkspaceGraphInput,
  type WindowWorkspaceGraphReconcilerSurface,
  type WindowWorkspaceGraphSnapshot,
  type WindowWorkspaceSurfaceGeometryProjection
} from "..";
import { createWindowViewIdentity, windowViewInstanceId, windowViewTypeKey } from "../model/window-view-identity";
import { windowViewKey } from "../model/window-view-key";

const sceneIdentity = createWindowViewIdentity({
  viewKey: windowViewKey("scene"),
  typeKey: windowViewTypeKey("scene"),
  instanceId: windowViewInstanceId("scene:default")
});
const debugIdentity = createWindowViewIdentity({
  viewKey: windowViewKey("debug"),
  typeKey: windowViewTypeKey("debug"),
  instanceId: windowViewInstanceId("debug:default")
});
const sceneContentId = windowWorkspaceContentId("content:scene");
const debugContentId = windowWorkspaceContentId("content:debug");
const frameId = windowWorkspaceFrameId("frame:root");
const sceneTabsetId = windowWorkspaceTabsetId("tabset:scene");
const debugTabsetId = windowWorkspaceTabsetId("tabset:debug");

describe("WindowWorkspaceGraphReconciler", () => {
  it("projects graph placement into explicit frame snapshots and content placements", () => {
    const { previous, next, contents } = createSplitSnapshots();
    const commit = createWindowWorkspaceGraphCommit({ previous, next });
    const realization = createWindowWorkspaceRealizationMap<WindowRegisteredContent, FakeSurface>();
    const sceneContent = createContent("content:scene");
    const debugContent = createContent("content:debug");
    const surface = new FakeSurface(frameId);

    realization.setContent(sceneContentId, sceneContent);
    realization.setContent(debugContentId, debugContent);
    realization.setViewActorId(sceneIdentity, "scene-view-actor");
    realization.setViewActorId(debugIdentity, "debug-view-actor");
    realization.setFrameSurface(frameId, surface);

    const result = reconcileWindowWorkspaceGraphCommit({
      commit,
      realization: realization.map,
      getTitle: (identity) => contents.find((content) => content.identity === identity)?.contentId
    });

    expect(result.issues).toEqual([]);
    expect(surface.snapshots).toHaveLength(1);
    expect(surface.snapshots[0]).toMatchObject({
      frameId,
      kind: "persistent",
      presentation: "windowed",
      visible: true,
      stackPriority: 1,
      revision: 2
    });
    expect(surface.snapshots[0]?.root).toMatchObject({
      kind: "split",
      first: {
        kind: "tabset",
        id: sceneTabsetId,
        tabs: [{
          contentId: sceneContentId,
          viewActorId: "scene-view-actor",
          active: true
        }]
      },
      second: {
        kind: "tabset",
        id: debugTabsetId,
        tabs: [{
          contentId: debugContentId,
          viewActorId: "debug-view-actor",
          active: true
        }]
      }
    });
    expect(surface.placements.map((placement) => placement.content.contentId)).toEqual([
      sceneContentId,
      debugContentId
    ]);
    expect(surface.placements.map((placement) => placement.placement.tabsetId)).toEqual([
      sceneTabsetId,
      debugTabsetId
    ]);
    expect(result.surfaceGeometries).toEqual([{
      frameId,
      revision: 2,
      tabsets: [{
        tabsetId: sceneTabsetId,
        contentIds: [sceneContentId],
        tabBounds: { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24 },
        contentBounds: { left: 0, top: 24, right: 100, bottom: 100, width: 100, height: 76 }
      }, {
        tabsetId: debugTabsetId,
        contentIds: [debugContentId],
        tabBounds: { left: 100, top: 0, right: 200, bottom: 24, width: 100, height: 24 },
        contentBounds: { left: 100, top: 24, right: 200, bottom: 100, width: 100, height: 76 }
      }],
      splitters: [{
        splitId: windowWorkspaceSplitId("split:main"),
        direction: "vertical",
        rect: { left: 96, top: 0, right: 104, bottom: 100, width: 8, height: 100 }
      }],
      issues: []
    }]);
  });

  it("fails closed when a content registration is missing", () => {
    const { previous, next } = createSplitSnapshots();
    const commit = createWindowWorkspaceGraphCommit({ previous, next });
    const realization = createWindowWorkspaceRealizationMap<WindowRegisteredContent, FakeSurface>();
    const surface = new FakeSurface(frameId);

    realization.setContent(sceneContentId, createContent("content:scene"));
    realization.setViewActorId(sceneIdentity, "scene-view-actor");
    realization.setViewActorId(debugIdentity, "debug-view-actor");
    realization.setFrameSurface(frameId, surface);

    const result = reconcileWindowWorkspaceGraphCommit({ commit, realization: realization.map });

    expect(result.issues).toContainEqual({
      severity: "hard",
      code: "missing-content",
      message: "content content:debug is not registered"
    });
    expect(surface.snapshots).toHaveLength(0);
    expect(surface.placements).toEqual([]);
  });

  it("does not partially render a tabset when one content registration is missing", () => {
    const { previous, next } = createMergedSnapshots();
    const commit = createWindowWorkspaceGraphCommit({ previous, next });
    const realization = createWindowWorkspaceRealizationMap<WindowRegisteredContent, FakeSurface>();
    const surface = new FakeSurface(frameId);

    realization.setContent(sceneContentId, createContent("content:scene"));
    realization.setViewActorId(sceneIdentity, "scene-view-actor");
    realization.setViewActorId(debugIdentity, "debug-view-actor");
    realization.setFrameSurface(frameId, surface);

    const result = reconcileWindowWorkspaceGraphCommit({ commit, realization: realization.map });

    expect(result.issues).toContainEqual({
      severity: "hard",
      code: "missing-content",
      message: "content content:debug is not registered"
    });
    expect(result.frameSnapshots).toHaveLength(1);
    expect(result.surfaceGeometries).toEqual([]);
    expect(surface.snapshots).toHaveLength(0);
    expect(surface.placements).toEqual([]);
  });

  it("reports geometry issues as soft projection issues", () => {
    const { previous, next, contents } = createSplitSnapshots();
    const commit = createWindowWorkspaceGraphCommit({ previous, next });
    const realization = createWindowWorkspaceRealizationMap<WindowRegisteredContent, FakeSurface>();
    const sceneContent = createContent("content:scene");
    const debugContent = createContent("content:debug");
    const surface = new FakeSurface(frameId, {
      geometryIssues: [{
        code: "missing-splitter",
        message: "splitter split:main was not rendered"
      }]
    });

    realization.setContent(sceneContentId, sceneContent);
    realization.setContent(debugContentId, debugContent);
    realization.setViewActorId(sceneIdentity, "scene-view-actor");
    realization.setViewActorId(debugIdentity, "debug-view-actor");
    realization.setFrameSurface(frameId, surface);

    const result = reconcileWindowWorkspaceGraphCommit({
      commit,
      realization: realization.map,
      getTitle: (identity) => contents.find((content) => content.identity === identity)?.contentId
    });

    expect(result.issues).toContainEqual({
      severity: "soft",
      code: "missing-surface-geometry",
      message: "splitter split:main was not rendered"
    });
    expect(surface.snapshots).toHaveLength(1);
    expect(surface.placements.map((placement) => placement.content.contentId)).toEqual([
      sceneContentId,
      debugContentId
    ]);
  });

  it("rolls graph transaction result back when reconcile reports hard issues", () => {
    const { next } = createSplitSnapshots();
    const realization = createWindowWorkspaceRealizationMap<WindowRegisteredContent, FakeSurface>();
    const surface = new FakeSurface(frameId);

    realization.setContent(sceneContentId, createContent("content:scene"));
    realization.setViewActorId(sceneIdentity, "scene-view-actor");
    realization.setViewActorId(debugIdentity, "debug-view-actor");
    realization.setFrameSurface(frameId, surface);

    const result = reconcileWindowWorkspaceGraphTransaction({
      snapshot: next,
      transaction: {
        kind: "resize-split",
        splitId: windowWorkspaceSplitId("split:main"),
        ratio: 0.6
      },
      realization: realization.map
    });

    expect(result.committed).toBe(false);
    expect(result.nextSnapshot).toBe(next);
    expect(result.rollbackSnapshot).toBe(next);
    expect(result.hardIssues).toContainEqual({
      severity: "hard",
      code: "missing-content",
      message: "content content:debug is not registered"
    });
    expect(surface.snapshots).toHaveLength(0);
    expect(surface.placements).toEqual([]);
  });

  it("keeps graph transaction committed when reconcile reports only soft issues", () => {
    const { next } = createSplitSnapshots();
    const realization = createWindowWorkspaceRealizationMap<WindowRegisteredContent, FakeSurface>();
    const surface = new FakeSurface(frameId, {
      geometryIssues: [{
        code: "missing-splitter",
        message: "splitter split:main was not rendered"
      }]
    });

    realization.setContent(sceneContentId, createContent("content:scene"));
    realization.setContent(debugContentId, createContent("content:debug"));
    realization.setViewActorId(sceneIdentity, "scene-view-actor");
    realization.setViewActorId(debugIdentity, "debug-view-actor");
    realization.setFrameSurface(frameId, surface);

    const result = reconcileWindowWorkspaceGraphTransaction({
      snapshot: next,
      transaction: {
        kind: "resize-split",
        splitId: windowWorkspaceSplitId("split:main"),
        ratio: 0.6
      },
      realization: realization.map
    });

    expect(result.committed).toBe(true);
    expect(result.softIssues).toContainEqual({
      severity: "soft",
      code: "missing-surface-geometry",
      message: "splitter split:main was not rendered"
    });
    expect(result.nextSnapshot.frames[0]?.root).toMatchObject({
      kind: "split",
      ratio: 0.6
    });
    expect(surface.placements.map((placement) => placement.content.contentId)).toEqual([
      sceneContentId,
      debugContentId
    ]);
  });
});

function createSplitSnapshots(): {
  readonly previous: WindowWorkspaceGraphSnapshot;
  readonly next: WindowWorkspaceGraphSnapshot;
  readonly contents: readonly WindowWorkspaceGraphContentInput[];
} {
  const contents = [
    { contentId: sceneContentId, identity: sceneIdentity },
    { contentId: debugContentId, identity: debugIdentity }
  ];
  const previous = createWindowWorkspaceGraphSnapshot({
    revision: 1,
    contents,
    frames: [{
      frameId,
      kind: "persistent",
      presentation: "windowed",
      visible: false,
      stackPriority: 1,
      root: {
        kind: "split",
        id: windowWorkspaceSplitId("split:main"),
        direction: "vertical",
        ratio: 0.7,
        first: {
          kind: "tabset",
          id: sceneTabsetId,
          contentIds: [sceneContentId],
          activeContentId: sceneContentId
        },
        second: {
          kind: "tabset",
          id: debugTabsetId,
          contentIds: [debugContentId],
          activeContentId: debugContentId
        }
      }
    }]
  });
  const nextInput: WindowWorkspaceGraphInput = {
    revision: 2,
    contents,
    frames: [{
      frameId,
      kind: "persistent",
      presentation: "windowed",
      visible: true,
      stackPriority: 1,
      root: {
        kind: "split",
        id: windowWorkspaceSplitId("split:main"),
        direction: "vertical",
        ratio: 0.7,
        first: {
          kind: "tabset",
          id: sceneTabsetId,
          contentIds: [sceneContentId],
          activeContentId: sceneContentId
        },
        second: {
          kind: "tabset",
          id: debugTabsetId,
          contentIds: [debugContentId],
          activeContentId: debugContentId
        }
      }
    }]
  };
  return {
    previous,
    next: createWindowWorkspaceGraphSnapshot(nextInput),
    contents
  };
}

function createMergedSnapshots(): {
  readonly previous: WindowWorkspaceGraphSnapshot;
  readonly next: WindowWorkspaceGraphSnapshot;
} {
  const contents = [
    { contentId: sceneContentId, identity: sceneIdentity },
    { contentId: debugContentId, identity: debugIdentity }
  ];
  const previous = createWindowWorkspaceGraphSnapshot({
    revision: 1,
    contents,
    frames: [{
      frameId,
      kind: "persistent",
      presentation: "windowed",
      visible: false,
      stackPriority: 1,
      root: {
        kind: "tabset",
        id: sceneTabsetId,
        contentIds: [sceneContentId, debugContentId],
        activeContentId: sceneContentId
      }
    }]
  });
  const next = createWindowWorkspaceGraphSnapshot({
    revision: 2,
    contents,
    frames: [{
      frameId,
      kind: "persistent",
      presentation: "windowed",
      visible: true,
      stackPriority: 1,
      root: {
        kind: "tabset",
        id: sceneTabsetId,
        contentIds: [sceneContentId, debugContentId],
        activeContentId: sceneContentId
      }
    }]
  });
  return { previous, next };
}

function createContent(contentId: string): WindowRegisteredContent {
  return {
    contentId,
    element: {} as HTMLElement,
    interactable: true,
    setInteractable() {},
    subscribeLayoutCommit() {
      return { dispose() {} };
    },
    dispose() {}
  } as WindowRegisteredContent;
}

class FakeSurface implements WindowWorkspaceGraphReconcilerSurface<WindowRegisteredContent> {
  readonly snapshots: WindowFrameSurfaceSnapshot[] = [];
  readonly placements: Array<{
    readonly content: WindowRegisteredContent;
    readonly placement: Parameters<WindowWorkspaceGraphReconcilerSurface<WindowRegisteredContent>["placeContent"]>[0]["placement"];
  }> = [];

  constructor(
    readonly frameId: string,
    private readonly options: {
      readonly geometryIssues?: readonly WindowWorkspaceSurfaceGeometryProjection["issues"][number][];
    } = {}
  ) {}

  renderFrameSurface(snapshot: WindowFrameSurfaceSnapshot): void {
    this.snapshots.push(snapshot);
  }

  measureFrameSurfaceGeometry(snapshot: WindowFrameSurfaceSnapshot): WindowWorkspaceSurfaceGeometryProjection {
    const [first, second] = snapshot.root.kind === "split"
      ? [snapshot.root.first, snapshot.root.second]
      : [snapshot.root, null];
    return {
      frameId: snapshot.frameId,
      revision: snapshot.revision,
      tabsets: [
        ...(first?.kind === "tabset"
          ? [{
              tabsetId: first.id,
              contentIds: first.tabs.map((tab) => tab.contentId),
              tabBounds: { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24 },
              contentBounds: { left: 0, top: 24, right: 100, bottom: 100, width: 100, height: 76 }
            }]
          : []),
        ...(second?.kind === "tabset"
          ? [{
              tabsetId: second.id,
              contentIds: second.tabs.map((tab) => tab.contentId),
              tabBounds: { left: 100, top: 0, right: 200, bottom: 24, width: 100, height: 24 },
              contentBounds: { left: 100, top: 24, right: 200, bottom: 100, width: 100, height: 76 }
            }]
          : [])
      ],
      splitters: snapshot.root.kind === "split"
        ? [{
            splitId: snapshot.root.id,
            direction: snapshot.root.direction,
            rect: { left: 96, top: 0, right: 104, bottom: 100, width: 8, height: 100 }
          }]
        : [],
      issues: this.options.geometryIssues ?? []
    };
  }

  placeContent(placement: Parameters<WindowWorkspaceGraphReconcilerSurface<WindowRegisteredContent>["placeContent"]>[0]): void {
    this.placements.push(placement);
  }
}

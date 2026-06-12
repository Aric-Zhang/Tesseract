import { describe, expect, it } from "vitest";
import {
  createWindowWorkspaceContentId,
  createWindowWorkspaceGraphCommit,
  createWindowWorkspaceGraphSnapshot,
  createWindowWorkspaceRealizationMap,
  reduceWindowWorkspaceGraphTransaction,
  windowWorkspaceContentId,
  windowWorkspaceFrameId,
  windowWorkspaceSplitId,
  windowWorkspaceTabsetId,
  WindowWorkspaceGraphInvariantError
} from "./window-workspace-graph";
import { createWindowViewIdentity, windowViewInstanceId, windowViewTypeKey } from "./window-view-identity";
import { windowViewKey } from "./window-view-key";

describe("WindowWorkspaceGraph", () => {
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
  const topTabsetId = windowWorkspaceTabsetId("tabset:top");
  const bottomTabsetId = windowWorkspaceTabsetId("tabset:bottom");

  it("derives placements from one logical graph without runtime actor handles", () => {
    const snapshot = createWindowWorkspaceGraphSnapshot({
      revision: 3,
      contents: [
        { contentId: sceneContentId, identity: sceneIdentity },
        { contentId: debugContentId, identity: debugIdentity }
      ],
      frames: [{
        frameId,
        kind: "persistent",
        presentation: "windowed",
        visible: true,
        stackPriority: 10,
        root: {
          kind: "split",
          id: windowWorkspaceSplitId("split:center"),
          direction: "vertical",
          ratio: 0.7,
          first: {
            kind: "tabset",
            id: topTabsetId,
            contentIds: [sceneContentId],
            activeContentId: sceneContentId
          },
          second: {
            kind: "tabset",
            id: bottomTabsetId,
            contentIds: [debugContentId],
            activeContentId: debugContentId
          }
        }
      }]
    });

    expect(snapshot.placements).toEqual([
      {
        contentId: sceneContentId,
        identity: sceneIdentity,
        frameId,
        tabsetId: topTabsetId,
        active: true,
        interactable: true
      },
      {
        contentId: debugContentId,
        identity: debugIdentity,
        frameId,
        tabsetId: bottomTabsetId,
        active: true,
        interactable: true
      }
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("viewActorId");
    expect(JSON.stringify(snapshot)).not.toContain("frameActorId");
    expect(JSON.stringify(snapshot)).not.toContain("actorId");
  });

  it("derives stable logical content ids from view identity without actor handles", () => {
    const inspectorA = createWindowViewIdentity({
      viewKey: windowViewKey("inspector:a"),
      typeKey: windowViewTypeKey("inspector"),
      instanceId: windowViewInstanceId("inspector:a"),
      multiplicity: "multi-instance"
    });
    const inspectorB = createWindowViewIdentity({
      viewKey: windowViewKey("inspector:b"),
      typeKey: windowViewTypeKey("inspector"),
      instanceId: windowViewInstanceId("inspector:b"),
      multiplicity: "multi-instance"
    });

    expect(createWindowWorkspaceContentId(sceneIdentity))
      .toBe(createWindowWorkspaceContentId({
        ...sceneIdentity,
        viewKey: windowViewKey("scene-runtime-actor-id-should-not-matter")
      }));
    expect(createWindowWorkspaceContentId(inspectorA)).not.toBe(createWindowWorkspaceContentId(inspectorB));
    expect(createWindowWorkspaceContentId(sceneIdentity)).not.toContain("viewActorId");
    expect(createWindowWorkspaceContentId(sceneIdentity)).not.toContain("actorId");
  });

  it("rejects duplicate, unknown, and invalid active content instead of guessing placement", () => {
    expect(() => createWindowWorkspaceGraphSnapshot({
      contents: [
        { contentId: sceneContentId, identity: sceneIdentity },
        { contentId: debugContentId, identity: debugIdentity }
      ],
      frames: [{
        frameId,
        kind: "persistent",
        presentation: "windowed",
        visible: true,
        stackPriority: 1,
        root: {
          kind: "split",
          id: windowWorkspaceSplitId("split:bad"),
          direction: "vertical",
          ratio: 0.5,
          first: {
            kind: "tabset",
            id: topTabsetId,
            contentIds: [sceneContentId, debugContentId],
            activeContentId: windowWorkspaceContentId("content:missing")
          },
          second: {
            kind: "tabset",
            id: bottomTabsetId,
            contentIds: [debugContentId, windowWorkspaceContentId("content:unknown")],
            activeContentId: debugContentId
          }
        }
      }]
    })).toThrowError(WindowWorkspaceGraphInvariantError);
  });

  it("keeps runtime realization handles outside the logical graph", () => {
    const realization = createWindowWorkspaceRealizationMap<object, object>();
    const contentElement = {};
    const surface = {};

    realization.setViewActorId(sceneIdentity, "scene-view-actor");
    realization.setContent(sceneContentId, contentElement);
    realization.setFrameSurface(frameId, surface);

    expect(realization.map.getViewActorId(sceneIdentity)).toBe("scene-view-actor");
    expect(realization.map.getContent(sceneContentId)).toBe(contentElement);
    expect(realization.map.getFrameSurface(frameId)).toBe(surface);

    realization.setViewActorId(sceneIdentity, null);
    realization.setContent(sceneContentId, null);
    realization.setFrameSurface(frameId, null);

    expect(realization.map.getViewActorId(sceneIdentity)).toBeNull();
    expect(realization.map.getContent(sceneContentId)).toBeNull();
    expect(realization.map.getFrameSurface(frameId)).toBeNull();
  });

  it("reports graph commit changes without mutating prior snapshots", () => {
    const previous = createWindowWorkspaceGraphSnapshot({
      revision: 1,
      contents: [{ contentId: sceneContentId, identity: sceneIdentity }],
      frames: [{
        frameId,
        kind: "persistent",
        presentation: "windowed",
        visible: true,
        stackPriority: 1,
        root: {
          kind: "tabset",
          id: topTabsetId,
          contentIds: [sceneContentId],
          activeContentId: sceneContentId
        }
      }]
    });
    const next = createWindowWorkspaceGraphSnapshot({
      revision: 2,
      contents: [{ contentId: sceneContentId, identity: sceneIdentity }],
      frames: [{
        frameId,
        kind: "persistent",
        presentation: "windowed",
        visible: false,
        stackPriority: 1,
        root: previous.frames[0]!.root
      }]
    });

    expect(createWindowWorkspaceGraphCommit({ previous, next })).toMatchObject({
      previousRevision: 1,
      nextRevision: 2,
      changedPlacements: [{
        contentId: sceneContentId,
        active: true,
        interactable: false
      }],
      createdFrameIds: [],
      removedFrameIds: []
    });
    expect(previous.placements[0]?.interactable).toBe(true);
  });

  it("activates content by changing only its owning tabset active content", () => {
    const snapshot = createWindowWorkspaceGraphSnapshot({
      revision: 1,
      contents: [
        { contentId: sceneContentId, identity: sceneIdentity },
        { contentId: debugContentId, identity: debugIdentity }
      ],
      frames: [{
        frameId,
        kind: "persistent",
        presentation: "windowed",
        visible: true,
        stackPriority: 1,
        root: {
          kind: "tabset",
          id: topTabsetId,
          contentIds: [sceneContentId, debugContentId],
          activeContentId: sceneContentId
        }
      }]
    });

    const result = reduceWindowWorkspaceGraphTransaction({
      snapshot,
      transaction: { kind: "activate-content", contentId: debugContentId }
    });

    expect(result.committed).toBe(true);
    expect(result.nextSnapshot.revision).toBe(2);
    expect(result.nextSnapshot.placements.map((placement) => ({
      contentId: placement.contentId,
      active: placement.active,
      interactable: placement.interactable
    }))).toEqual([
      { contentId: sceneContentId, active: false, interactable: false },
      { contentId: debugContentId, active: true, interactable: true }
    ]);
    expect(snapshot.placements[0]?.active).toBe(true);
  });

  it("closes content and collapses empty split branches without leaving duplicate placement", () => {
    const snapshot = createWindowWorkspaceGraphSnapshot({
      revision: 1,
      contents: [
        { contentId: sceneContentId, identity: sceneIdentity },
        { contentId: debugContentId, identity: debugIdentity }
      ],
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
            id: topTabsetId,
            contentIds: [sceneContentId],
            activeContentId: sceneContentId
          },
          second: {
            kind: "tabset",
            id: bottomTabsetId,
            contentIds: [debugContentId],
            activeContentId: debugContentId
          }
        }
      }]
    });

    const result = reduceWindowWorkspaceGraphTransaction({
      snapshot,
      transaction: { kind: "close-content", contentId: debugContentId }
    });

    expect(result.committed).toBe(true);
    expect(result.warnings).toContain("collapsed split split:main after removing empty second branch");
    expect(result.nextSnapshot.frames[0]?.root).toEqual({
      kind: "tabset",
      id: topTabsetId,
      contentIds: [sceneContentId],
      activeContentId: sceneContentId
    });
    expect(result.nextSnapshot.placements.map((placement) => placement.contentId)).toEqual([sceneContentId]);
  });

  it("resizes split ratios as pure graph transactions", () => {
    const snapshot = createWindowWorkspaceGraphSnapshot({
      revision: 1,
      contents: [
        { contentId: sceneContentId, identity: sceneIdentity },
        { contentId: debugContentId, identity: debugIdentity }
      ],
      frames: [{
        frameId,
        kind: "persistent",
        presentation: "windowed",
        visible: true,
        stackPriority: 1,
        root: {
          kind: "split",
          id: windowWorkspaceSplitId("split:main"),
          direction: "horizontal",
          ratio: 0.4,
          first: {
            kind: "tabset",
            id: topTabsetId,
            contentIds: [sceneContentId],
            activeContentId: sceneContentId
          },
          second: {
            kind: "tabset",
            id: bottomTabsetId,
            contentIds: [debugContentId],
            activeContentId: debugContentId
          }
        }
      }]
    });

    const result = reduceWindowWorkspaceGraphTransaction({
      snapshot,
      transaction: {
        kind: "resize-split",
        splitId: windowWorkspaceSplitId("split:main"),
        ratio: 0.6
      }
    });

    expect(result.committed).toBe(true);
    expect(result.nextSnapshot.frames[0]?.root).toMatchObject({
      kind: "split",
      ratio: 0.6
    });
  });

  it("splits into a sibling tabset after the source branch releases derived dock ids", () => {
    const targetTabsetId = windowWorkspaceTabsetId("tabset:scene:tabset:content:debug");
    const sourceTabsetId = windowWorkspaceTabsetId("tabset:scene:tabset:content:debug:tabset:content:debug");
    const sourceSplitId = windowWorkspaceSplitId("tabset:scene:tabset:content:debug:split:content:debug");
    const snapshot = createWindowWorkspaceGraphSnapshot({
      revision: 1,
      contents: [
        { contentId: sceneContentId, identity: sceneIdentity },
        { contentId: debugContentId, identity: debugIdentity }
      ],
      frames: [{
        frameId,
        kind: "persistent",
        presentation: "windowed",
        visible: true,
        stackPriority: 1,
        root: {
          kind: "split",
          id: sourceSplitId,
          direction: "horizontal",
          ratio: 0.5,
          first: {
            kind: "tabset",
            id: sourceTabsetId,
            contentIds: [debugContentId],
            activeContentId: debugContentId
          },
          second: {
            kind: "tabset",
            id: targetTabsetId,
            contentIds: [sceneContentId],
            activeContentId: sceneContentId
          }
        }
      }]
    });

    const result = reduceWindowWorkspaceGraphTransaction({
      snapshot,
      transaction: {
        kind: "split-content",
        contentId: debugContentId,
        targetFrameId: frameId,
        targetTabsetId,
        placement: "bottom"
      }
    });

    expect(result.committed).toBe(true);
    expect(result.nextSnapshot.frames[0]?.root).toMatchObject({
      kind: "split",
      id: sourceSplitId,
      direction: "vertical",
      first: {
        kind: "tabset",
        id: targetTabsetId,
        contentIds: [sceneContentId]
      },
      second: {
        kind: "tabset",
        id: sourceTabsetId,
        contentIds: [debugContentId]
      }
    });
    expect(result.warnings).toContain(`collapsed split ${sourceSplitId} after removing empty first branch`);
  });

  it("fails closed when asked to split a single tab into itself", () => {
    const snapshot = createWindowWorkspaceGraphSnapshot({
      revision: 1,
      contents: [{ contentId: sceneContentId, identity: sceneIdentity }],
      frames: [{
        frameId,
        kind: "persistent",
        presentation: "windowed",
        visible: true,
        stackPriority: 1,
        root: {
          kind: "tabset",
          id: topTabsetId,
          contentIds: [sceneContentId],
          activeContentId: sceneContentId
        }
      }]
    });

    const result = reduceWindowWorkspaceGraphTransaction({
      snapshot,
      transaction: {
        kind: "split-content",
        contentId: sceneContentId,
        targetFrameId: frameId,
        targetTabsetId: topTabsetId,
        placement: "bottom"
      }
    });

    expect(result).toMatchObject({
      committed: false,
      nextSnapshot: snapshot,
      rollbackSnapshot: snapshot
    });
    expect(result.warnings[0]).toContain("cannot split single content");
  });
});

import type { WindowFramePresentation } from "./window-frame-tab";
import type { WindowDockSplitPlacement } from "./window-dock-targets";
import type { WindowViewIdentity } from "./window-view-identity";
import { createWindowViewIdentityKey } from "./window-view-identity";

export type WindowWorkspaceFrameId = string & { readonly __windowWorkspaceFrameIdBrand: "WindowWorkspaceFrameId" };
export type WindowWorkspaceContentId = string & { readonly __windowWorkspaceContentIdBrand: "WindowWorkspaceContentId" };
export type WindowWorkspaceTabsetId = string & { readonly __windowWorkspaceTabsetIdBrand: "WindowWorkspaceTabsetId" };
export type WindowWorkspaceSplitId = string & { readonly __windowWorkspaceSplitIdBrand: "WindowWorkspaceSplitId" };

export type WindowWorkspaceFrameKind = "persistent" | "runtime";
export type WindowWorkspaceGraphSplitDirection = "horizontal" | "vertical";

export interface WindowWorkspaceGraphContentInput {
  readonly contentId: WindowWorkspaceContentId;
  readonly identity: WindowViewIdentity;
}

export interface WindowWorkspaceGraphTabsetNode {
  readonly kind: "tabset";
  readonly id: WindowWorkspaceTabsetId;
  readonly contentIds: readonly WindowWorkspaceContentId[];
  readonly activeContentId: WindowWorkspaceContentId | null;
}

export interface WindowWorkspaceGraphSplitNode {
  readonly kind: "split";
  readonly id: WindowWorkspaceSplitId;
  readonly direction: WindowWorkspaceGraphSplitDirection;
  readonly ratio: number;
  readonly first: WindowWorkspaceGraphDockNode;
  readonly second: WindowWorkspaceGraphDockNode;
}

export type WindowWorkspaceGraphDockNode =
  | WindowWorkspaceGraphTabsetNode
  | WindowWorkspaceGraphSplitNode;

export interface WindowWorkspaceGraphFrameInput {
  readonly frameId: WindowWorkspaceFrameId;
  readonly kind: WindowWorkspaceFrameKind;
  readonly root: WindowWorkspaceGraphDockNode;
  readonly presentation: WindowFramePresentation;
  readonly visible: boolean;
  readonly stackPriority: number;
}

export interface WindowWorkspaceGraphFrameSnapshot extends WindowWorkspaceGraphFrameInput {}

export interface WindowWorkspaceGraphPlacement {
  readonly contentId: WindowWorkspaceContentId;
  readonly identity: WindowViewIdentity;
  readonly frameId: WindowWorkspaceFrameId;
  readonly tabsetId: WindowWorkspaceTabsetId;
  readonly active: boolean;
  readonly interactable: boolean;
}

export interface WindowWorkspaceGraphSnapshot {
  readonly revision: number;
  readonly frames: readonly WindowWorkspaceGraphFrameSnapshot[];
  readonly placements: readonly WindowWorkspaceGraphPlacement[];
}

export interface WindowWorkspaceGraphInput {
  readonly revision?: number;
  readonly contents: readonly WindowWorkspaceGraphContentInput[];
  readonly frames: readonly WindowWorkspaceGraphFrameInput[];
}

export interface WindowWorkspaceGraphCommit {
  readonly previousRevision: number;
  readonly nextRevision: number;
  readonly snapshot: WindowWorkspaceGraphSnapshot;
  readonly previousPlacements: readonly WindowWorkspaceGraphPlacement[];
  readonly changedPlacements: readonly WindowWorkspaceGraphPlacement[];
  readonly removedContentIds: readonly WindowWorkspaceContentId[];
  readonly createdFrameIds: readonly WindowWorkspaceFrameId[];
  readonly removedFrameIds: readonly WindowWorkspaceFrameId[];
}

export type WindowWorkspaceGraphTransaction =
  | { readonly kind: "activate-content"; readonly contentId: WindowWorkspaceContentId }
  | {
      readonly kind: "add-content";
      readonly content: WindowWorkspaceGraphContentInput;
      readonly targetFrameId: WindowWorkspaceFrameId;
      readonly targetTabsetId: WindowWorkspaceTabsetId;
      readonly active?: boolean;
    }
  | {
      readonly kind: "close-content";
      readonly contentId: WindowWorkspaceContentId;
      readonly preserveEmptyFrameIds?: readonly WindowWorkspaceFrameId[];
    }
  | { readonly kind: "close-frame"; readonly frameId: WindowWorkspaceFrameId }
  | {
      readonly kind: "move-content";
      readonly contentId: WindowWorkspaceContentId;
      readonly targetFrameId: WindowWorkspaceFrameId;
      readonly targetTabsetId: WindowWorkspaceTabsetId;
      readonly targetFrame?: WindowWorkspaceGraphFrameInput;
      readonly replaceTargetFrameIfMissingTabset?: boolean;
      readonly active?: boolean;
      readonly preserveEmptyFrameIds?: readonly WindowWorkspaceFrameId[];
    }
  | {
      readonly kind: "split-content";
      readonly contentId: WindowWorkspaceContentId;
      readonly targetFrameId: WindowWorkspaceFrameId;
      readonly targetTabsetId: WindowWorkspaceTabsetId;
      readonly targetFrame?: WindowWorkspaceGraphFrameInput;
      readonly placement: WindowDockSplitPlacement;
      readonly active?: boolean;
      readonly preserveEmptyFrameIds?: readonly WindowWorkspaceFrameId[];
    }
  | {
      readonly kind: "float-content";
      readonly contentId: WindowWorkspaceContentId;
      readonly content?: WindowWorkspaceGraphContentInput;
      readonly frameId: WindowWorkspaceFrameId;
      readonly tabsetId: WindowWorkspaceTabsetId;
      readonly kindOfFrame?: WindowWorkspaceFrameKind;
      readonly presentation?: WindowFramePresentation;
      readonly visible?: boolean;
      readonly stackPriority?: number;
      readonly preserveEmptyFrameIds?: readonly WindowWorkspaceFrameId[];
    }
  | { readonly kind: "resize-split"; readonly splitId: WindowWorkspaceSplitId; readonly ratio: number };

export interface WindowWorkspaceGraphTransactionResult {
  readonly committed: boolean;
  readonly previousSnapshot: WindowWorkspaceGraphSnapshot;
  readonly nextSnapshot: WindowWorkspaceGraphSnapshot;
  readonly commit: WindowWorkspaceGraphCommit | null;
  readonly changedContentIds: readonly WindowWorkspaceContentId[];
  readonly createdFrameIds: readonly WindowWorkspaceFrameId[];
  readonly removedFrameIds: readonly WindowWorkspaceFrameId[];
  readonly warnings: readonly string[];
  readonly rollbackSnapshot: WindowWorkspaceGraphSnapshot;
}

export interface WindowWorkspaceRealizationMap<TContent = unknown, TFrameSurface = unknown> {
  getViewActorId(identity: WindowViewIdentity): string | null;
  getContent(contentId: WindowWorkspaceContentId): TContent | null;
  getFrameSurface(frameId: WindowWorkspaceFrameId): TFrameSurface | null;
}

export class WindowWorkspaceGraphInvariantError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid WindowWorkspaceGraph: ${issues.join("; ")}`);
    this.name = "WindowWorkspaceGraphInvariantError";
    this.issues = [...issues];
  }
}

export function windowWorkspaceFrameId(value: string): WindowWorkspaceFrameId {
  return value as WindowWorkspaceFrameId;
}

export function windowWorkspaceContentId(value: string): WindowWorkspaceContentId {
  return value as WindowWorkspaceContentId;
}

export function createWindowWorkspaceContentId(identity: WindowViewIdentity): WindowWorkspaceContentId {
  return windowWorkspaceContentId(`content:${createWindowViewIdentityKey(identity)}`);
}

export function windowWorkspaceTabsetId(value: string): WindowWorkspaceTabsetId {
  return value as WindowWorkspaceTabsetId;
}

export function windowWorkspaceSplitId(value: string): WindowWorkspaceSplitId {
  return value as WindowWorkspaceSplitId;
}

export function createWindowWorkspaceGraphSnapshot(
  input: WindowWorkspaceGraphInput
): WindowWorkspaceGraphSnapshot {
  const issues: string[] = [];
  const contentsById = new Map<WindowWorkspaceContentId, WindowWorkspaceGraphContentInput>();
  const placements: WindowWorkspaceGraphPlacement[] = [];
  const seenFrameIds = new Set<WindowWorkspaceFrameId>();
  const seenDockNodeIds = new Set<string>();
  const seenContentPlacements = new Set<WindowWorkspaceContentId>();

  for (const content of input.contents) {
    if (contentsById.has(content.contentId)) {
      issues.push(`duplicate content id ${content.contentId}`);
      continue;
    }
    contentsById.set(content.contentId, content);
  }

  for (const frame of input.frames) {
    if (seenFrameIds.has(frame.frameId)) {
      issues.push(`duplicate frame id ${frame.frameId}`);
      continue;
    }
    seenFrameIds.add(frame.frameId);
    collectFramePlacements({
      frame,
      node: frame.root,
      contentsById,
      placements,
      issues,
      seenDockNodeIds,
      seenContentPlacements
    });
  }

  for (const contentId of contentsById.keys()) {
    if (!seenContentPlacements.has(contentId)) {
      issues.push(`unplaced content id ${contentId}`);
    }
  }

  if (issues.length > 0) {
    throw new WindowWorkspaceGraphInvariantError(issues);
  }

  return {
    revision: input.revision ?? 0,
    frames: input.frames.map(cloneFrameSnapshot),
    placements
  };
}

export function createWindowWorkspaceGraphCommit(options: {
  readonly previous: WindowWorkspaceGraphSnapshot;
  readonly next: WindowWorkspaceGraphSnapshot;
}): WindowWorkspaceGraphCommit {
  const previousPlacements = new Map(
    options.previous.placements.map((placement) => [placement.contentId, placement])
  );
  const nextPlacements = new Set(options.next.placements.map((placement) => placement.contentId));
  const changedPlacements = options.next.placements.filter((placement) => {
    const previous = previousPlacements.get(placement.contentId);
    return !previous ||
      previous.frameId !== placement.frameId ||
      previous.tabsetId !== placement.tabsetId ||
      previous.active !== placement.active ||
      previous.interactable !== placement.interactable;
  });
  const previousFrameIds = new Set(options.previous.frames.map((frame) => frame.frameId));
  const nextFrameIds = new Set(options.next.frames.map((frame) => frame.frameId));

  return {
    previousRevision: options.previous.revision,
    nextRevision: options.next.revision,
    snapshot: options.next,
    previousPlacements: options.previous.placements,
    changedPlacements,
    removedContentIds: options.previous.placements
      .map((placement) => placement.contentId)
      .filter((contentId) => !nextPlacements.has(contentId)),
    createdFrameIds: options.next.frames
      .map((frame) => frame.frameId)
      .filter((frameId) => !previousFrameIds.has(frameId)),
    removedFrameIds: options.previous.frames
      .map((frame) => frame.frameId)
      .filter((frameId) => !nextFrameIds.has(frameId))
  };
}

export function reduceWindowWorkspaceGraphTransaction(options: {
  readonly snapshot: WindowWorkspaceGraphSnapshot;
  readonly transaction: WindowWorkspaceGraphTransaction;
}): WindowWorkspaceGraphTransactionResult {
  const previous = options.snapshot;
  const transaction = options.transaction;
  const warnings: string[] = [];
  const nextInput = graphInputFromSnapshot(previous);
  const content = new Set(nextInput.contents.map((entry) => entry.contentId));
  const finish = (nextFrames = nextInput.frames, nextContents = nextInput.contents): WindowWorkspaceGraphTransactionResult => {
    const next = createWindowWorkspaceGraphSnapshot({
      revision: previous.revision + 1,
      contents: nextContents,
      frames: nextFrames
    });
    const commit = createWindowWorkspaceGraphCommit({ previous, next });
    return {
      committed: true,
      previousSnapshot: previous,
      nextSnapshot: next,
      commit,
      changedContentIds: commit.changedPlacements.map((placement) => placement.contentId),
      createdFrameIds: commit.createdFrameIds,
      removedFrameIds: commit.removedFrameIds,
      warnings,
      rollbackSnapshot: previous
    };
  };
  const noCommit = (warning: string): WindowWorkspaceGraphTransactionResult => ({
    committed: false,
    previousSnapshot: previous,
    nextSnapshot: previous,
    commit: null,
    changedContentIds: [],
    createdFrameIds: [],
    removedFrameIds: [],
    warnings: [warning],
    rollbackSnapshot: previous
  });

  switch (transaction.kind) {
    case "add-content": {
      if (content.has(transaction.content.contentId)) {
        return noCommit(`cannot add duplicate content ${transaction.content.contentId}`);
      }
      const targetTabset = findTabset(nextInput.frames, transaction.targetFrameId, transaction.targetTabsetId);
      if (!targetTabset) {
        return noCommit(`cannot add content to unknown tabset ${transaction.targetTabsetId}`);
      }
      const frames = nextInput.frames.map((frame) => frame.frameId === transaction.targetFrameId
        ? {
            ...frame,
            root: addContentToTabset(
              frame.root,
              transaction.targetTabsetId,
              transaction.content.contentId,
              transaction.active ?? true
            )
          }
        : frame);
      return finish(frames, [...nextInput.contents, transaction.content]);
    }
    case "activate-content": {
      if (!content.has(transaction.contentId)) {
        return noCommit(`cannot activate unknown content ${transaction.contentId}`);
      }
      const frames = nextInput.frames.map((frame) => ({
        ...frame,
        root: setActiveContent(frame.root, transaction.contentId)
      }));
      return finish(frames);
    }
    case "close-content": {
      if (!content.has(transaction.contentId)) {
        return noCommit(`cannot close unknown content ${transaction.contentId}`);
      }
      const contents = nextInput.contents.filter((entry) => entry.contentId !== transaction.contentId);
      const frames = removeEmptyFrames(removeContentFromFrames(
        nextInput.frames,
        transaction.contentId,
        warnings,
        new Set(transaction.preserveEmptyFrameIds ?? [])
      ));
      return finish(frames, contents);
    }
    case "close-frame": {
      if (!nextInput.frames.some((frame) => frame.frameId === transaction.frameId)) {
        return noCommit(`cannot close unknown frame ${transaction.frameId}`);
      }
      const removedContentIds = new Set(
        nextInput.frames
          .filter((frame) => frame.frameId === transaction.frameId)
          .flatMap((frame) => listContentIds(frame.root))
      );
      return finish(
        nextInput.frames.filter((frame) => frame.frameId !== transaction.frameId),
        nextInput.contents.filter((entry) => !removedContentIds.has(entry.contentId))
      );
    }
    case "move-content": {
      if (!content.has(transaction.contentId)) {
        return noCommit(`cannot move unknown content ${transaction.contentId}`);
      }
      const transactionFrames = ensureTransactionTargetFrame(
        nextInput.frames,
        transaction.targetFrameId,
        transaction.targetFrame,
        transaction.targetTabsetId,
        transaction.replaceTargetFrameIfMissingTabset
      );
      const targetTabset = findTabset(transactionFrames, transaction.targetFrameId, transaction.targetTabsetId);
      if (!targetTabset) {
        return noCommit(`cannot move content to unknown tabset ${transaction.targetTabsetId}`);
      }
      const currentPlacement = previous.placements.find((placement) => placement.contentId === transaction.contentId);
      if (
        currentPlacement?.frameId === transaction.targetFrameId &&
        currentPlacement.tabsetId === transaction.targetTabsetId
      ) {
        return noCommit(`content ${transaction.contentId} is already in target tabset ${transaction.targetTabsetId}`);
      }
      const removed = removeContentFromFrames(
        transactionFrames,
        transaction.contentId,
        warnings,
        new Set(transaction.preserveEmptyFrameIds ?? [])
      );
      const frames = removed.map((frame) => frame.frameId === transaction.targetFrameId
        ? {
            ...frame,
            root: frame.root
              ? addContentToTabset(frame.root, transaction.targetTabsetId, transaction.contentId, transaction.active ?? true)
              : null
          }
        : frame);
      return finish(removeEmptyFrames(frames));
    }
    case "split-content": {
      if (!content.has(transaction.contentId)) {
        return noCommit(`cannot split unknown content ${transaction.contentId}`);
      }
      const transactionFrames = ensureTransactionTargetFrame(
        nextInput.frames,
        transaction.targetFrameId,
        transaction.targetFrame,
        transaction.targetTabsetId,
        false
      );
      const targetTabset = findTabset(transactionFrames, transaction.targetFrameId, transaction.targetTabsetId);
      if (!targetTabset) {
        return noCommit(`cannot split into unknown tabset ${transaction.targetTabsetId}`);
      }
      const currentPlacement = previous.placements.find((placement) => placement.contentId === transaction.contentId);
      if (
        currentPlacement?.frameId === transaction.targetFrameId &&
        currentPlacement.tabsetId === transaction.targetTabsetId &&
        targetTabset.contentIds.length === 1
      ) {
        return noCommit(`cannot split single content ${transaction.contentId} into its own tabset`);
      }
      const removed = removeContentFromFrames(
        transactionFrames,
        transaction.contentId,
        warnings,
        new Set(transaction.preserveEmptyFrameIds ?? [])
      );
      const framesAfterRemoval = removeEmptyFrames(removed);
      const targetFrameAfterRemoval = framesAfterRemoval.find((frame) => frame.frameId === transaction.targetFrameId);
      if (!targetFrameAfterRemoval || !findTabset(framesAfterRemoval, transaction.targetFrameId, transaction.targetTabsetId)) {
        return noCommit(`cannot split into unknown tabset ${transaction.targetTabsetId}`);
      }
      const allocatedTabsetId = allocateSplitTabsetId(
        targetFrameAfterRemoval.root,
        transaction.targetTabsetId,
        transaction.contentId
      );
      const allocatedSplitId = allocateSplitId(
        targetFrameAfterRemoval.root,
        transaction.targetTabsetId,
        transaction.contentId
      );
      const frames = framesAfterRemoval.map((frame) => frame.frameId === transaction.targetFrameId
        ? {
            ...frame,
            root: splitTabsetWithContent({
              node: frame.root,
              targetTabsetId: transaction.targetTabsetId,
              contentId: transaction.contentId,
              allocatedTabsetId,
              allocatedSplitId,
              placement: transaction.placement,
              active: transaction.active ?? true
            })
          }
        : frame);
      return finish(frames);
    }
    case "float-content": {
      if (!content.has(transaction.contentId) && transaction.content?.contentId !== transaction.contentId) {
        return noCommit(`cannot float unknown content ${transaction.contentId}`);
      }
      if (nextInput.frames.some((frame) => frame.frameId === transaction.frameId)) {
        return noCommit(`cannot create duplicate floating frame ${transaction.frameId}`);
      }
      const removed = removeContentFromFrames(
        nextInput.frames,
        transaction.contentId,
        warnings,
        new Set(transaction.preserveEmptyFrameIds ?? [])
      );
      const frames = [
        ...removeEmptyFrames(removed),
        {
          frameId: transaction.frameId,
          kind: transaction.kindOfFrame ?? "runtime",
          presentation: transaction.presentation ?? "windowed",
          visible: transaction.visible ?? true,
          stackPriority: transaction.stackPriority ?? 0,
          root: {
            kind: "tabset" as const,
            id: transaction.tabsetId,
            contentIds: [transaction.contentId],
            activeContentId: transaction.contentId
          }
        }
      ];
      return finish(
        frames,
        content.has(transaction.contentId)
          ? nextInput.contents
          : [...nextInput.contents, transaction.content!]
      );
    }
    case "resize-split": {
      if (transaction.ratio <= 0 || transaction.ratio >= 1) {
        return noCommit(`cannot resize split ${transaction.splitId} to invalid ratio ${transaction.ratio}`);
      }
      let resized = false;
      const frames = nextInput.frames.map((frame) => ({
        ...frame,
        root: updateSplitRatio(frame.root, transaction.splitId, transaction.ratio, () => {
          resized = true;
        })
      }));
      return resized
        ? finish(frames)
        : noCommit(`cannot resize unknown split ${transaction.splitId}`);
    }
  }
}

export function createWindowWorkspaceRealizationMap<TContent = unknown, TFrameSurface = unknown>(): {
  readonly map: WindowWorkspaceRealizationMap<TContent, TFrameSurface>;
  setViewActorId(identity: WindowViewIdentity, viewActorId: string | null): void;
  setContent(contentId: WindowWorkspaceContentId, content: TContent | null): void;
  setFrameSurface(frameId: WindowWorkspaceFrameId, surface: TFrameSurface | null): void;
} {
  const viewActorIdsByIdentityKey = new Map<string, string>();
  const contentById = new Map<WindowWorkspaceContentId, TContent>();
  const frameSurfaceById = new Map<WindowWorkspaceFrameId, TFrameSurface>();
  return {
    map: {
      getViewActorId(identity) {
        return viewActorIdsByIdentityKey.get(createWindowViewIdentityKey(identity)) ?? null;
      },
      getContent(contentId) {
        return contentById.get(contentId) ?? null;
      },
      getFrameSurface(frameId) {
        return frameSurfaceById.get(frameId) ?? null;
      }
    },
    setViewActorId(identity, viewActorId) {
      const key = createWindowViewIdentityKey(identity);
      if (viewActorId === null) {
        viewActorIdsByIdentityKey.delete(key);
        return;
      }
      viewActorIdsByIdentityKey.set(key, viewActorId);
    },
    setContent(contentId, content) {
      if (content === null) {
        contentById.delete(contentId);
        return;
      }
      contentById.set(contentId, content);
    },
    setFrameSurface(frameId, surface) {
      if (surface === null) {
        frameSurfaceById.delete(frameId);
        return;
      }
      frameSurfaceById.set(frameId, surface);
    }
  };
}

interface CollectFramePlacementsOptions {
  readonly frame: WindowWorkspaceGraphFrameInput;
  readonly node: WindowWorkspaceGraphDockNode;
  readonly contentsById: ReadonlyMap<WindowWorkspaceContentId, WindowWorkspaceGraphContentInput>;
  readonly placements: WindowWorkspaceGraphPlacement[];
  readonly issues: string[];
  readonly seenDockNodeIds: Set<string>;
  readonly seenContentPlacements: Set<WindowWorkspaceContentId>;
}

function collectFramePlacements(options: CollectFramePlacementsOptions): void {
  const { frame, node, contentsById, placements, issues, seenDockNodeIds, seenContentPlacements } = options;
  const dockNodeKey = `${frame.frameId}:${node.id}`;
  if (seenDockNodeIds.has(dockNodeKey)) {
    issues.push(`duplicate dock node id ${node.id} in frame ${frame.frameId}`);
    return;
  }
  seenDockNodeIds.add(dockNodeKey);

  if (node.kind === "split") {
    if (node.ratio <= 0 || node.ratio >= 1) {
      issues.push(`split ${node.id} ratio must be between 0 and 1`);
    }
    collectFramePlacements({ ...options, node: node.first });
    collectFramePlacements({ ...options, node: node.second });
    return;
  }

  if (node.contentIds.length === 0) {
    if (node.activeContentId !== null) {
      issues.push(`empty tabset ${node.id} cannot have active content ${node.activeContentId}`);
    }
    return;
  }
  if (node.activeContentId === null || !node.contentIds.includes(node.activeContentId)) {
    issues.push(`tabset ${node.id} active content ${node.activeContentId} is not in the tabset`);
  }

  for (const contentId of node.contentIds) {
    const content = contentsById.get(contentId);
    if (!content) {
      issues.push(`tabset ${node.id} references unknown content id ${contentId}`);
      continue;
    }
    if (seenContentPlacements.has(contentId)) {
      issues.push(`content id ${contentId} appears in more than one tabset`);
      continue;
    }
    seenContentPlacements.add(contentId);
    const active = contentId === node.activeContentId;
    placements.push({
      contentId,
      identity: content.identity,
      frameId: frame.frameId,
      tabsetId: node.id,
      active,
      interactable: frame.visible && active
    });
  }
}

function cloneFrameSnapshot(frame: WindowWorkspaceGraphFrameInput): WindowWorkspaceGraphFrameSnapshot {
  return {
    frameId: frame.frameId,
    kind: frame.kind,
    root: cloneDockNode(frame.root),
    presentation: frame.presentation,
    visible: frame.visible,
    stackPriority: frame.stackPriority
  };
}

function cloneDockNode(node: WindowWorkspaceGraphDockNode): WindowWorkspaceGraphDockNode {
  if (node.kind === "tabset") {
    return {
      kind: "tabset",
      id: node.id,
      contentIds: [...node.contentIds],
      activeContentId: node.activeContentId
    };
  }
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: cloneDockNode(node.first),
    second: cloneDockNode(node.second)
  };
}

function graphInputFromSnapshot(snapshot: WindowWorkspaceGraphSnapshot): WindowWorkspaceGraphInput {
  const contentsById = new Map<WindowWorkspaceContentId, WindowWorkspaceGraphContentInput>();
  for (const placement of snapshot.placements) {
    contentsById.set(placement.contentId, {
      contentId: placement.contentId,
      identity: placement.identity
    });
  }
  return {
    revision: snapshot.revision,
    contents: [...contentsById.values()],
    frames: snapshot.frames.map(cloneFrameSnapshot)
  };
}

function listContentIds(node: WindowWorkspaceGraphDockNode): readonly WindowWorkspaceContentId[] {
  if (node.kind === "tabset") return [...node.contentIds];
  return [...listContentIds(node.first), ...listContentIds(node.second)];
}

function findTabset(
  frames: readonly WindowWorkspaceGraphFrameInput[],
  frameId: WindowWorkspaceFrameId,
  tabsetId: WindowWorkspaceTabsetId
): WindowWorkspaceGraphTabsetNode | null {
  const frame = frames.find((candidate) => candidate.frameId === frameId);
  return frame ? findTabsetInNode(frame.root, tabsetId) : null;
}

function findTabsetInNode(
  node: WindowWorkspaceGraphDockNode,
  tabsetId: WindowWorkspaceTabsetId
): WindowWorkspaceGraphTabsetNode | null {
  if (node.kind === "tabset") {
    return node.id === tabsetId ? node : null;
  }
  return findTabsetInNode(node.first, tabsetId) ?? findTabsetInNode(node.second, tabsetId);
}

function hasDockNodeId(node: WindowWorkspaceGraphDockNode, id: WindowWorkspaceTabsetId | WindowWorkspaceSplitId): boolean {
  if (node.id === id) return true;
  return node.kind === "split"
    ? hasDockNodeId(node.first, id) || hasDockNodeId(node.second, id)
    : false;
}

function allocateSplitTabsetId(
  node: WindowWorkspaceGraphDockNode,
  targetTabsetId: WindowWorkspaceTabsetId,
  contentId: WindowWorkspaceContentId
): WindowWorkspaceTabsetId {
  return allocateDockNodeId(
    node,
    windowWorkspaceTabsetId(`${targetTabsetId}:tabset:${contentId}`)
  ) as WindowWorkspaceTabsetId;
}

function allocateSplitId(
  node: WindowWorkspaceGraphDockNode,
  targetTabsetId: WindowWorkspaceTabsetId,
  contentId: WindowWorkspaceContentId
): WindowWorkspaceSplitId {
  return allocateDockNodeId(
    node,
    windowWorkspaceSplitId(`${targetTabsetId}:split:${contentId}`)
  ) as WindowWorkspaceSplitId;
}

function allocateDockNodeId(
  node: WindowWorkspaceGraphDockNode,
  baseId: WindowWorkspaceTabsetId | WindowWorkspaceSplitId
): WindowWorkspaceTabsetId | WindowWorkspaceSplitId {
  if (!hasDockNodeId(node, baseId)) return baseId;
  let suffix = 2;
  while (true) {
    const candidate = `${baseId}:${suffix}` as WindowWorkspaceTabsetId | WindowWorkspaceSplitId;
    if (!hasDockNodeId(node, candidate)) return candidate;
    suffix += 1;
  }
}

function setActiveContent(
  node: WindowWorkspaceGraphDockNode,
  contentId: WindowWorkspaceContentId
): WindowWorkspaceGraphDockNode {
  if (node.kind === "tabset") {
    return node.contentIds.includes(contentId)
      ? { ...node, activeContentId: contentId }
      : node;
  }
  return {
    ...node,
    first: setActiveContent(node.first, contentId),
    second: setActiveContent(node.second, contentId)
  };
}

function removeContentFromFrames(
  frames: readonly WindowWorkspaceGraphFrameInput[],
  contentId: WindowWorkspaceContentId,
  warnings: string[],
  preserveEmptyFrameIds: ReadonlySet<WindowWorkspaceFrameId> = new Set()
): readonly NullableWindowWorkspaceGraphFrameInput[] {
  return frames.map((frame) => {
    const nextRoot = removeContentFromNode(frame.root, contentId, warnings);
    return {
      ...frame,
      root: nextRoot ?? (preserveEmptyFrameIds.has(frame.frameId)
        ? createEmptyTabsetForFrame(frame.frameId)
        : null)
    };
  });
}

function removeContentFromNode(
  node: WindowWorkspaceGraphDockNode,
  contentId: WindowWorkspaceContentId,
  warnings: string[]
): WindowWorkspaceGraphDockNode | null {
  if (node.kind === "tabset") {
    if (!node.contentIds.includes(contentId)) return node;
    const contentIds = node.contentIds.filter((candidate) => candidate !== contentId);
    if (contentIds.length === 0) return null;
    return {
      ...node,
      contentIds,
      activeContentId: node.activeContentId === contentId
        ? contentIds[0]!
        : node.activeContentId
    };
  }

  const first = removeContentFromNode(node.first, contentId, warnings);
  const second = removeContentFromNode(node.second, contentId, warnings);
  if (!first && !second) return null;
  if (!first) {
    warnings.push(`collapsed split ${node.id} after removing empty first branch`);
    return second;
  }
  if (!second) {
    warnings.push(`collapsed split ${node.id} after removing empty second branch`);
    return first;
  }
  return {
    ...node,
    first,
    second
  };
}

type NullableWindowWorkspaceGraphFrameInput = Omit<WindowWorkspaceGraphFrameInput, "root"> & {
  readonly root: WindowWorkspaceGraphDockNode | null;
};

function removeEmptyFrames(frames: readonly NullableWindowWorkspaceGraphFrameInput[]): readonly WindowWorkspaceGraphFrameInput[] {
  return frames
    .filter((frame): frame is Omit<WindowWorkspaceGraphFrameInput, "root"> & {
      readonly root: WindowWorkspaceGraphDockNode;
    } => frame.root !== null)
    .map((frame) => ({
      ...frame,
      root: frame.root
    }));
}

function createEmptyTabsetForFrame(frameId: WindowWorkspaceFrameId): WindowWorkspaceGraphTabsetNode {
  return {
    kind: "tabset",
    id: windowWorkspaceTabsetId(`empty-tabset:${frameId}`),
    contentIds: [],
    activeContentId: null
  };
}

function ensureTransactionTargetFrame(
  frames: readonly WindowWorkspaceGraphFrameInput[],
  targetFrameId: WindowWorkspaceFrameId,
  targetFrame: WindowWorkspaceGraphFrameInput | undefined,
  targetTabsetId: WindowWorkspaceTabsetId,
  replaceIfMissingTabset = false
): readonly WindowWorkspaceGraphFrameInput[] {
  const existing = frames.find((frame) => frame.frameId === targetFrameId);
  if (existing) {
    if (replaceIfMissingTabset && targetFrame && !findTabset(frames, targetFrameId, targetTabsetId)) {
      return frames.map((frame) => frame.frameId === targetFrameId ? targetFrame : frame);
    }
    return frames;
  }
  return targetFrame ? [...frames, targetFrame] : frames;
}

function addContentToTabset(
  node: WindowWorkspaceGraphDockNode,
  tabsetId: WindowWorkspaceTabsetId,
  contentId: WindowWorkspaceContentId,
  active: boolean
): WindowWorkspaceGraphDockNode {
  if (node.kind === "tabset") {
    if (node.id !== tabsetId) return node;
    const contentIds = node.contentIds.includes(contentId)
      ? node.contentIds
      : [...node.contentIds, contentId];
    return {
      ...node,
      contentIds,
      activeContentId: active || node.activeContentId === null ? contentId : node.activeContentId
    };
  }
  return {
    ...node,
    first: addContentToTabset(node.first, tabsetId, contentId, active),
    second: addContentToTabset(node.second, tabsetId, contentId, active)
  };
}

function splitTabsetWithContent(options: {
  readonly node: WindowWorkspaceGraphDockNode;
  readonly targetTabsetId: WindowWorkspaceTabsetId;
  readonly contentId: WindowWorkspaceContentId;
  readonly allocatedTabsetId: WindowWorkspaceTabsetId;
  readonly allocatedSplitId: WindowWorkspaceSplitId;
  readonly placement: WindowDockSplitPlacement;
  readonly active: boolean;
}): WindowWorkspaceGraphDockNode {
  if (options.node.kind === "tabset") {
    if (options.node.id !== options.targetTabsetId) return options.node;
    const newTabset: WindowWorkspaceGraphTabsetNode = {
      kind: "tabset",
      id: options.allocatedTabsetId,
      contentIds: [options.contentId],
      activeContentId: options.contentId
    };
    const target = options.active
      ? options.node
      : { ...options.node, activeContentId: options.node.activeContentId };
    const newFirst = options.placement === "left" || options.placement === "top";
    const direction: WindowWorkspaceGraphSplitDirection =
      options.placement === "left" || options.placement === "right"
        ? "horizontal"
        : "vertical";
    return {
      kind: "split",
      id: options.allocatedSplitId,
      direction,
      ratio: 0.5,
      first: newFirst ? newTabset : target,
      second: newFirst ? target : newTabset
    };
  }
  return {
    ...options.node,
    first: splitTabsetWithContent({ ...options, node: options.node.first }),
    second: splitTabsetWithContent({ ...options, node: options.node.second })
  };
}

function updateSplitRatio(
  node: WindowWorkspaceGraphDockNode,
  splitId: WindowWorkspaceSplitId,
  ratio: number,
  markUpdated: () => void
): WindowWorkspaceGraphDockNode {
  if (node.kind === "tabset") return node;
  if (node.id === splitId) {
    markUpdated();
    return { ...node, ratio };
  }
  return {
    ...node,
    first: updateSplitRatio(node.first, splitId, ratio, markUpdated),
    second: updateSplitRatio(node.second, splitId, ratio, markUpdated)
  };
}

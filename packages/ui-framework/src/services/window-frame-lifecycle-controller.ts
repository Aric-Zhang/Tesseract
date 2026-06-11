import type { Actor } from "actor-core";
import type { WindowFocusCommandPort, WindowFocusReason } from "./window-focus-command-port";
import { ActorSystem } from "actor-core";
import type {
  WindowDockCommitIntent,
  WindowDockCommitResult,
  WindowDockCommitValidationResult,
  WindowCloseFrameResult,
  WindowCloseViewResult,
  WindowCloseViewOptions,
  WindowFrameSplitResizeResult,
  WindowFrameLayoutRestorePort,
  WindowFrameLayoutRestoreResult,
  WindowFloatingFrameFactory,
  WindowFrameLayoutSnapshotSource,
  WindowFrameLifecycleController,
  WindowFrameLifecycleReason,
  WindowOpenViewOptions,
  WindowViewLocation,
  WindowViewLocationSource,
  WindowViewOwnerCommandPort,
  WindowViewFullscreenReason,
  WindowViewFullscreenSession,
  WindowViewPresentationCommandPort
} from "./window-frame-lifecycle";
import {
  WindowContentRegistry,
  type WindowContentRegistrationPort,
  type WindowRegisteredContent
} from "../ports/window-content-host";
import type { WindowFramePort } from "../ports/window-frame-port";
import type { WindowFramePortRegistryEntry, WindowFramePortRegistryView } from "../ports/window-frame-port-registry";
import type {
  WindowViewFactoryRegistry,
  WindowViewRuntimeFactoryResult
} from "../ports/window-view-factory-registry";
import {
  createWindowViewIdentity,
  createWindowViewIdentityKey,
  type WindowViewIdentity,
  type WindowViewTypeKey
} from "../model/window-view-identity";
import type { WindowViewKey } from "../model/window-view-key";
import { uiVec2 } from "../ports/ui-geometry";
import {
  collectFrameViewKeys,
  normalizeWindowWorkspaceFrameLayout,
  type WindowFrameDockNode,
  type WindowWorkspaceFrameLayout,
  type WindowWorkspaceViewDescriptor
} from "../model/window-workspace-layout";
import type { WindowFrameTab } from "../model/window-frame-tab";
import {
  createWindowWorkspaceContentId,
  createWindowWorkspaceGraphCommit,
  createWindowWorkspaceGraphSnapshot,
  createWindowWorkspaceRealizationMap,
  reduceWindowWorkspaceGraphTransaction,
  windowWorkspaceTabsetId,
  windowWorkspaceFrameId,
  windowWorkspaceSplitId,
  type WindowWorkspaceGraphDockNode,
  type WindowWorkspaceGraphContentInput,
  type WindowWorkspaceGraphFrameInput,
  type WindowWorkspaceGraphFrameSnapshot,
  type WindowWorkspaceGraphTabsetNode,
  type WindowWorkspaceGraphTransaction,
  type WindowWorkspaceGraphPlacement,
  type WindowWorkspaceGraphSnapshot,
  type WindowWorkspaceTabsetId
} from "../model/window-workspace-graph";
import {
  reconcileWindowWorkspaceGraphCommit,
  reconcileWindowWorkspaceGraphTransaction,
  type WindowFrameSurfaceSnapshot,
  type WindowWorkspaceGraphProjectionResult,
  type WindowWorkspaceGraphReconcilerSurface,
  type WindowWorkspaceGraphTransactionReconcileResult,
  type WindowWorkspaceSurfaceGeometryProjection
} from "./window-workspace-graph-reconciler";

export interface LiveWindowView {
  readonly identity: WindowViewIdentity;
  readonly viewKey: WindowViewKey;
  frameActor: Actor;
  framePort: WindowFramePort;
  readonly viewActor: Actor;
  readonly content: WindowRegisteredContent;
  readonly disposeViewRuntime?: () => void;
  activationSequence: number;
}

type WindowFramePortTab = WindowFrameTab;
type WindowFrameBounds = ReturnType<WindowFramePort["getFloatingBounds"]>;
type WindowWorkspaceGraphFrameSurface = WindowFramePort & WindowWorkspaceGraphReconcilerSurface<WindowRegisteredContent>;

interface WindowViewFullscreenRestoreTarget {
  readonly sourceFrameId: string;
  readonly sourceFrameSnapshot: WindowWorkspaceGraphFrameSnapshot;
  readonly sourceTargetFrame: WindowWorkspaceGraphFrameSnapshot;
  readonly sourceTabsetId: WindowWorkspaceTabsetId;
  readonly sourceBounds: WindowFrameBounds;
  readonly sourcePresentation: WindowFramePort["presentation"];
  readonly sourceVisiblePath: WindowFramePort["visiblePath"];
  readonly sourceVisibleBeforeRun: boolean | null;
}

type ManagedWindowViewFullscreenSession =
  | {
      readonly viewActorId: string;
      readonly viewKey: WindowViewKey;
      readonly mode: "direct-frame";
      readonly fullscreenFrameId: string;
      readonly previousPresentation: WindowFramePort["presentation"];
    }
  | {
      readonly viewActorId: string;
      readonly viewKey: WindowViewKey;
      readonly mode: "isolated-frame";
      readonly fullscreenFrameId: string;
      readonly restore: WindowViewFullscreenRestoreTarget;
      readonly tab: WindowFramePortTab;
    };

export interface WindowFrameLifecycleControllerOptions {
  readonly actorSystem: ActorSystem;
  readonly factories: WindowViewFactoryRegistry;
  readonly windowFocus?: WindowFocusCommandPort;
  readonly cancelActiveInput?: () => void;
  readonly createFloatingFrame?: WindowFloatingFrameFactory;
  readonly framePorts?: WindowFramePortRegistryView;
  readonly contentRegistration?: WindowContentRegistrationPort;
}

export class DefaultWindowFrameLifecycleController implements
  WindowFrameLifecycleController,
  WindowViewLocationSource,
  WindowViewOwnerCommandPort,
  WindowViewPresentationCommandPort,
  WindowFrameLayoutRestorePort,
  WindowFrameLayoutSnapshotSource {
  readonly #actorSystem: ActorSystem;
  readonly #factories: WindowViewFactoryRegistry;
  readonly #windowFocus?: WindowFocusCommandPort;
  readonly #cancelActiveInput?: () => void;
  readonly #createFloatingFrame?: WindowFloatingFrameFactory;
  readonly #framePorts?: WindowFramePortRegistryView;
  readonly #contentRegistration: WindowContentRegistrationPort;
  readonly #liveViews = new Map<string, LiveWindowView>();
  readonly #fullscreenSessionsByViewActorId = new Map<string, ManagedWindowViewFullscreenSession>();
  #workspaceGraphSnapshot: WindowWorkspaceGraphSnapshot = createWindowWorkspaceGraphSnapshot({
    revision: 0,
    contents: [],
    frames: []
  });
  #workspaceGraphRealization = createWindowWorkspaceRealizationMap<WindowRegisteredContent, WindowWorkspaceGraphFrameSurface>();
  #workspaceGraphProjection: WindowWorkspaceGraphProjectionResult<WindowWorkspaceGraphFrameSurface> | null = null;
  #workspaceSurfaceGeometryByFrameId = new Map<string, WindowWorkspaceSurfaceGeometryProjection>();
  #workspaceGraphBootstrapSignature = "";
  #activationSequence = 0;

  constructor(options: WindowFrameLifecycleControllerOptions) {
    this.#actorSystem = options.actorSystem;
    this.#factories = options.factories;
    this.#windowFocus = options.windowFocus;
    this.#cancelActiveInput = options.cancelActiveInput;
    this.#createFloatingFrame = options.createFloatingFrame;
    this.#framePorts = options.framePorts;
    this.#contentRegistration = options.contentRegistration ?? new WindowContentRegistry();
  }

  openView(
    viewKey: WindowViewKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options: WindowOpenViewOptions = {}
  ): void {
    const liveView = this.getLiveView(viewKey);
    if (liveView) {
      this.activateContentPlacement(liveView);
      this.recordViewActivation(liveView);
      this.#windowFocus?.focusActorWindow(liveView.frameActor, toWindowFocusReason(reason));
      return;
    }
    if (options.preferredFrameId && this.tryOpenViewRuntimeInFrame(viewKey, options.preferredFrameId, reason)) {
      return;
    }
    const factory = this.#factories.get(viewKey);
    if (!factory) {
      throw new Error(`Window view factory is not registered: ${viewKey}.`);
    }
    if (!this.#createFloatingFrame) {
      throw new Error(`Cannot open view without a frame shell factory: ${viewKey}.`);
    }
    const frame = this.#createFloatingFrame({
      viewKey,
      title: factory.label,
      reason
    });
    try {
      this.openViewRuntimeInFrameEntry(viewKey, frame.frameActor, frame.framePort, reason);
    } catch (error) {
      if (this.#actorSystem.hasActor(frame.frameActor)) {
        this.#actorSystem.destroyActor(frame.frameActor);
      }
      throw error;
    }
  }

  openOrFocusViewType(
    typeKey: WindowViewTypeKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options: WindowOpenViewOptions = {}
  ): WindowViewIdentity | null {
    const liveView = this.getMostRecentlyActivatedLiveViewByType(typeKey);
    if (liveView) {
      this.focusViewInstance(liveView.identity, reason);
      return liveView.identity;
    }
    return this.createViewInstance(typeKey, reason, options);
  }

  createViewInstance(
    typeKey: WindowViewTypeKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options: WindowOpenViewOptions = {}
  ): WindowViewIdentity | null {
    const factories = this.#factories.listByType(typeKey);
    const factory = factories.find((candidate) => !this.getLiveViewByViewKey(candidate.viewKey)) ?? factories[0];
    if (!factory) return null;
    this.openView(factory.viewKey, reason, options);
    return this.#factories.getIdentity(factory.viewKey);
  }

  focusViewInstance(
    identity: WindowViewIdentity,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic" | "tab-click">
  ): boolean {
    const liveView = this.getLiveViewByIdentity(identity);
    if (!liveView) return false;
    this.activateContentPlacement(liveView);
    this.recordViewActivation(liveView);
    this.#windowFocus?.focusActorWindow(liveView.frameActor, toWindowFocusReason(reason));
    return true;
  }

  closeFrame(
    frameId: string,
    _reason: Extract<WindowFrameLifecycleReason, "close-button" | "programmatic">
  ): WindowCloseFrameResult {
    const frameActor = this.#actorSystem.getActor(frameId);
    if (!frameActor) {
      return {
        closed: false,
        frameId,
        reason: "frame is not live"
      };
    }
    if (!this.canDestroyFrame(frameActor)) {
      return {
        closed: false,
        frameId,
        reason: "frame cannot be closed"
      };
    }
    this.#cancelActiveInput?.();
    const liveViews = this.listLiveViewsForFrame(frameActor);
    const closeFrameTransaction = this.commitWorkspaceGraphTransaction({
      kind: "close-frame",
      frameId: windowWorkspaceFrameId(frameId)
    });
    if (!closeFrameTransaction.committed) {
      return {
        closed: false,
        frameId,
        reason: describeGraphTransactionFailure(closeFrameTransaction, "frame graph close failed")
      };
    }
    const cleanedViewActorIds: string[] = [];
    for (const liveView of liveViews) {
      const cleanup = this.disposeLiveViewRuntimeForClose(liveView);
      if (!cleanup.disposed) {
        this.restoreWorkspaceGraphSnapshot(closeFrameTransaction.rollbackSnapshot);
        return {
          closed: false,
          frameId,
          reason: cleanup.reason,
          error: cleanup.error
        };
      }
      cleanedViewActorIds.push(liveView.viewActor.id);
    }
    for (const liveView of liveViews) {
      this.#fullscreenSessionsByViewActorId.delete(liveView.viewActor.id);
      this.#liveViews.delete(toLiveViewKey(liveView));
    }
    try {
      if (this.#actorSystem.hasActor(frameActor)) {
        this.#actorSystem.destroyActor(frameActor);
      }
    } catch (error) {
      this.pruneLiveViews();
      return {
        closed: true,
        frameId,
        closedViewActorIds: cleanedViewActorIds,
        warning: describeError(error, "frame actor destroy failed")
      };
    }
    this.pruneLiveViews();
    return {
      closed: true,
      frameId,
      closedViewActorIds: cleanedViewActorIds
    };
  }

  closeView(
    viewActorId: string,
    _reason: Extract<WindowFrameLifecycleReason, "tab-action" | "programmatic">,
    options: WindowCloseViewOptions = {}
  ): WindowCloseViewResult {
    const liveView = this.getLiveViewByActorId(viewActorId);
    if (!liveView) {
      return {
        closed: false,
        reason: "view is not live"
      };
    }
    if (!liveView.disposeViewRuntime) {
      return {
        closed: false,
        reason: "view runtime cleanup is not configured",
        sourceFrameId: liveView.frameActor.id
      };
    }
    const validation = this.validateCloseViewIdentity(liveView, options);
    if (!validation.valid) {
      return {
        closed: false,
        reason: validation.reason,
        sourceFrameId: liveView.frameActor.id
      };
    }

    this.#cancelActiveInput?.();
    const fullscreenSession = this.#fullscreenSessionsByViewActorId.get(viewActorId);
    if (fullscreenSession) {
      try {
        this.exitViewFullscreen(viewActorId, "programmatic");
      } catch (error) {
        return {
          closed: false,
          reason: "fullscreen cleanup failed",
          sourceFrameId: liveView.frameActor.id,
          error: describeError(error, "fullscreen cleanup failed")
        };
      }
    }

    const currentLiveView = this.getLiveViewByActorId(viewActorId);
    if (!currentLiveView) {
      return {
        closed: false,
        reason: "view is not live"
      };
    }
    if (!currentLiveView.disposeViewRuntime) {
      return {
        closed: false,
        reason: "view runtime cleanup is not configured",
        sourceFrameId: currentLiveView.frameActor.id
      };
    }
    const currentValidation = this.validateCloseViewIdentity(currentLiveView, options);
    if (!currentValidation.valid) {
      return {
        closed: false,
        reason: currentValidation.reason,
        sourceFrameId: currentLiveView.frameActor.id
      };
    }

    const sourceFrame = currentLiveView.frameActor;
    const sourceFrameId = sourceFrame.id;
    const warnings: string[] = [];
    const closeTransaction = this.commitWorkspaceGraphTransaction({
      kind: "close-content",
      contentId: createWindowWorkspaceContentId(currentLiveView.identity),
      preserveEmptyFrameIds: this.canDestroyFrame(sourceFrame)
        ? []
        : [windowWorkspaceFrameId(sourceFrame.id)]
    });
    if (!closeTransaction.committed) {
      return {
        closed: false,
        reason: closeTransaction.warnings.join("; ") || "view graph close failed",
        sourceFrameId
      };
    }
    warnings.push(...closeTransaction.warnings);
    const nextActiveViewActorId = this.findFirstActiveViewActorIdInFrame(closeTransaction.nextSnapshot, sourceFrameId);
    const cleanup = this.disposeLiveViewRuntimeForClose(currentLiveView);
    if (!cleanup.disposed) {
      this.restoreWorkspaceGraphSnapshot(closeTransaction.rollbackSnapshot);
      return {
        closed: false,
        reason: cleanup.reason,
        sourceFrameId,
        error: cleanup.error
      };
    }

    try {
      if (this.#actorSystem.hasActor(currentLiveView.viewActor)) {
        this.#actorSystem.destroyActor(currentLiveView.viewActor);
      }
    } catch (error) {
      warnings.push(describeError(error, "view actor destroy failed"));
    }

    this.#liveViews.delete(toLiveViewKey(currentLiveView));
    this.#fullscreenSessionsByViewActorId.delete(viewActorId);

    const remainingViews = this.listLiveViewsForFrame(sourceFrame);
    if (remainingViews.length === 0) {
      const destroy = this.destroyEmptyFrameIfAllowed(sourceFrame, "empty owner frame destroy failed");
      if (!destroy.warning) {
        return {
          closed: true,
          sourceFrameId,
          ownerFrameDestroyed: destroy.destroyed,
          nextActiveViewActorId: null,
          ...createWarningResult(warnings)
        };
      }
      warnings.push(destroy.warning);
      return {
        closed: true,
        sourceFrameId,
        ownerFrameDestroyed: false,
        nextActiveViewActorId: null,
        ...createWarningResult(warnings)
      };
    }

    if (nextActiveViewActorId) {
      const nextLiveView = this.getLiveViewByActorId(nextActiveViewActorId);
      if (nextLiveView) this.recordViewActivation(nextLiveView);
    }
    this.#windowFocus?.focusActorWindow(sourceFrame, toWindowFocusReason("programmatic"));
    return {
      closed: true,
      sourceFrameId,
      ownerFrameDestroyed: false,
      nextActiveViewActorId,
      ...createWarningResult(warnings)
    };
  }

  activateFrameTab(
    frameId: string,
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
  ): void {
    const liveView = this.getLiveViewByActorId(viewActorId);
    if (!liveView || liveView.frameActor.id !== frameId) return;
    this.activateContentPlacement(liveView);
    this.recordViewActivation(liveView);
    this.#windowFocus?.focusActorWindow(liveView.frameActor, toWindowFocusReason(reason));
  }

  resizeFrameSplit(
    frameId: string,
    splitId: string,
    ratio: number,
    _reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "programmatic">
  ): WindowFrameSplitResizeResult {
    const frameEntry = this.getFramePortEntryById(frameId);
    if (!frameEntry || !this.#actorSystem.hasActor(frameEntry.frameActor)) {
      return { resized: false, reason: "frame is not live" };
    }
    const result = this.commitWorkspaceGraphTransaction({
      kind: "resize-split",
      splitId: windowWorkspaceSplitId(splitId),
      ratio
    });
    return result.committed
      ? { resized: true }
      : {
          resized: false,
          reason: [...result.hardIssues, ...result.softIssues].map((issue) => issue.message).join("; ") ||
            "split resize failed"
        };
  }

  validateDockCommit(intent: WindowDockCommitIntent): WindowDockCommitValidationResult {
    const sourceView = this.getLiveViewByActorId(intent.source.viewActorId);
    if (!sourceView) {
      return invalidDockCommit("source view is not live");
    }
    if (sourceView.viewKey !== intent.source.viewKey) {
      return invalidDockCommit("source view key mismatch");
    }
    if (sourceView.frameActor.id !== intent.source.frameId) {
      return invalidDockCommit("source frame mismatch");
    }
    const sourcePlacement = this.findWorkspaceGraphPlacementForLiveView(sourceView);
    if (sourcePlacement?.frameId !== windowWorkspaceFrameId(intent.source.frameId)) {
      return invalidDockCommit("source frame does not contain source tab");
    }
    if (intent.kind === "float-tab") {
      return isUsableDockRect(intent.bounds)
        ? { valid: true }
        : invalidDockCommit("floating bounds are invalid");
    }

    const sameFrame = intent.targetFrameId === intent.source.frameId;
    if (sameFrame && intent.kind === "split-tab" && intent.operation !== "same-frame-split") {
      return invalidDockCommit("same-frame split requires explicit same-frame operation");
    }
    if (sameFrame && intent.kind === "split-tab" && !intent.source.sourceTabsetId) {
      return invalidDockCommit("same-frame split requires source tabset");
    }
    if (sameFrame && intent.kind === "merge-tabs" && intent.operation !== "same-frame-reorder") {
      return invalidDockCommit("same-frame merge requires explicit same-frame operation");
    }
    if (!sameFrame && intent.operation?.startsWith("same-frame")) {
      return invalidDockCommit("same-frame operation target is not the source frame");
    }
    const targetActor = this.#actorSystem.getActor(intent.targetFrameId);
    if (!targetActor) {
      return invalidDockCommit("target frame is missing");
    }
    const targetEntry = this.getFramePortEntryById(intent.targetFrameId);
    if (!targetEntry || !this.#actorSystem.hasActor(targetEntry.frameActor)) {
      return invalidDockCommit("target frame has no live views");
    }
    this.ensureWorkspaceGraphFrame(targetEntry.framePort);
    const graphTargetTabset = this.findWorkspaceGraphTabset(intent.targetFrameId, intent.targetTabsetId);
    if (!graphTargetTabset) {
      return invalidDockCommit("target tabset is missing");
    }
    if (sameFrame && intent.kind === "merge-tabs" && intent.source.sourceTabsetId === intent.targetTabsetId) {
      return invalidDockCommit("same tabset drop is a no-op");
    }
    if (sameFrame && intent.kind === "split-tab" && intent.source.sourceTabsetId === intent.targetTabsetId) {
      const sourceContentId = createWindowWorkspaceContentId(sourceView.identity);
      const hasSiblingTabs = Boolean(graphTargetTabset?.contentIds.some((contentId: string) => contentId !== sourceContentId));
      if (!hasSiblingTabs) {
        return invalidDockCommit("same tabset split is a no-op");
      }
    }
    if (!sameFrame && sourcePlacement?.frameId === windowWorkspaceFrameId(intent.targetFrameId)) {
      return invalidDockCommit("target frame already contains source tab");
    }
    return { valid: true };
  }

  commitDock(intent: WindowDockCommitIntent): WindowDockCommitResult {
    const validation = this.validateDockCommit(intent);
    if (!validation.valid) {
      return { committed: false, reason: validation.reason };
    }
    const sourceView = this.getLiveViewByActorId(intent.source.viewActorId);
    if (!sourceView) {
      return { committed: false, reason: "dock commit source disappeared" };
    }
    const sourceFrame = sourceView.frameActor;
    const sourcePort = sourceView.framePort;
    const sourceTab = this.createLiveViewTab(sourceView);
    if (intent.kind === "float-tab") {
      return this.commitFloatTab(intent, sourceView, sourceTab);
    }

    const targetEntry = this.getFramePortEntryById(intent.targetFrameId);
    const targetFrame = targetEntry?.frameActor ?? null;
    const targetPort = targetEntry?.framePort ?? null;
    if (!targetFrame || !this.#actorSystem.hasActor(targetFrame)) {
      return { committed: false, reason: "dock commit target disappeared" };
    }
    if (!targetPort) {
      return { committed: false, reason: "target frame port disappeared" };
    }
    if (targetFrame.id === sourceFrame.id) {
      if (intent.kind === "split-tab") {
        return this.commitSameFrameSplitTab(intent, sourceView, sourceTab, targetPort);
      }
      return this.commitSameFrameMergeTab(intent, sourceView, sourceTab, targetPort);
    }
    if (intent.kind === "split-tab") {
      return this.commitSplitTab(intent, sourceView, sourceTab, targetFrame, targetPort);
    }

    this.#cancelActiveInput?.();
    const result = this.commitWorkspaceGraphTransaction({
      kind: "move-content",
      contentId: createWindowWorkspaceContentId(sourceView.identity),
      targetFrameId: windowWorkspaceFrameId(intent.targetFrameId),
      targetTabsetId: windowWorkspaceTabsetId(intent.targetTabsetId),
      targetFrame: this.createEmptyWorkspaceGraphFrameInput(targetPort, intent.targetTabsetId),
      active: true,
      preserveEmptyFrameIds: this.canDestroyFrame(sourceFrame)
        ? []
        : [windowWorkspaceFrameId(sourceFrame.id)]
    }, {
      extraFrameSurfaces: createExtraFrameSurface(targetPort)
    });
    if (!result.committed) {
      return {
        committed: false,
        reason: describeGraphTransactionFailure(result, "dock merge failed")
      };
    }
    const rollbackParentId = this.#actorSystem.getParentId(sourceView.viewActor);
    try {
      sourceView.frameActor = targetFrame;
      sourceView.framePort = targetPort;
      this.#actorSystem.setParent(sourceView.viewActor, targetFrame);
      this.recordViewActivation(sourceView);
      this.#windowFocus?.focusActorWindow(targetFrame, toWindowFocusReason(intent.reason));
    } catch (error) {
      sourceView.frameActor = sourceFrame;
      sourceView.framePort = sourcePort;
      this.restoreWorkspaceGraphSnapshot(result.rollbackSnapshot);
      if (this.#actorSystem.hasActor(sourceView.viewActor)) {
        try {
          this.#actorSystem.setParent(sourceView.viewActor, rollbackParentId);
        } catch {
          // Preserve the original mutation failure; graph/live view state has already been restored.
        }
      }
      return { committed: false, reason: describeError(error, "dock merge failed") };
    }

    const remainingSourceViews = this.listLiveViewsForFrame(sourceFrame);
    if (remainingSourceViews.length > 0 || !this.#actorSystem.hasActor(sourceFrame)) {
      return { committed: true, sourceFrameDestroyed: false };
    }
    const destroy = this.destroyEmptyFrameIfAllowed(sourceFrame, "source frame destroy failed");
    if (destroy.warning) {
      return {
        committed: true,
        sourceFrameDestroyed: false,
        warning: destroy.warning
      };
    }
    return { committed: true, sourceFrameDestroyed: destroy.destroyed };
  }

  getLiveView(viewKey: WindowViewKey): LiveWindowView | null {
    const liveView = this.getLiveViewByViewKey(viewKey);
    if (!liveView) return null;
    if (
      !this.#actorSystem.hasActor(liveView.frameActor) ||
      !this.#actorSystem.hasActor(liveView.viewActor)
    ) {
      this.#liveViews.delete(toLiveViewKey(liveView));
      return null;
    }
    return liveView;
  }

  getLiveViewByActorId(viewActorId: string): LiveWindowView | null {
    this.pruneLiveViews();
    for (const liveView of this.#liveViews.values()) {
      if (liveView.viewActor.id === viewActorId) return liveView;
    }
    return null;
  }

  listLiveViews(): readonly LiveWindowView[] {
    this.pruneLiveViews();
    return [...this.#liveViews.values()];
  }

  getLocationByViewKey(viewKey: WindowViewKey): WindowViewLocation | null {
    const liveView = this.getLiveView(viewKey);
    return liveView ? this.toLocation(liveView) : null;
  }

  getLocationByViewActorId(viewActorId: string): WindowViewLocation | null {
    const liveView = this.getLiveViewByActorId(viewActorId);
    return liveView ? this.toLocation(liveView) : null;
  }

  listLocations(): readonly WindowViewLocation[] {
    return this.listLiveViews().map((liveView) => this.toLocation(liveView));
  }

  listWorkspaceGraphFrameSurfaceSnapshots(): readonly WindowFrameSurfaceSnapshot[] {
    return this.refreshWorkspaceGraphProjection().frameSnapshots;
  }

  listWorkspaceGraphSurfaceGeometries(): readonly WindowWorkspaceSurfaceGeometryProjection[] {
    this.refreshWorkspaceGraphProjection();
    return [...this.#workspaceSurfaceGeometryByFrameId.values()];
  }

  getWorkspaceGraphSnapshot(): WindowWorkspaceGraphSnapshot {
    this.refreshWorkspaceGraphProjection();
    return this.#workspaceGraphSnapshot;
  }

  createFrameLayoutSnapshot(): WindowWorkspaceFrameLayout {
    const graphSnapshot = this.getWorkspaceGraphSnapshot();
    const liveViews = this.listLiveViews();
    const viewsByActorId = new Map(liveViews.map((liveView) => [liveView.viewActor.id, liveView]));
    const views = Object.fromEntries(liveViews.map((liveView) => [
      liveView.viewKey,
      this.toViewDescriptor(liveView)
    ]));
    const framesById = new Map<string, WindowWorkspaceFrameLayout["frames"][number]>();
    for (const frame of graphSnapshot.frames) {
      if (frame.kind === "runtime") continue;
      const root = mapGraphDockRootToViewKeys(frame.root, viewsByActorId);
      if (!root) continue;
      const liveView = this.findFirstLiveViewForGraphFrame(frame.frameId);
      const framePort = liveView?.framePort ?? this.getFramePortById(frame.frameId);
      if (!framePort) continue;
      const fullscreenRestore = this.findFullscreenRestoreBySourceFrameId(frame.frameId);
      const bounds = fullscreenRestore?.sourceBounds ?? framePort.getFloatingBounds();
      framesById.set(frame.frameId, {
        frameId: frame.frameId,
        bounds: {
          position: uiVec2(Math.round(bounds.left), Math.round(bounds.top)),
          size: uiVec2(Math.round(bounds.width), Math.round(bounds.height)),
          visible: fullscreenRestore
            ? fullscreenRestore.sourceVisibleBeforeRun ?? framePort.visible
            : framePort.visible
        },
        presentation: fullscreenRestore?.sourcePresentation ?? framePort.presentation,
        root
      });
    }
    for (const session of this.#fullscreenSessionsByViewActorId.values()) {
      if (session.mode !== "isolated-frame") continue;
      const root = mapGraphDockRootToViewKeys(session.restore.sourceFrameSnapshot.root, viewsByActorId);
      if (!root) continue;
      const bounds = session.restore.sourceBounds;
      framesById.set(session.restore.sourceFrameId, {
        frameId: session.restore.sourceFrameId,
        bounds: {
          position: uiVec2(Math.round(bounds.left), Math.round(bounds.top)),
          size: uiVec2(Math.round(bounds.width), Math.round(bounds.height)),
          visible: session.restore.sourceVisibleBeforeRun ?? true
        },
        presentation: session.restore.sourcePresentation,
        root
      });
    }
    return normalizeWindowWorkspaceFrameLayout({
      views,
      frames: [...framesById.values()],
      hiddenViewKeys: []
    });
  }

  restoreFrameLayout(
    layout: WindowWorkspaceFrameLayout,
    reason: Extract<WindowFrameLifecycleReason, "programmatic">
  ): WindowFrameLayoutRestoreResult {
    const normalized = normalizeWindowWorkspaceFrameLayout(layout);
    const visibleViewKeys = listLayoutVisibleViewKeys(normalized);
    const skippedViewKeys: WindowViewKey[] = [];
    const preferredFrameIdByViewKey = mapPreferredFrameIdsByViewKey(normalized);

    for (const viewKey of visibleViewKeys) {
      if (this.getLiveView(viewKey)) continue;
      if (!this.#factories.get(viewKey)) {
        skippedViewKeys.push(viewKey);
        continue;
      }
      try {
        this.openView(viewKey, reason, {
          preferredFrameId: preferredFrameIdByViewKey.get(viewKey)
        });
      } catch {
        skippedViewKeys.push(viewKey);
      }
    }

    const initialFrameActors = new Map(
      this.listLiveViews().map((liveView) => [liveView.frameActor.id, liveView.frameActor])
    );
    const liveViewsByKey = new Map(this.listLiveViews().map((liveView) => [liveView.viewKey, liveView]));
    const restorableViewKeys = new Set([...liveViewsByKey.keys()]);
    const restorableLayout = normalizeWindowWorkspaceFrameLayout({
      views: Object.fromEntries(
        Object.entries(normalized.views)
          .filter(([viewKey]) => restorableViewKeys.has(viewKey as WindowViewKey))
      ),
      frames: normalized.frames,
      hiddenViewKeys: normalized.hiddenViewKeys
    });
    const restoredViewKeys = new Set<WindowViewKey>();
    const targetFrameIds = new Set<string>();
    this.#cancelActiveInput?.();

    const graphContents = new Map<string, WindowWorkspaceGraphContentInput>();
    const graphFrames: WindowWorkspaceGraphFrameInput[] = [];
    for (const frame of restorableLayout.frames) {
      const frameViewKeys = collectFrameViewKeys(frame.root);
      const frameLiveViews = frameViewKeys
        .map((viewKey) => liveViewsByKey.get(viewKey))
        .filter((liveView): liveView is LiveWindowView => Boolean(liveView));
      if (frameLiveViews.length === 0) continue;
      const registeredTarget = this.getFramePortEntryById(frame.frameId);
      const targetLiveView = frameLiveViews[0];
      const targetFrame = registeredTarget?.frameActor ?? targetLiveView.frameActor;
      const targetPort = registeredTarget?.framePort ?? targetLiveView.framePort;
      if (!this.#actorSystem.hasActor(targetFrame)) continue;
      const graphRoot = mapFrameDockNodeToGraphDockNode(frame.root, liveViewsByKey);
      if (!graphRoot) continue;
      targetFrameIds.add(targetFrame.id);

      targetPort.restoreFloatingState(frame.bounds);
      targetPort.setPresentation(shouldRestoreFrameFullscreen(frame.root) ? frame.presentation : "windowed");

      for (const liveView of frameLiveViews) {
        graphContents.set(createWindowWorkspaceContentId(liveView.identity), {
          contentId: createWindowWorkspaceContentId(liveView.identity),
          identity: liveView.identity
        });
        liveView.frameActor = targetFrame;
        liveView.framePort = targetPort;
        if (this.#actorSystem.hasActor(liveView.viewActor) && this.#actorSystem.hasActor(targetFrame)) {
          this.#actorSystem.setParent(liveView.viewActor, targetFrame);
        }
        restoredViewKeys.add(liveView.viewKey);
      }
      graphFrames.push({
        frameId: windowWorkspaceFrameId(targetPort.frameId),
        kind: targetPort.persistable ? "persistent" : "runtime",
        root: graphRoot,
        presentation: targetPort.presentation,
        visible: targetPort.effectiveVisible,
        stackPriority: this.getFramePortEntryById(targetPort.frameId)?.getStackPriority() ?? 0
      });
      const activeLiveView = findActiveLiveViewInFrameDockNode(frame.root, liveViewsByKey);
      if (activeLiveView) {
        this.recordViewActivation(activeLiveView);
      }
      this.#windowFocus?.focusActorWindow(targetFrame, toWindowFocusReason(reason));
    }

    this.restoreWorkspaceGraphSnapshot(createWindowWorkspaceGraphSnapshot({
      revision: this.#workspaceGraphSnapshot.revision + 1,
      contents: [...graphContents.values()],
      frames: graphFrames
    }));

    const destroyedFrameIds: string[] = [];
    for (const [frameId, frameActor] of initialFrameActors) {
      if (targetFrameIds.has(frameId)) continue;
      if (!this.#actorSystem.hasActor(frameActor)) continue;
      if (this.listLiveViewsForFrame(frameActor).length > 0) continue;
      try {
        this.#actorSystem.destroyActor(frameActor);
        destroyedFrameIds.push(frameId);
      } catch {
        // Leave the frame live if teardown fails; the restored live view registry
        // has already moved away from it, so future reconcile can try again.
      }
    }

    return {
      restoredViewKeys: [...restoredViewKeys],
      skippedViewKeys,
      destroyedFrameIds
    };
  }

  activateView(
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
  ): void {
    const liveView = this.getLiveViewByActorId(viewActorId);
    if (!liveView) return;
    this.activateFrameTab(liveView.frameActor.id, viewActorId, reason);
  }

  focusOwner(
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "programmatic">
  ): void {
    const liveView = this.getLiveViewByActorId(viewActorId);
    if (!liveView) return;
    this.recordViewActivation(liveView);
    this.#windowFocus?.focusActorWindow(liveView.frameActor, toWindowFocusReason(reason));
  }

  setOwnerPresentation(
    viewActorId: string,
    presentation: Parameters<WindowFramePort["setPresentation"]>[0]
  ): void {
    const liveView = this.getLiveViewByActorId(viewActorId);
    liveView?.framePort.setPresentation(presentation);
  }

  requestOwnerVisible(viewActorId: string, visible: boolean, timeStamp?: number): void {
    const liveView = this.getLiveViewByActorId(viewActorId);
    liveView?.framePort.requestVisible(visible, timeStamp);
  }

  enterViewFullscreen(viewActorId: string, reason: WindowViewFullscreenReason): void {
    const existingSession = this.#fullscreenSessionsByViewActorId.get(viewActorId);
    if (existingSession) {
      const liveView = this.getLiveViewByActorId(viewActorId);
      liveView?.framePort.setPresentation("fullscreen");
      return;
    }
    const liveView = this.getLiveViewByActorId(viewActorId);
    if (!liveView) return;
    this.activateContentPlacement(liveView);
    const sourcePlacement = this.findWorkspaceGraphPlacementForLiveView(liveView);
    const sourceFrameSnapshot = sourcePlacement
      ? this.#workspaceGraphSnapshot.frames.find((frame) => frame.frameId === sourcePlacement.frameId) ?? null
      : null;
    if (!sourceFrameSnapshot) return;
    const sourceFrameContentCount = countGraphFrameContentIds(sourceFrameSnapshot.root);
    if (
      sourceFrameContentCount <= 1 &&
      this.canDestroyFrame(liveView.frameActor)
    ) {
      this.#fullscreenSessionsByViewActorId.set(viewActorId, {
        viewActorId,
        viewKey: liveView.viewKey,
        mode: "direct-frame",
        fullscreenFrameId: liveView.frameActor.id,
        previousPresentation: liveView.framePort.presentation
      });
      liveView.framePort.setPresentation("fullscreen");
      this.#windowFocus?.focusActorWindow(liveView.frameActor, toWindowFocusReason("programmatic"));
      return;
    }
    if (!sourcePlacement || !sourceFrameSnapshot) return;
    this.enterIsolatedViewFullscreen(liveView, sourcePlacement, sourceFrameSnapshot, reason);
  }

  enterViewWorkspaceFullscreen(viewActorId: string, reason: WindowViewFullscreenReason): void {
    const existingSession = this.#fullscreenSessionsByViewActorId.get(viewActorId);
    if (existingSession?.mode === "isolated-frame") {
      const liveView = this.getLiveViewByActorId(viewActorId);
      liveView?.framePort.setPresentation("fullscreen");
      return;
    }
    if (existingSession?.mode === "direct-frame") {
      this.exitViewFullscreen(viewActorId, reason);
    }
    const liveView = this.getLiveViewByActorId(viewActorId);
    if (!liveView) return;
    this.activateContentPlacement(liveView);
    const sourcePlacement = this.findWorkspaceGraphPlacementForLiveView(liveView);
    const sourceFrameSnapshot = sourcePlacement
      ? this.#workspaceGraphSnapshot.frames.find((frame) => frame.frameId === sourcePlacement.frameId) ?? null
      : null;
    if (!sourcePlacement || !sourceFrameSnapshot) return;
    this.enterIsolatedViewFullscreen(liveView, sourcePlacement, sourceFrameSnapshot, reason);
  }

  exitViewFullscreen(viewActorId: string, _reason: WindowViewFullscreenReason): void {
    const session = this.#fullscreenSessionsByViewActorId.get(viewActorId);
    if (!session) {
      const liveView = this.getLiveViewByActorId(viewActorId);
      liveView?.framePort.setPresentation("windowed");
      return;
    }
    if (session.mode === "direct-frame") {
      const liveView = this.getLiveViewByActorId(viewActorId);
      liveView?.framePort.setPresentation(session.previousPresentation === "fullscreen" ? "windowed" : session.previousPresentation);
      this.#fullscreenSessionsByViewActorId.delete(viewActorId);
      return;
    }
    this.exitIsolatedViewFullscreen(session);
  }

  getViewFullscreenSession(viewActorId: string): WindowViewFullscreenSession | null {
    const session = this.#fullscreenSessionsByViewActorId.get(viewActorId);
    if (!session) return null;
    return {
      viewActorId: session.viewActorId,
      viewKey: session.viewKey,
      mode: session.mode,
      fullscreenFrameId: session.fullscreenFrameId
    };
  }

  isViewFullscreenIsolated(viewActorId: string): boolean {
    return this.#fullscreenSessionsByViewActorId.get(viewActorId)?.mode === "isolated-frame";
  }

  private enterIsolatedViewFullscreen(
    liveView: LiveWindowView,
    sourcePlacement: WindowWorkspaceGraphPlacement,
    sourceFrameSnapshot: WindowWorkspaceGraphFrameSnapshot,
    reason: WindowViewFullscreenReason
  ): void {
    if (!this.#createFloatingFrame) {
      liveView.framePort.setPresentation("fullscreen");
      return;
    }
    const sourceFrame = liveView.frameActor;
    const sourcePort = liveView.framePort;
    const sourceTab = this.createLiveViewTab(liveView);
    const restore: WindowViewFullscreenRestoreTarget = {
      sourceFrameId: sourceFrame.id,
      sourceFrameSnapshot,
      sourceTargetFrame: createFullscreenRestoreTargetFrame(
        sourceFrameSnapshot,
        createWindowWorkspaceContentId(liveView.identity)
      ),
      sourceTabsetId: sourcePlacement.tabsetId,
      sourceBounds: sourcePort.getFloatingBounds(),
      sourcePresentation: sourcePort.presentation,
      sourceVisiblePath: sourcePort.visiblePath,
      sourceVisibleBeforeRun: sourcePort.visible
    };
    let createdFrame: ReturnType<WindowFloatingFrameFactory> | null = null;
    let rollbackGraphSnapshot: WindowWorkspaceGraphSnapshot | null = null;
    const rollbackParentId = this.#actorSystem.getParentId(liveView.viewActor);
    this.#cancelActiveInput?.();
    try {
      createdFrame = this.#createFloatingFrame({
        source: {
          frameId: sourceFrame.id,
          viewActorId: liveView.viewActor.id,
          viewKey: liveView.viewKey
        },
        tab: sourceTab,
        bounds: restore.sourceBounds,
        reason: reason === "programmatic" ? "programmatic" : "programmatic",
        runtimeOnly: true
      });
      const createdSurface = asWorkspaceGraphFrameSurface(createdFrame.framePort);
      if (!createdSurface) {
        throw new Error(`Fullscreen frame has no graph surface: ${createdFrame.framePort.frameId}.`);
      }
      const contentId = createWindowWorkspaceContentId(liveView.identity);
      const result = this.commitWorkspaceGraphTransaction({
        kind: "float-content",
        contentId,
        frameId: windowWorkspaceFrameId(createdFrame.framePort.frameId),
        tabsetId: createDerivedGraphTabsetId(createdFrame.framePort.frameId, contentId),
        kindOfFrame: "runtime",
        presentation: "fullscreen",
        visible: createdFrame.framePort.effectiveVisible,
        stackPriority: this.getFramePortEntryById(createdFrame.framePort.frameId)?.getStackPriority() ?? 0,
        preserveEmptyFrameIds: this.canDestroyFrame(sourceFrame)
          ? []
          : [windowWorkspaceFrameId(sourceFrame.id)]
      }, {
        extraFrameSurfaces: [{
          frameId: createdFrame.framePort.frameId,
          surface: createdSurface
        }]
      });
      if (!result.committed) {
        throw new Error(describeGraphTransactionFailure(result, "fullscreen isolate failed"));
      }
      rollbackGraphSnapshot = result.rollbackSnapshot;
      liveView.frameActor = createdFrame.frameActor;
      liveView.framePort = createdFrame.framePort;
      this.#actorSystem.setParent(liveView.viewActor, createdFrame.frameActor);
      createdFrame.framePort.setPresentation("fullscreen");
      this.#fullscreenSessionsByViewActorId.set(liveView.viewActor.id, {
        viewActorId: liveView.viewActor.id,
        viewKey: liveView.viewKey,
        mode: "isolated-frame",
        fullscreenFrameId: createdFrame.frameActor.id,
        restore,
        tab: sourceTab
      });
      this.#windowFocus?.focusActorWindow(createdFrame.frameActor, toWindowFocusReason("programmatic"));
    } catch {
      liveView.frameActor = sourceFrame;
      liveView.framePort = sourcePort;
      if (rollbackGraphSnapshot) {
        this.restoreWorkspaceGraphSnapshot(rollbackGraphSnapshot);
      }
      if (createdFrame && this.#actorSystem.hasActor(createdFrame.frameActor)) {
        this.#actorSystem.destroyActor(createdFrame.frameActor);
      }
      if (this.#actorSystem.hasActor(liveView.viewActor)) {
        try {
          this.#actorSystem.setParent(liveView.viewActor, rollbackParentId);
        } catch {
          // Keep the original fullscreen failure behavior.
        }
      }
      sourcePort.setPresentation("fullscreen");
    }
  }

  private exitIsolatedViewFullscreen(session: Extract<ManagedWindowViewFullscreenSession, { mode: "isolated-frame" }>): void {
    const liveView = this.getLiveViewByActorId(session.viewActorId);
    if (!liveView) {
      this.#fullscreenSessionsByViewActorId.delete(session.viewActorId);
      return;
    }
    this.#cancelActiveInput?.();
    const fullscreenFrame = this.#actorSystem.getActor(session.fullscreenFrameId);
    const fullscreenPort = this.getFramePortById(session.fullscreenFrameId) ?? liveView.framePort;
    fullscreenPort.setPresentation("windowed");
    const sourceFrame = this.#actorSystem.getActor(session.restore.sourceFrameId);
    const sourcePort = sourceFrame ? this.getFramePortById(sourceFrame.id) : null;
    if (!sourceFrame || !sourcePort) {
      this.restoreIsolatedFullscreenFallback(liveView, session, fullscreenFrame, fullscreenPort);
      this.#fullscreenSessionsByViewActorId.delete(session.viewActorId);
      return;
    }

    try {
      const contentId = createWindowWorkspaceContentId(liveView.identity);
      const result = this.commitWorkspaceGraphTransaction({
        kind: "move-content",
        contentId,
        targetFrameId: windowWorkspaceFrameId(sourcePort.frameId),
        targetTabsetId: session.restore.sourceTabsetId,
        targetFrame: session.restore.sourceTargetFrame,
        replaceTargetFrameIfMissingTabset: true,
        active: true,
        preserveEmptyFrameIds: this.canDestroyFrame(fullscreenFrame ?? liveView.frameActor)
          ? []
          : [windowWorkspaceFrameId(session.fullscreenFrameId)]
      }, {
        extraFrameSurfaces: createExtraFrameSurface(sourcePort)
      });
      if (!result.committed) {
        throw new Error(describeGraphTransactionFailure(result, "fullscreen restore failed"));
      }
      liveView.frameActor = sourceFrame;
      liveView.framePort = sourcePort;
      this.#actorSystem.setParent(liveView.viewActor, sourceFrame);
      this.#windowFocus?.focusActorWindow(sourceFrame, toWindowFocusReason("programmatic"));
      if (fullscreenFrame && this.#actorSystem.hasActor(fullscreenFrame)) {
        this.#actorSystem.destroyActor(fullscreenFrame);
      }
    } catch {
      this.restoreIsolatedFullscreenFallback(liveView, session, fullscreenFrame, fullscreenPort);
    } finally {
      this.#fullscreenSessionsByViewActorId.delete(session.viewActorId);
    }
  }

  private restoreIsolatedFullscreenFallback(
    liveView: LiveWindowView,
    session: Extract<ManagedWindowViewFullscreenSession, { mode: "isolated-frame" }>,
    fullscreenFrame: Actor | null,
    fullscreenPort: WindowFramePort
  ): void {
    if (this.#createFloatingFrame) {
      try {
        const created = this.#createFloatingFrame({
          source: {
            frameId: session.restore.sourceFrameId,
            viewActorId: liveView.viewActor.id,
            viewKey: liveView.viewKey
          },
          tab: session.tab,
          bounds: session.restore.sourceBounds,
          reason: "programmatic"
        });
        const createdSurface = asWorkspaceGraphFrameSurface(created.framePort);
        if (!createdSurface) {
          throw new Error(`Fallback frame has no graph surface: ${created.framePort.frameId}.`);
        }
        const contentId = createWindowWorkspaceContentId(liveView.identity);
        const result = this.commitWorkspaceGraphTransaction({
          kind: "float-content",
          contentId,
          frameId: windowWorkspaceFrameId(created.framePort.frameId),
          tabsetId: createDerivedGraphTabsetId(created.framePort.frameId, contentId),
          kindOfFrame: created.framePort.persistable ? "persistent" : "runtime",
          presentation: "windowed",
          visible: created.framePort.effectiveVisible,
          stackPriority: this.getFramePortEntryById(created.framePort.frameId)?.getStackPriority() ?? 0,
          preserveEmptyFrameIds: this.canDestroyFrame(fullscreenFrame ?? liveView.frameActor)
            ? []
            : [windowWorkspaceFrameId(session.fullscreenFrameId)]
        }, {
          extraFrameSurfaces: [{
            frameId: created.framePort.frameId,
            surface: createdSurface
          }]
        });
        if (!result.committed) {
          throw new Error(describeGraphTransactionFailure(result, "fullscreen fallback failed"));
        }
        liveView.frameActor = created.frameActor;
        liveView.framePort = created.framePort;
        if (this.#actorSystem.hasActor(liveView.viewActor) && this.#actorSystem.hasActor(created.frameActor)) {
          this.#actorSystem.setParent(liveView.viewActor, created.frameActor);
        }
        created.framePort.setPresentation("windowed");
        this.#windowFocus?.focusActorWindow(created.frameActor, toWindowFocusReason("programmatic"));
        if (fullscreenFrame && this.#actorSystem.hasActor(fullscreenFrame)) {
          this.#actorSystem.destroyActor(fullscreenFrame);
        }
        return;
      } catch {
        // Keep the view reachable in the isolation frame if creating a normal
        // fallback frame fails.
      }
    }
    if (fullscreenFrame) {
      liveView.frameActor = fullscreenFrame;
      liveView.framePort = fullscreenPort;
      if (this.#actorSystem.hasActor(liveView.viewActor) && this.#actorSystem.hasActor(fullscreenFrame)) {
        this.#actorSystem.setParent(liveView.viewActor, fullscreenFrame);
      }
      fullscreenPort.setPresentation("windowed");
      this.#windowFocus?.focusActorWindow(fullscreenFrame, toWindowFocusReason("programmatic"));
    }
  }

  private trackCreatedViewRuntime(
    viewKey: WindowViewKey,
    created: WindowViewRuntimeFactoryResult,
    frameActor: Actor,
    framePort: WindowFramePort
  ): void {
    const identity = this.getIdentityForViewKey(viewKey);
    this.#liveViews.set(createWindowViewIdentityKey(identity), {
      identity,
      viewKey,
      frameActor,
      framePort,
      viewActor: created.viewActor,
      content: created.content,
      disposeViewRuntime: created.disposeViewRuntime,
      activationSequence: this.nextActivationSequence()
    });
  }

  private tryOpenViewRuntimeInFrame(
    viewKey: WindowViewKey,
    preferredFrameId: string,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">
  ): boolean {
    const targetEntry = this.getFramePortEntryById(preferredFrameId);
    if (!targetEntry || !this.#actorSystem.hasActor(targetEntry.frameActor)) return false;
    this.ensureWorkspaceGraphFrame(targetEntry.framePort);
    this.openViewRuntimeInFrameEntry(viewKey, targetEntry.frameActor, targetEntry.framePort, reason);
    return true;
  }

  private openViewRuntimeInFrameEntry(
    viewKey: WindowViewKey,
    targetFrameActor: Actor,
    targetFramePort: WindowFramePort,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">
  ): void {
    this.ensureWorkspaceGraphFrame(targetFramePort);
    const targetTabsetId = this.findFirstWorkspaceGraphTabsetIdForFrame(targetFramePort.frameId);
    if (!targetTabsetId) {
      throw new Error(`Target frame has no tabset: ${targetFramePort.frameId}.`);
    }
    const created = this.#factories.createViewRuntime(viewKey, {
      reason,
      parentFrameActor: targetFrameActor,
      contentRegistration: this.#contentRegistration
    });
    const identity = this.getIdentityForViewKey(viewKey);
    try {
      if (this.#actorSystem.hasActor(created.viewActor)) {
        this.#actorSystem.setParent(created.viewActor, targetFrameActor);
      }
      this.trackCreatedViewRuntime(viewKey, created, targetFrameActor, targetFramePort);
      const contentId = createWindowWorkspaceContentId(identity);
      const targetFrameId = windowWorkspaceFrameId(targetFramePort.frameId);
      const addResult = this.commitWorkspaceGraphTransaction({
            kind: "add-content",
            content: { contentId, identity },
            targetFrameId,
            targetTabsetId,
            active: true
          }, {
        extraFrameSurfaces: createExtraFrameSurface(targetFramePort)
      });
      if (!addResult.committed) {
        throw new Error(addResult.warnings.join("; ") || "graph add content failed");
      }
      this.#windowFocus?.focusActorWindow(targetFrameActor, toWindowFocusReason(reason));
    } catch (error) {
      this.#liveViews.delete(createWindowViewIdentityKey(identity));
      try {
        created.disposeViewRuntime?.();
      } catch {
        // Continue actor cleanup; the original open error is more useful.
      }
      if (this.#actorSystem.hasActor(created.viewActor)) {
        this.#actorSystem.destroyActor(created.viewActor);
      }
      throw error;
    }
  }

  private findFirstWorkspaceGraphTabsetIdForFrame(frameId: string) {
    this.refreshWorkspaceGraphProjection();
    const frame = this.#workspaceGraphSnapshot.frames.find((candidate) =>
      candidate.frameId === windowWorkspaceFrameId(frameId)
    );
    return frame ? findFirstWorkspaceGraphTabsetId(frame.root) : null;
  }

  private ensureWorkspaceGraphFrame(framePort: WindowFramePort): void {
    this.refreshWorkspaceGraphProjection();
    const frameId = windowWorkspaceFrameId(framePort.frameId);
    if (this.#workspaceGraphSnapshot.frames.some((frame) => frame.frameId === frameId)) return;
    const tabsetId = createDefaultWorkspaceGraphTabsetId();
    const contents = this.#workspaceGraphSnapshot.placements.map((placement) => ({
      contentId: placement.contentId,
      identity: placement.identity
    }));
    this.#workspaceGraphSnapshot = createWindowWorkspaceGraphSnapshot({
      revision: this.#workspaceGraphSnapshot.revision + 1,
      contents,
      frames: [
        ...this.#workspaceGraphSnapshot.frames,
        this.createEmptyWorkspaceGraphFrameInput(framePort, tabsetId)
      ]
    });
    this.#workspaceGraphProjection = null;
    this.refreshWorkspaceGraphProjection();
  }

  private findWorkspaceGraphTabset(frameId: string, tabsetId: string) {
    this.refreshWorkspaceGraphProjection();
    const frame = this.#workspaceGraphSnapshot.frames.find((candidate) =>
      candidate.frameId === windowWorkspaceFrameId(frameId)
    );
    return frame ? findWorkspaceGraphTabset(frame.root, windowWorkspaceTabsetId(tabsetId)) : null;
  }

  private createEmptyWorkspaceGraphFrameInput(
    framePort: WindowFramePort,
    tabsetId: string
  ): WindowWorkspaceGraphFrameInput {
    return {
      frameId: windowWorkspaceFrameId(framePort.frameId),
      kind: framePort.persistable ? "persistent" : "runtime",
      presentation: framePort.presentation,
      visible: framePort.effectiveVisible,
      stackPriority: this.getFramePortEntryById(framePort.frameId)?.getStackPriority() ?? 0,
      root: {
        kind: "tabset",
        id: windowWorkspaceTabsetId(tabsetId),
        contentIds: [],
        activeContentId: null
      }
    };
  }

  private disposeLiveViewRuntimeForClose(liveView: LiveWindowView): {
    readonly disposed: true;
  } | {
    readonly disposed: false;
    readonly reason: string;
    readonly error?: string;
  } {
    if (!liveView.disposeViewRuntime) {
      return {
        disposed: false,
        reason: "view runtime cleanup is not configured"
      };
    }
    try {
      liveView.disposeViewRuntime();
      return { disposed: true };
    } catch (error) {
      return {
        disposed: false,
        reason: "view runtime cleanup failed",
        error: describeError(error, "view runtime cleanup failed")
      };
    }
  }

  private validateCloseViewIdentity(liveView: LiveWindowView, options: WindowCloseViewOptions): {
    readonly valid: true;
  } | {
    readonly valid: false;
    readonly reason: string;
  } {
    if (options.viewKey !== undefined && options.viewKey !== liveView.viewKey) {
      return { valid: false, reason: "view key mismatch" };
    }
    if (options.identity !== undefined && createWindowViewIdentityKey(options.identity) !== toLiveViewKey(liveView)) {
      return { valid: false, reason: "view identity mismatch" };
    }
    if (options.ownerFrameId !== undefined && options.ownerFrameId !== liveView.frameActor.id) {
      return { valid: false, reason: "owner frame mismatch" };
    }
    return { valid: true };
  }

  private listLiveViewsForFrame(frameActor: Actor): readonly LiveWindowView[] {
    return [...this.#liveViews.values()]
      .filter((liveView) => liveView.frameActor === frameActor);
  }

  private toLocation(liveView: LiveWindowView): WindowViewLocation {
    const graphPlacement = this.findWorkspaceGraphPlacementForLiveView(liveView);
    return {
      viewKey: liveView.viewKey,
      identity: liveView.identity,
      viewActorId: liveView.viewActor.id,
      ownerFrameActorId: liveView.frameActor.id,
      ownerFrameVisiblePath: liveView.framePort.visiblePath,
      ownerFrameVisible: liveView.framePort.visible,
      ownerFrameActiveInHierarchy: this.#actorSystem.isActorActive(liveView.frameActor),
      activeInFrame: graphPlacement?.active ?? false,
      visibleInFrame: graphPlacement?.interactable ?? false,
      presentation: liveView.framePort.presentation,
      activationSequence: liveView.activationSequence
    };
  }

  private activateContentPlacement(liveView: LiveWindowView): boolean {
    const result = this.commitWorkspaceGraphTransaction({
      kind: "activate-content",
      contentId: createWindowWorkspaceContentId(liveView.identity)
    });
    return result.committed;
  }

  private commitWorkspaceGraphTransaction(
    transaction: WindowWorkspaceGraphTransaction,
    options: {
      readonly extraFrameSurfaces?: readonly {
        readonly frameId: string;
        readonly surface: WindowWorkspaceGraphFrameSurface;
      }[];
    } = {}
  ): WindowWorkspaceGraphTransactionReconcileResult<WindowWorkspaceGraphFrameSurface> {
    this.refreshWorkspaceGraphProjection();
    const liveViews = this.listLiveViews();
    const liveViewByIdentityKey = this.rebuildWorkspaceGraphRealization(liveViews);
    for (const extra of options.extraFrameSurfaces ?? []) {
      this.#workspaceGraphRealization.setFrameSurface(windowWorkspaceFrameId(extra.frameId), extra.surface);
    }
    const result = reconcileWindowWorkspaceGraphTransaction({
      snapshot: this.#workspaceGraphSnapshot,
      transaction,
      realization: this.#workspaceGraphRealization.map,
      getTitle: (identity) => {
        const liveView = liveViewByIdentityKey.get(createWindowViewIdentityKey(identity));
        return liveView ? getLiveViewTitle(liveView) : undefined;
      }
    });
    if (!result.committed || !result.projection) return result;
    this.#workspaceGraphSnapshot = result.nextSnapshot;
    this.#workspaceGraphProjection = result.projection;
    this.#workspaceSurfaceGeometryByFrameId = new Map(
      result.projection.surfaceGeometries.map((geometry) => [geometry.frameId, geometry])
    );
    this.#workspaceGraphBootstrapSignature = this.createWorkspaceGraphRuntimeSignature(liveViews);
    return result;
  }

  private findWorkspaceGraphPlacementForLiveView(liveView: LiveWindowView): WindowWorkspaceGraphPlacement | null {
    this.refreshWorkspaceGraphProjection();
    const contentId = createWindowWorkspaceContentId(liveView.identity);
    return this.#workspaceGraphSnapshot.placements.find((placement) => placement.contentId === contentId) ?? null;
  }

  private findFirstActiveViewActorIdInFrame(snapshot: WindowWorkspaceGraphSnapshot, frameId: string): string | null {
    const placement = snapshot.placements.find((candidate) =>
      candidate.frameId === windowWorkspaceFrameId(frameId) && candidate.active
    );
    return placement
      ? this.#workspaceGraphRealization.map.getViewActorId(placement.identity)
      : null;
  }

  private restoreWorkspaceGraphSnapshot(snapshot: WindowWorkspaceGraphSnapshot): void {
    this.#workspaceGraphSnapshot = snapshot;
    const liveViews = this.listLiveViews();
    const liveViewByIdentityKey = this.rebuildWorkspaceGraphRealization(liveViews);
    const projection = reconcileWindowWorkspaceGraphCommit({
      commit: createWindowWorkspaceGraphCommit({
        previous: snapshot,
        next: snapshot
      }),
      realization: this.#workspaceGraphRealization.map,
      getTitle: (identity) => {
        const liveView = liveViewByIdentityKey.get(createWindowViewIdentityKey(identity));
        return liveView ? getLiveViewTitle(liveView) : undefined;
      }
    });
    this.#workspaceGraphProjection = projection;
    this.#workspaceSurfaceGeometryByFrameId = new Map(
      projection.surfaceGeometries.map((geometry) => [geometry.frameId, geometry])
    );
    this.#workspaceGraphBootstrapSignature = this.createWorkspaceGraphRuntimeSignature(liveViews);
  }

  private recordViewActivation(liveView: LiveWindowView): void {
    liveView.activationSequence = this.nextActivationSequence();
  }

  private nextActivationSequence(): number {
    this.#activationSequence += 1;
    return this.#activationSequence;
  }

  private toViewDescriptor(liveView: LiveWindowView): WindowWorkspaceViewDescriptor {
    const factoryTitle = this.#factories.get(liveView.viewKey)?.label;
    return {
      viewKey: liveView.viewKey,
      identity: liveView.identity,
      actorId: liveView.viewActor.id,
      title: factoryTitle
    };
  }

  private createLiveViewTab(liveView: LiveWindowView): WindowFrameTab {
    return {
      viewActorId: liveView.viewActor.id,
      identity: liveView.identity,
      viewKey: liveView.viewKey,
      title: getLiveViewTitle(liveView, this.#factories.get(liveView.viewKey)?.label)
    };
  }

  private findFullscreenRestoreBySourceFrameId(frameId: string): WindowViewFullscreenRestoreTarget | null {
    for (const session of this.#fullscreenSessionsByViewActorId.values()) {
      if (session.mode === "isolated-frame" && session.restore.sourceFrameId === frameId) {
        return session.restore;
      }
    }
    return null;
  }

  private findFirstLiveViewForGraphFrame(frameId: string): LiveWindowView | null {
    for (const placement of this.#workspaceGraphSnapshot.placements) {
      if (placement.frameId !== frameId) continue;
      const viewActorId = this.#workspaceGraphRealization.map.getViewActorId(placement.identity);
      const liveView = viewActorId ? this.getLiveViewByActorId(viewActorId) : null;
      if (liveView) return liveView;
    }
    return null;
  }

  private getFramePortById(frameId: string): WindowFramePort | null {
    return this.getFramePortEntryById(frameId)?.framePort ?? null;
  }

  private getFramePortEntryById(frameId: string): WindowFramePortRegistryEntry | null {
    const registered = this.#framePorts?.get(frameId);
    if (registered) return registered;
    const frameActor = this.#actorSystem.getActor(frameId);
    if (!frameActor) return null;
    const liveView = this.listLiveViewsForFrame(frameActor)[0];
    return liveView
      ? {
          frameActor,
          framePort: liveView.framePort,
          getStackPriority: () => 0
        }
      : null;
  }

  private refreshWorkspaceGraphProjection(): WindowWorkspaceGraphProjectionResult<WindowWorkspaceGraphFrameSurface> {
    const liveViews = this.listLiveViews();
    this.pruneWorkspaceGraphSnapshotToLiveViews(liveViews);
    const signature = this.createWorkspaceGraphRuntimeSignature(liveViews);
    if (signature === this.#workspaceGraphBootstrapSignature && this.#workspaceGraphProjection) {
      return this.#workspaceGraphProjection;
    }
    const liveViewByIdentityKey = this.rebuildWorkspaceGraphRealization(liveViews);
    const commit = createWindowWorkspaceGraphCommit({
      previous: this.#workspaceGraphSnapshot,
      next: this.#workspaceGraphSnapshot
    });
    const projection = reconcileWindowWorkspaceGraphCommit({
      commit,
      realization: this.#workspaceGraphRealization.map,
      getTitle: (identity) => {
        const liveView = liveViewByIdentityKey.get(createWindowViewIdentityKey(identity));
        return liveView ? getLiveViewTitle(liveView) : undefined;
      }
    });
    this.#workspaceSurfaceGeometryByFrameId = new Map(
      projection.surfaceGeometries.map((geometry) => [geometry.frameId, geometry])
    );
    this.#workspaceGraphProjection = projection;
    this.#workspaceGraphBootstrapSignature = signature;
    return this.#workspaceGraphProjection;
  }

  private createWorkspaceGraphRuntimeSignature(liveViews: readonly LiveWindowView[]): string {
    return JSON.stringify(liveViews.map((liveView) => ({
      identity: createWindowViewIdentityKey(liveView.identity),
      viewActorId: liveView.viewActor.id,
      frameId: liveView.framePort.frameId,
      visible: liveView.framePort.effectiveVisible,
      presentation: liveView.framePort.presentation,
      stackPriority: this.getFramePortEntryById(liveView.framePort.frameId)?.getStackPriority() ?? 0
    })));
  }

  private pruneWorkspaceGraphSnapshotToLiveViews(liveViews: readonly LiveWindowView[]): void {
    const liveContentIds = new Set(liveViews.map((liveView) => createWindowWorkspaceContentId(liveView.identity)));
    let snapshot = this.#workspaceGraphSnapshot;
    let changed = false;
    for (const placement of this.#workspaceGraphSnapshot.placements) {
      if (liveContentIds.has(placement.contentId)) continue;
      const result = reduceWindowWorkspaceGraphTransaction({
        snapshot,
        transaction: {
          kind: "close-content",
          contentId: placement.contentId
        }
      });
      if (!result.committed) continue;
      snapshot = result.nextSnapshot;
      changed = true;
    }
    if (changed) {
      this.#workspaceGraphSnapshot = snapshot;
      this.#workspaceGraphProjection = null;
    }
  }

  private rebuildWorkspaceGraphRealization(
    liveViews: readonly LiveWindowView[]
  ): Map<string, LiveWindowView> {
    this.#workspaceGraphRealization = createWindowWorkspaceRealizationMap<WindowRegisteredContent, WindowWorkspaceGraphFrameSurface>();
    const liveViewByIdentityKey = new Map<string, LiveWindowView>();
    const realizedFrameIds = new Set<string>();
    for (const liveView of liveViews) {
      liveViewByIdentityKey.set(createWindowViewIdentityKey(liveView.identity), liveView);
      this.#workspaceGraphRealization.setContent(createWindowWorkspaceContentId(liveView.identity), liveView.content);
      this.#workspaceGraphRealization.setViewActorId(liveView.identity, liveView.viewActor.id);
      if (!realizedFrameIds.has(liveView.framePort.frameId)) {
        realizedFrameIds.add(liveView.framePort.frameId);
        const frameSurface = asWorkspaceGraphFrameSurface(liveView.framePort);
        if (frameSurface) {
          this.#workspaceGraphRealization.setFrameSurface(
            windowWorkspaceFrameId(liveView.framePort.frameId),
            frameSurface
          );
        }
      }
    }
    for (const entry of this.#framePorts?.list() ?? []) {
      if (realizedFrameIds.has(entry.framePort.frameId)) continue;
      realizedFrameIds.add(entry.framePort.frameId);
      const frameSurface = asWorkspaceGraphFrameSurface(entry.framePort);
      if (frameSurface) {
        this.#workspaceGraphRealization.setFrameSurface(
          windowWorkspaceFrameId(entry.framePort.frameId),
          frameSurface
        );
      }
    }
    return liveViewByIdentityKey;
  }

  private pruneLiveViews(): void {
    for (const [identityKey, liveView] of this.#liveViews) {
      if (
        this.#actorSystem.hasActor(liveView.frameActor) &&
        this.#actorSystem.hasActor(liveView.viewActor)
      ) {
        continue;
      }
      this.#liveViews.delete(identityKey);
    }
  }

  private getIdentityForViewKey(viewKey: WindowViewKey): WindowViewIdentity {
    const factory = this.#factories.get(viewKey);
    return factory
      ? this.#factories.getIdentity(viewKey)
      : createWindowViewIdentity({ viewKey });
  }

  private getLiveViewByViewKey(viewKey: WindowViewKey): LiveWindowView | null {
    const factory = this.#factories.get(viewKey);
    if (factory) {
      return this.#liveViews.get(createWindowViewIdentityKey(this.#factories.getIdentity(viewKey))) ?? null;
    }
    return [...this.#liveViews.values()].find((liveView) => liveView.viewKey === viewKey) ?? null;
  }

  private getLiveViewByIdentity(identity: WindowViewIdentity): LiveWindowView | null {
    return this.#liveViews.get(createWindowViewIdentityKey(identity)) ?? null;
  }

  private getMostRecentlyActivatedLiveViewByType(typeKey: WindowViewTypeKey): LiveWindowView | null {
    return [...this.#liveViews.values()]
      .filter((liveView) => liveView.identity.typeKey === typeKey)
      .sort((a, b) => b.activationSequence - a.activationSequence)[0] ?? null;
  }

  private commitFloatTab(
    intent: Extract<WindowDockCommitIntent, { readonly kind: "float-tab" }>,
    sourceView: LiveWindowView,
    sourceTab: WindowFramePortTab
  ): WindowDockCommitResult {
    if (!this.#createFloatingFrame) {
      return { committed: false, reason: "floating frame factory is not configured" };
    }
    const sourceFrame = sourceView.frameActor;
    const sourcePort = sourceView.framePort;
    const rollbackParentId = this.#actorSystem.getParentId(sourceView.viewActor);
    let createdFrame: ReturnType<WindowFloatingFrameFactory> | null = null;
    let rollbackGraphSnapshot: WindowWorkspaceGraphSnapshot | null = null;

    this.#cancelActiveInput?.();
    try {
      createdFrame = this.#createFloatingFrame({
        source: intent.source,
        tab: sourceTab,
        bounds: intent.bounds,
        reason: intent.reason
      });
      const createdSurface = asWorkspaceGraphFrameSurface(createdFrame.framePort);
      if (!createdSurface) {
        throw new Error(`Floating frame has no graph surface: ${createdFrame.framePort.frameId}.`);
      }
      const contentId = createWindowWorkspaceContentId(sourceView.identity);
      const result = this.commitWorkspaceGraphTransaction({
        kind: "float-content",
        contentId,
        frameId: windowWorkspaceFrameId(createdFrame.framePort.frameId),
        tabsetId: createDerivedGraphTabsetId(createdFrame.framePort.frameId, contentId),
        kindOfFrame: createdFrame.framePort.persistable ? "persistent" : "runtime",
        presentation: createdFrame.framePort.presentation,
        visible: createdFrame.framePort.effectiveVisible,
        stackPriority: this.getFramePortEntryById(createdFrame.framePort.frameId)?.getStackPriority() ?? 0,
        preserveEmptyFrameIds: this.canDestroyFrame(sourceFrame)
          ? []
          : [windowWorkspaceFrameId(sourceFrame.id)]
      }, {
        extraFrameSurfaces: [{
          frameId: createdFrame.framePort.frameId,
          surface: createdSurface
        }]
      });
      if (!result.committed) {
        sourceView.frameActor = sourceFrame;
        sourceView.framePort = sourcePort;
        if (createdFrame && this.#actorSystem.hasActor(createdFrame.frameActor)) {
          this.#actorSystem.destroyActor(createdFrame.frameActor);
        }
        return {
          committed: false,
          reason: describeGraphTransactionFailure(result, "dock float failed")
        };
      }
      rollbackGraphSnapshot = result.rollbackSnapshot;
      sourceView.frameActor = createdFrame.frameActor;
      sourceView.framePort = createdFrame.framePort;
      this.#actorSystem.setParent(sourceView.viewActor, createdFrame.frameActor);
      this.recordViewActivation(sourceView);
      this.#windowFocus?.focusActorWindow(createdFrame.frameActor, toWindowFocusReason(intent.reason));
    } catch (error) {
      sourceView.frameActor = sourceFrame;
      sourceView.framePort = sourcePort;
      if (rollbackGraphSnapshot) {
        this.restoreWorkspaceGraphSnapshot(rollbackGraphSnapshot);
      }
      if (this.#actorSystem.hasActor(sourceView.viewActor)) {
        try {
          this.#actorSystem.setParent(sourceView.viewActor, rollbackParentId);
        } catch {
          // Preserve the original failure.
        }
      }
      if (createdFrame && this.#actorSystem.hasActor(createdFrame.frameActor)) {
        this.#actorSystem.destroyActor(createdFrame.frameActor);
      }
      return { committed: false, reason: describeError(error, "dock float failed") };
    }

    const remainingSourceViews = this.listLiveViewsForFrame(sourceFrame);
    if (remainingSourceViews.length > 0 || !this.#actorSystem.hasActor(sourceFrame)) {
      return { committed: true, sourceFrameDestroyed: false };
    }
    const destroy = this.destroyEmptyFrameIfAllowed(sourceFrame, "source frame destroy failed");
    if (destroy.warning) {
      return {
        committed: true,
        sourceFrameDestroyed: false,
        warning: destroy.warning
      };
    }
    return { committed: true, sourceFrameDestroyed: destroy.destroyed };
  }

  private commitSameFrameMergeTab(
    intent: Extract<WindowDockCommitIntent, { readonly kind: "merge-tabs" }>,
    sourceView: LiveWindowView,
    sourceTab: WindowFramePortTab,
    framePort: WindowFramePort
  ): WindowDockCommitResult {
    void sourceTab;
    void framePort;
    this.#cancelActiveInput?.();
    const result = this.commitWorkspaceGraphTransaction({
      kind: "move-content",
      contentId: createWindowWorkspaceContentId(sourceView.identity),
      targetFrameId: windowWorkspaceFrameId(intent.targetFrameId),
      targetTabsetId: windowWorkspaceTabsetId(intent.targetTabsetId),
      active: true
    });
    if (!result.committed) {
      return {
        committed: false,
        reason: [...result.hardIssues, ...result.softIssues].map((issue) => issue.message).join("; ") ||
          "same-frame dock merge failed"
      };
    }

    this.recordViewActivation(sourceView);
    this.#windowFocus?.focusActorWindow(sourceView.frameActor, toWindowFocusReason(intent.reason));
    return { committed: true, sourceFrameDestroyed: false };
  }

  private commitSameFrameSplitTab(
    intent: Extract<WindowDockCommitIntent, { readonly kind: "split-tab" }>,
    sourceView: LiveWindowView,
    sourceTab: WindowFramePortTab,
    framePort: WindowFramePort
  ): WindowDockCommitResult {
    void sourceTab;
    void framePort;
    const contentId = createWindowWorkspaceContentId(sourceView.identity);
    this.#cancelActiveInput?.();
    const result = this.commitWorkspaceGraphTransaction({
      kind: "split-content",
      contentId,
      targetFrameId: windowWorkspaceFrameId(intent.targetFrameId),
      targetTabsetId: windowWorkspaceTabsetId(intent.targetTabsetId),
      newTabsetId: createDerivedGraphTabsetId(intent.targetTabsetId, contentId),
      newSplitId: createDerivedGraphSplitId(intent.targetTabsetId, contentId),
      placement: intent.placement,
      active: true
    });
    if (!result.committed) {
      return {
        committed: false,
        reason: [...result.hardIssues, ...result.softIssues].map((issue) => issue.message).join("; ") ||
          "same-frame dock split failed"
      };
    }

    this.recordViewActivation(sourceView);
    this.#windowFocus?.focusActorWindow(sourceView.frameActor, toWindowFocusReason(intent.reason));
    return { committed: true, sourceFrameDestroyed: false };
  }

  private commitSplitTab(
    intent: Extract<WindowDockCommitIntent, { readonly kind: "split-tab" }>,
    sourceView: LiveWindowView,
    sourceTab: WindowFramePortTab,
    targetFrame: Actor,
    targetPort: WindowFramePort
  ): WindowDockCommitResult {
    void sourceTab;
    const sourceFrame = sourceView.frameActor;
    const sourcePort = sourceView.framePort;
    this.#cancelActiveInput?.();
    const contentId = createWindowWorkspaceContentId(sourceView.identity);
    const result = this.commitWorkspaceGraphTransaction({
      kind: "split-content",
      contentId,
      targetFrameId: windowWorkspaceFrameId(intent.targetFrameId),
      targetTabsetId: windowWorkspaceTabsetId(intent.targetTabsetId),
      targetFrame: this.createEmptyWorkspaceGraphFrameInput(targetPort, intent.targetTabsetId),
      newTabsetId: createDerivedGraphTabsetId(intent.targetTabsetId, contentId),
      newSplitId: createDerivedGraphSplitId(intent.targetTabsetId, contentId),
      placement: intent.placement,
      active: true,
      preserveEmptyFrameIds: this.canDestroyFrame(sourceFrame)
        ? []
        : [windowWorkspaceFrameId(sourceFrame.id)]
    }, {
      extraFrameSurfaces: createExtraFrameSurface(targetPort)
    });
    if (!result.committed) {
      return {
        committed: false,
        reason: describeGraphTransactionFailure(result, "dock split failed")
      };
    }
    const rollbackParentId = this.#actorSystem.getParentId(sourceView.viewActor);
    try {
      sourceView.frameActor = targetFrame;
      sourceView.framePort = targetPort;
      this.#actorSystem.setParent(sourceView.viewActor, targetFrame);
      this.recordViewActivation(sourceView);
      this.#windowFocus?.focusActorWindow(targetFrame, toWindowFocusReason(intent.reason));
    } catch (error) {
      sourceView.frameActor = sourceFrame;
      sourceView.framePort = sourcePort;
      this.restoreWorkspaceGraphSnapshot(result.rollbackSnapshot);
      if (this.#actorSystem.hasActor(sourceView.viewActor)) {
        try {
          this.#actorSystem.setParent(sourceView.viewActor, rollbackParentId);
        } catch {
          // Preserve the original mutation failure; graph/live view state has already been restored.
        }
      }
      return { committed: false, reason: describeError(error, "dock split failed") };
    }

    const remainingSourceViews = this.listLiveViewsForFrame(sourceFrame);
    if (remainingSourceViews.length > 0 || !this.#actorSystem.hasActor(sourceFrame)) {
      return { committed: true, sourceFrameDestroyed: false };
    }
    const destroy = this.destroyEmptyFrameIfAllowed(sourceFrame, "source frame destroy failed");
    if (destroy.warning) {
      return {
        committed: true,
        sourceFrameDestroyed: false,
        warning: destroy.warning
      };
    }
    return { committed: true, sourceFrameDestroyed: destroy.destroyed };
  }

  private canDestroyFrame(frameActor: Actor): boolean {
    return this.getFramePortEntryById(frameActor.id)?.destroyWhenEmpty ?? true;
  }

  private destroyEmptyFrameIfAllowed(
    frameActor: Actor,
    warningPrefix: string
  ): { readonly destroyed: boolean; readonly warning?: string } {
    if (!this.canDestroyFrame(frameActor)) {
      return { destroyed: false };
    }
    try {
      if (this.#actorSystem.hasActor(frameActor)) {
        this.#actorSystem.destroyActor(frameActor);
      }
      return { destroyed: true };
    } catch (error) {
      return {
        destroyed: false,
        warning: describeError(error, warningPrefix)
      };
    }
  }

}

function mapGraphDockRootToViewKeys(
  node: WindowWorkspaceGraphDockNode,
  viewsByActorId: ReadonlyMap<string, LiveWindowView>
): WindowFrameDockNode | null {
  if (node.kind === "tabset") {
    const tabs: WindowViewKey[] = [];
    const seen = new Set<WindowViewKey>();
    for (const contentId of node.contentIds) {
      const liveView = [...viewsByActorId.values()]
        .find((candidate) => createWindowWorkspaceContentId(candidate.identity) === contentId);
      const viewKey = liveView?.viewKey;
      if (!viewKey || seen.has(viewKey)) continue;
      seen.add(viewKey);
      tabs.push(viewKey);
    }
    if (tabs.length === 0) return null;
    const activeLiveView = node.activeContentId
      ? [...viewsByActorId.values()]
        .find((candidate) => createWindowWorkspaceContentId(candidate.identity) === node.activeContentId)
      : null;
    const activeTabId = activeLiveView?.viewKey ?? null;
    return {
      kind: "tabset",
      id: node.id,
      tabs,
      activeTabId: activeTabId && tabs.includes(activeTabId) ? activeTabId : tabs[0]
    };
  }

  const first = mapGraphDockRootToViewKeys(node.first, viewsByActorId);
  const second = mapGraphDockRootToViewKeys(node.second, viewsByActorId);
  if (!first && !second) return null;
  if (!first) return second;
  if (!second) return first;
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first,
    second
  };
}

function countGraphFrameContentIds(node: WindowWorkspaceGraphDockNode): number {
  if (node.kind === "tabset") return node.contentIds.length;
  return countGraphFrameContentIds(node.first) + countGraphFrameContentIds(node.second);
}

function createFullscreenRestoreTargetFrame(
  frame: WindowWorkspaceGraphFrameSnapshot,
  movingContentId: string
): WindowWorkspaceGraphFrameSnapshot {
  return {
    ...frame,
    root: removeGraphContentForFullscreenRestore(frame.root, movingContentId)
  };
}

function removeGraphContentForFullscreenRestore(
  node: WindowWorkspaceGraphDockNode,
  movingContentId: string
): WindowWorkspaceGraphDockNode {
  if (node.kind === "tabset") {
    const contentIds = node.contentIds.filter((contentId) => contentId !== movingContentId);
    const activeContentId = node.activeContentId === movingContentId
      ? contentIds[0] ?? null
      : node.activeContentId;
    return {
      ...node,
      contentIds,
      activeContentId: activeContentId && contentIds.includes(activeContentId) ? activeContentId : contentIds[0] ?? null
    };
  }

  return {
    ...node,
    first: removeGraphContentForFullscreenRestore(node.first, movingContentId),
    second: removeGraphContentForFullscreenRestore(node.second, movingContentId)
  };
}

function mapFrameDockNodeToGraphDockNode(
  node: WindowFrameDockNode,
  liveViewsByKey: ReadonlyMap<WindowViewKey, LiveWindowView>
): WindowWorkspaceGraphDockNode | null {
  if (node.kind === "tabset") {
    const contentIds = [];
    const seen = new Set<string>();
    for (const viewKey of node.tabs) {
      const liveView = liveViewsByKey.get(viewKey);
      if (!liveView) continue;
      const contentId = createWindowWorkspaceContentId(liveView.identity);
      if (seen.has(contentId)) continue;
      seen.add(contentId);
      contentIds.push(contentId);
    }
    if (contentIds.length === 0) return null;
    const activeLiveView = liveViewsByKey.get(node.activeTabId);
    const activeContentId = activeLiveView ? createWindowWorkspaceContentId(activeLiveView.identity) : null;
    return {
      kind: "tabset",
      id: windowWorkspaceTabsetId(node.id),
      contentIds,
      activeContentId: activeContentId && contentIds.includes(activeContentId)
        ? activeContentId
        : contentIds[0] ?? null
    };
  }

  const first = mapFrameDockNodeToGraphDockNode(node.first, liveViewsByKey);
  const second = mapFrameDockNodeToGraphDockNode(node.second, liveViewsByKey);
  if (!first && !second) return null;
  if (!first) return second;
  if (!second) return first;
  return {
    kind: "split",
    id: windowWorkspaceSplitId(node.id),
    direction: node.direction,
    ratio: node.ratio,
    first,
    second
  };
}

function findActiveLiveViewInFrameDockNode(
  node: WindowFrameDockNode,
  liveViewsByKey: ReadonlyMap<WindowViewKey, LiveWindowView>
): LiveWindowView | null {
  if (node.kind === "tabset") {
    return liveViewsByKey.get(node.activeTabId) ?? liveViewsByKey.get(node.tabs[0]!) ?? null;
  }
  return findActiveLiveViewInFrameDockNode(node.first, liveViewsByKey) ??
    findActiveLiveViewInFrameDockNode(node.second, liveViewsByKey);
}

function getLiveViewTitle(liveView: LiveWindowView, factoryTitle?: string): string {
  return factoryTitle ?? liveView.viewKey;
}

function asWorkspaceGraphFrameSurface(framePort: WindowFramePort): WindowWorkspaceGraphFrameSurface | null {
  const candidate = framePort as WindowFramePort & Partial<WindowWorkspaceGraphReconcilerSurface<WindowRegisteredContent>>;
  return typeof candidate.renderFrameSurface === "function" &&
    typeof candidate.measureFrameSurfaceGeometry === "function" &&
    typeof candidate.placeContent === "function"
    ? candidate as WindowWorkspaceGraphFrameSurface
    : null;
}

function createExtraFrameSurface(framePort: WindowFramePort): readonly {
  readonly frameId: string;
  readonly surface: WindowWorkspaceGraphFrameSurface;
}[] {
  const surface = asWorkspaceGraphFrameSurface(framePort);
  return surface ? [{ frameId: framePort.frameId, surface }] : [];
}

function findFirstWorkspaceGraphTabsetId(node: WindowWorkspaceGraphDockNode): WindowWorkspaceTabsetId | null {
  if (node.kind === "tabset") return node.id;
  return findFirstWorkspaceGraphTabsetId(node.first) ?? findFirstWorkspaceGraphTabsetId(node.second);
}

function createDefaultWorkspaceGraphTabsetId(): WindowWorkspaceTabsetId {
  return windowWorkspaceTabsetId("frame-tabset:target");
}

function findWorkspaceGraphTabset(
  node: WindowWorkspaceGraphDockNode,
  tabsetId: WindowWorkspaceTabsetId
): WindowWorkspaceGraphTabsetNode | null {
  if (node.kind === "tabset") return node.id === tabsetId ? node : null;
  return findWorkspaceGraphTabset(node.first, tabsetId) ?? findWorkspaceGraphTabset(node.second, tabsetId);
}

function listLayoutVisibleViewKeys(layout: WindowWorkspaceFrameLayout): readonly WindowViewKey[] {
  const viewKeys: WindowViewKey[] = [];
  const seen = new Set<WindowViewKey>();
  for (const frame of layout.frames) {
    for (const viewKey of collectFrameViewKeys(frame.root)) {
      if (seen.has(viewKey)) continue;
      seen.add(viewKey);
      viewKeys.push(viewKey);
    }
  }
  return viewKeys;
}

function mapPreferredFrameIdsByViewKey(layout: WindowWorkspaceFrameLayout): ReadonlyMap<WindowViewKey, string> {
  const result = new Map<WindowViewKey, string>();
  for (const frame of layout.frames) {
    for (const viewKey of collectFrameViewKeys(frame.root)) {
      if (!result.has(viewKey)) {
        result.set(viewKey, frame.frameId);
      }
    }
  }
  return result;
}

function shouldRestoreFrameFullscreen(root: WindowFrameDockNode): boolean {
  return collectFrameViewKeys(root).length === 1;
}

function toLiveViewKey(liveView: LiveWindowView): string {
  return createWindowViewIdentityKey(liveView.identity);
}

function toWindowFocusReason(
  reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
): Extract<WindowFocusReason, "menu-restore" | "programmatic"> {
  return reason === "menu" ? "menu-restore" : "programmatic";
}

function invalidDockCommit(reason: string): WindowDockCommitValidationResult {
  return { valid: false, reason };
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function describeGraphTransactionFailure(
  result: {
    readonly hardIssues: readonly { readonly message: string }[];
    readonly softIssues: readonly { readonly message: string }[];
    readonly warnings: readonly string[];
  },
  fallback: string
): string {
  return [
    ...result.hardIssues.map((issue) => issue.message),
    ...result.softIssues.map((issue) => issue.message),
    ...result.warnings
  ].join("; ") || fallback;
}

function createDerivedGraphTabsetId(targetTabsetId: string, contentId: string) {
  return windowWorkspaceTabsetId(`${targetTabsetId}:tabset:${contentId}`);
}

function createDerivedGraphSplitId(targetTabsetId: string, contentId: string) {
  return windowWorkspaceSplitId(`${targetTabsetId}:split:${contentId}`);
}

function combineWarnings(warnings: readonly string[]): string | undefined {
  return warnings.length > 0 ? warnings.join("; ") : undefined;
}

function createWarningResult(warnings: readonly string[]): { readonly warning?: string } {
  const warning = combineWarnings(warnings);
  return warning ? { warning } : {};
}

function isUsableDockRect(rect: {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}): boolean {
  return Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.bottom) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0;
}

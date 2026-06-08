import type { Actor } from "../actor-runtime";
import type { WindowFocusCommandPort, WindowFocusReason } from "./window-focus-command-port";
import { ActorSystem } from "../actor-runtime";
import type {
  WindowDockCommitIntent,
  WindowDockCommitResult,
  WindowDockCommitValidationResult,
  WindowCloseFrameResult,
  WindowCloseViewResult,
  WindowCloseViewOptions,
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
import type { WindowContentRehostable } from "./floating-window-host";
import type { WindowFramePort, WindowFrameRuntimeDockNode } from "./window-frame-port";
import type { WindowFramePortRegistryEntry, WindowFramePortRegistryView } from "./window-frame-port-registry";
import type {
  WindowViewFactoryRegistry,
  WindowViewRuntimeFactoryResult
} from "./window-view-factory-registry";
import {
  createWindowViewIdentity,
  createWindowViewIdentityKey,
  type WindowViewIdentity,
  type WindowViewTypeKey
} from "./window-view-identity";
import type { WindowViewKey } from "./window-view-key";
import { uiVec2 } from "./ui-geometry";
import {
  collectFrameViewKeys,
  normalizeWindowWorkspaceFrameLayout,
  type WindowFrameDockNode,
  type WindowWorkspaceFrameLayout,
  type WindowWorkspaceViewDescriptor
} from "./window-workspace-layout";

export interface LiveWindowView {
  readonly identity: WindowViewIdentity;
  readonly viewKey: WindowViewKey;
  frameActor: Actor;
  framePort: WindowFramePort;
  readonly viewActor: Actor;
  readonly content: WindowContentRehostable;
  readonly disposeViewRuntime?: () => void;
  activationSequence: number;
}

type WindowFramePortTab = ReturnType<WindowFramePort["listTabs"]>[number];
type WindowFrameBounds = ReturnType<WindowFramePort["getFloatingBounds"]>;

interface WindowViewFullscreenRestoreTarget {
  readonly sourceFrameId: string;
  readonly sourceRoot: WindowFrameRuntimeDockNode;
  readonly sourceTabs: readonly WindowFramePortTab[];
  readonly sourceActiveViewActorId: string | null;
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
  readonly #liveViews = new Map<string, LiveWindowView>();
  readonly #fullscreenSessionsByViewActorId = new Map<string, ManagedWindowViewFullscreenSession>();
  #activationSequence = 0;

  constructor(options: WindowFrameLifecycleControllerOptions) {
    this.#actorSystem = options.actorSystem;
    this.#factories = options.factories;
    this.#windowFocus = options.windowFocus;
    this.#cancelActiveInput = options.cancelActiveInput;
    this.#createFloatingFrame = options.createFloatingFrame;
    this.#framePorts = options.framePorts;
  }

  openView(
    viewKey: WindowViewKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options: WindowOpenViewOptions = {}
  ): void {
    const liveView = this.getLiveView(viewKey);
    if (liveView) {
      liveView.framePort.activateTab(liveView.viewActor.id);
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
    liveView.framePort.activateTab(liveView.viewActor.id);
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
    const cleanedViewActorIds: string[] = [];
    for (const liveView of liveViews) {
      const cleanup = this.disposeLiveViewRuntimeForClose(liveView);
      if (!cleanup.disposed) {
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
    const sourcePort = currentLiveView.framePort;
    const nextActiveViewActorId = findRuntimeDockRootNextActiveViewActorIdAfterRemove(
      sourcePort.getRuntimeDockRoot(),
      viewActorId
    );
    const warnings: string[] = [];
    const cleanup = this.disposeLiveViewRuntimeForClose(currentLiveView);
    if (!cleanup.disposed) {
      return {
        closed: false,
        reason: cleanup.reason,
        sourceFrameId,
        error: cleanup.error
      };
    }

    try {
      sourcePort.removeTab(viewActorId);
    } catch (error) {
      warnings.push(describeError(error, "view tab removal failed"));
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

    if (nextActiveViewActorId && sourcePort.hasTab(nextActiveViewActorId)) {
      sourcePort.activateTab(nextActiveViewActorId);
      const nextLiveView = this.getLiveViewByActorId(nextActiveViewActorId);
      if (nextLiveView) {
        this.recordViewActivation(nextLiveView);
      }
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
    liveView.framePort.activateTab(viewActorId);
    this.recordViewActivation(liveView);
    this.#windowFocus?.focusActorWindow(liveView.frameActor, toWindowFocusReason(reason));
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
    if (!sourceView.framePort.hasTab(intent.source.viewActorId)) {
      return invalidDockCommit("source frame does not contain source tab");
    }
    if (intent.kind === "float-tab") {
      return isUsableDockRect(intent.bounds)
        ? { valid: true }
        : invalidDockCommit("floating bounds are invalid");
    }

    if (intent.targetFrameId === intent.source.frameId) {
      return invalidDockCommit("target frame is source frame");
    }
    const targetActor = this.#actorSystem.getActor(intent.targetFrameId);
    if (!targetActor) {
      return invalidDockCommit("target frame is missing");
    }
    const targetEntry = this.getFramePortEntryById(intent.targetFrameId);
    if (!targetEntry || !this.#actorSystem.hasActor(targetEntry.frameActor)) {
      return invalidDockCommit("target frame has no live views");
    }
    const targetPort = targetEntry.framePort;
    if (!targetPort.hasTabset(intent.targetTabsetId)) {
      return invalidDockCommit("target tabset is missing");
    }
    if (targetPort.hasTab(intent.source.viewActorId)) {
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
    const sourceTab = sourcePort.listTabs()
      .find((tab) => tab.viewActorId === sourceView.viewActor.id);
    if (!sourceTab) {
      return { committed: false, reason: "source frame does not contain source tab" };
    }
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
    if (intent.kind === "split-tab") {
      return this.commitSplitTab(intent, sourceView, sourceTab, targetFrame, targetPort);
    }

    const rollback = {
      parentId: this.#actorSystem.getParentId(sourceView.viewActor),
      sourceFrame,
      sourcePort,
      sourceActiveViewActorId: sourcePort.getFocusedViewActorId(),
      sourceTab,
      targetFrame,
      targetPort,
      targetActiveViewActorId: targetPort.getFocusedViewActorId()
    };

    this.#cancelActiveInput?.();
    try {
      sourceView.content.rehostWindowContent(targetPort.getContentHost(sourceView.viewActor.id));
      sourcePort.removeTab(sourceView.viewActor.id);
      targetPort.addTab(sourceTab, {
        active: true,
        targetTabsetId: intent.targetTabsetId
      });
      sourceView.frameActor = targetFrame;
      sourceView.framePort = targetPort;
      this.#actorSystem.setParent(sourceView.viewActor, targetFrame);
      this.recordViewActivation(sourceView);
      this.#windowFocus?.focusActorWindow(targetFrame, toWindowFocusReason(intent.reason));
    } catch (error) {
      this.rollbackMerge(sourceView, rollback);
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

  createFrameLayoutSnapshot(): WindowWorkspaceFrameLayout {
    const liveViews = this.listLiveViews();
    const viewsByActorId = new Map(liveViews.map((liveView) => [liveView.viewActor.id, liveView]));
    const views = Object.fromEntries(liveViews.map((liveView) => [
      liveView.viewKey,
      this.toViewDescriptor(liveView)
    ]));
    const seenFrameIds = new Set<string>();
    const frames: Array<WindowWorkspaceFrameLayout["frames"][number]> = [];
    for (const liveView of liveViews) {
      if (seenFrameIds.has(liveView.frameActor.id)) continue;
      const isolatedFullscreenRestore = this.findFullscreenRestoreForFullscreenFrame(liveView.frameActor);
      if (isolatedFullscreenRestore) {
        if (seenFrameIds.has(isolatedFullscreenRestore.sourceFrameId)) continue;
        seenFrameIds.add(isolatedFullscreenRestore.sourceFrameId);
        const root = mapRuntimeDockRootToViewKeys(isolatedFullscreenRestore.sourceRoot, viewsByActorId);
        if (!root) continue;
        const bounds = isolatedFullscreenRestore.sourceBounds;
        frames.push({
          frameId: isolatedFullscreenRestore.sourceFrameId,
          bounds: {
            position: uiVec2(Math.round(bounds.left), Math.round(bounds.top)),
            size: uiVec2(Math.round(bounds.width), Math.round(bounds.height)),
            visible: isolatedFullscreenRestore.sourceVisibleBeforeRun ?? liveView.framePort.visible
          },
          presentation: isolatedFullscreenRestore.sourcePresentation,
          root
        });
        continue;
      }
      seenFrameIds.add(liveView.frameActor.id);
      const fullscreenRestore = this.findFullscreenRestoreForFrame(liveView.frameActor);
      const root = mapRuntimeDockRootToViewKeys(
        fullscreenRestore?.sourceRoot ?? liveView.framePort.getRuntimeDockRoot(),
        viewsByActorId
      );
      if (!root) continue;
      const bounds = fullscreenRestore?.sourceBounds ?? liveView.framePort.getFloatingBounds();
      frames.push({
        frameId: liveView.frameActor.id,
        bounds: {
          position: uiVec2(Math.round(bounds.left), Math.round(bounds.top)),
          size: uiVec2(Math.round(bounds.width), Math.round(bounds.height)),
          visible: fullscreenRestore
            ? fullscreenRestore.sourceVisibleBeforeRun ?? liveView.framePort.visible
            : liveView.framePort.visible
        },
        presentation: fullscreenRestore?.sourcePresentation ?? liveView.framePort.presentation,
        root
      });
    }
    return normalizeWindowWorkspaceFrameLayout({
      views,
      frames,
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
      const runtimeRoot = mapFrameDockNodeToRuntimeRoot(frame.root, liveViewsByKey);
      if (!runtimeRoot) continue;
      const tabs = frameLiveViews.map((liveView) => createFrameTabFromLiveView(liveView, normalized));
      const activeViewActorId = findRuntimeDockRootActiveViewActorId(runtimeRoot);
      targetFrameIds.add(targetFrame.id);

      targetPort.restoreRuntimeDockRoot(runtimeRoot, {
        tabs,
        activeViewActorId
      });
      targetPort.restoreFloatingState(frame.bounds);
      targetPort.setPresentation(shouldRestoreFrameFullscreen(frame.root) ? frame.presentation : "windowed");

      for (const liveView of frameLiveViews) {
        liveView.content.rehostWindowContent(targetPort.getContentHost(liveView.viewActor.id));
        liveView.frameActor = targetFrame;
        liveView.framePort = targetPort;
        if (this.#actorSystem.hasActor(liveView.viewActor) && this.#actorSystem.hasActor(targetFrame)) {
          this.#actorSystem.setParent(liveView.viewActor, targetFrame);
        }
        restoredViewKeys.add(liveView.viewKey);
      }
      const activeLiveView = activeViewActorId ? this.getLiveViewByActorId(activeViewActorId) : null;
      if (activeLiveView) {
        this.recordViewActivation(activeLiveView);
      }
      this.#windowFocus?.focusActorWindow(targetFrame, toWindowFocusReason(reason));
    }

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
    liveView.framePort.activateTab(viewActorId);
    const sourceRoot = liveView.framePort.getRuntimeDockRoot();
    const rootViewActorIds = listRuntimeDockRootViewActorIds(sourceRoot);
    if (
      rootViewActorIds.length <= 1 &&
      rootViewActorIds[0] === viewActorId &&
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
    this.enterIsolatedViewFullscreen(liveView, sourceRoot, reason);
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
    liveView.framePort.activateTab(viewActorId);
    this.enterIsolatedViewFullscreen(liveView, liveView.framePort.getRuntimeDockRoot(), reason);
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
    sourceRoot: WindowFrameRuntimeDockNode,
    reason: WindowViewFullscreenReason
  ): void {
    if (!this.#createFloatingFrame) {
      liveView.framePort.setPresentation("fullscreen");
      return;
    }
    const sourceFrame = liveView.frameActor;
    const sourcePort = liveView.framePort;
    const sourceTabs = sourcePort.listTabs();
    const sourceTab = sourceTabs.find((tab) => tab.viewActorId === liveView.viewActor.id);
    if (!sourceTab) return;
    const restore: WindowViewFullscreenRestoreTarget = {
      sourceFrameId: sourceFrame.id,
      sourceRoot,
      sourceTabs,
      sourceActiveViewActorId: sourcePort.getFocusedViewActorId(),
      sourceBounds: sourcePort.getFloatingBounds(),
      sourcePresentation: sourcePort.presentation,
      sourceVisiblePath: sourcePort.visiblePath,
      sourceVisibleBeforeRun: sourcePort.visible
    };
    let createdFrame: ReturnType<WindowFloatingFrameFactory> | null = null;
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
      if (!createdFrame.framePort.hasTab(liveView.viewActor.id)) {
        createdFrame.framePort.addTab(sourceTab, { active: true });
      } else {
        createdFrame.framePort.activateTab(liveView.viewActor.id);
      }
      liveView.content.rehostWindowContent(createdFrame.framePort.getContentHost(liveView.viewActor.id));
      sourcePort.removeTab(liveView.viewActor.id);
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
      if (createdFrame && this.#actorSystem.hasActor(createdFrame.frameActor)) {
        this.#actorSystem.destroyActor(createdFrame.frameActor);
      }
      liveView.frameActor = sourceFrame;
      liveView.framePort = sourcePort;
      liveView.content.rehostWindowContent(sourcePort.getContentHost(liveView.viewActor.id));
      if (this.#actorSystem.hasActor(liveView.viewActor)) {
        this.#actorSystem.setParent(liveView.viewActor, sourceFrame);
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
      sourcePort.restoreRuntimeDockRoot(session.restore.sourceRoot, {
        tabs: session.restore.sourceTabs,
        activeViewActorId: session.viewActorId
      });
      liveView.content.rehostWindowContent(sourcePort.getContentHost(session.viewActorId));
      fullscreenPort.removeTab(session.viewActorId);
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
        if (!created.framePort.hasTab(session.viewActorId)) {
          created.framePort.addTab(session.tab, { active: true });
        } else {
          created.framePort.activateTab(session.viewActorId);
        }
        liveView.content.rehostWindowContent(created.framePort.getContentHost(session.viewActorId));
        if (fullscreenPort.hasTab(session.viewActorId)) {
          fullscreenPort.removeTab(session.viewActorId);
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
    if (!fullscreenPort.hasTab(session.viewActorId)) {
      fullscreenPort.addTab(session.tab, { active: true });
    } else {
      fullscreenPort.activateTab(session.viewActorId);
    }
    liveView.content.rehostWindowContent(fullscreenPort.getContentHost(session.viewActorId));
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
    this.openViewRuntimeInFrameEntry(viewKey, targetEntry.frameActor, targetEntry.framePort, reason);
    return true;
  }

  private openViewRuntimeInFrameEntry(
    viewKey: WindowViewKey,
    targetFrameActor: Actor,
    targetFramePort: WindowFramePort,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">
  ): void {
    const targetTabsetId = targetFramePort.listDockTargetTabsets()[0]?.targetTabsetId;
    if (!targetTabsetId) {
      throw new Error(`Target frame has no tabset: ${targetFramePort.frameId}.`);
    }
    const created = this.#factories.createViewRuntime(viewKey, {
      reason,
      parentFrameActor: targetFrameActor
    });
    const tab: WindowFramePortTab = {
      viewActorId: created.viewActor.id,
      identity: this.getIdentityForViewKey(viewKey),
      viewKey,
      title: created.title ?? this.#factories.get(viewKey)?.label ?? viewKey
    };
    try {
      targetFramePort.addTab(tab, {
        active: true,
        targetTabsetId
      });
      created.content.rehostWindowContent(targetFramePort.getContentHost(created.viewActor.id));
      if (this.#actorSystem.hasActor(created.viewActor)) {
        this.#actorSystem.setParent(created.viewActor, targetFrameActor);
      }
      this.trackCreatedViewRuntime(viewKey, created, targetFrameActor, targetFramePort);
      this.#windowFocus?.focusActorWindow(targetFrameActor, toWindowFocusReason(reason));
    } catch (error) {
      if (targetFramePort.hasTab(created.viewActor.id)) {
        try {
          targetFramePort.removeTab(created.viewActor.id);
        } catch {
          // Continue cleanup below; the original open error is more useful.
        }
      }
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
    return {
      viewKey: liveView.viewKey,
      identity: liveView.identity,
      viewActorId: liveView.viewActor.id,
      ownerFrameActorId: liveView.frameActor.id,
      ownerFrameVisiblePath: liveView.framePort.visiblePath,
      ownerFrameVisible: liveView.framePort.visible,
      ownerFrameActiveInHierarchy: this.#actorSystem.isActorActive(liveView.frameActor),
      activeInFrame: liveView.framePort.isViewActiveInFrame(liveView.viewActor.id),
      visibleInFrame: liveView.framePort.isViewVisibleInFrame(liveView.viewActor.id),
      presentation: liveView.framePort.presentation,
      activationSequence: liveView.activationSequence
    };
  }

  private recordViewActivation(liveView: LiveWindowView): void {
    liveView.activationSequence = this.nextActivationSequence();
  }

  private nextActivationSequence(): number {
    this.#activationSequence += 1;
    return this.#activationSequence;
  }

  private toViewDescriptor(liveView: LiveWindowView): WindowWorkspaceViewDescriptor {
    const tab = liveView.framePort.listTabs()
      .find((candidate) => candidate.viewActorId === liveView.viewActor.id);
    return {
      viewKey: liveView.viewKey,
      identity: liveView.identity,
      actorId: liveView.viewActor.id,
      title: tab?.title
    };
  }

  private findFullscreenRestoreForFullscreenFrame(frameActor: Actor): WindowViewFullscreenRestoreTarget | null {
    for (const session of this.#fullscreenSessionsByViewActorId.values()) {
      if (session.mode === "isolated-frame" && session.fullscreenFrameId === frameActor.id) {
        return session.restore;
      }
    }
    return null;
  }

  private findFullscreenRestoreForFrame(frameActor: Actor): WindowViewFullscreenRestoreTarget | null {
    for (const session of this.#fullscreenSessionsByViewActorId.values()) {
      if (session.mode === "isolated-frame" && session.restore.sourceFrameId === frameActor.id) {
        return session.restore;
      }
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

  private rollbackMerge(
    sourceView: LiveWindowView,
    rollback: {
      readonly parentId: string | null;
      readonly sourceFrame: Actor;
      readonly sourcePort: WindowFramePort;
      readonly sourceActiveViewActorId: string | null;
      readonly sourceTab: ReturnType<WindowFramePort["listTabs"]>[number];
      readonly targetFrame: Actor;
      readonly targetPort: WindowFramePort;
      readonly targetActiveViewActorId: string | null;
    }
  ): void {
    try {
      if (rollback.targetPort.hasTab(sourceView.viewActor.id)) {
        rollback.targetPort.removeTab(sourceView.viewActor.id);
      }
      if (!rollback.sourcePort.hasTab(sourceView.viewActor.id)) {
        rollback.sourcePort.addTab(rollback.sourceTab, { active: false });
      }
      if (
        rollback.sourceActiveViewActorId &&
        rollback.sourcePort.hasTab(rollback.sourceActiveViewActorId)
      ) {
        rollback.sourcePort.activateTab(rollback.sourceActiveViewActorId);
      }
      if (
        rollback.targetActiveViewActorId &&
        rollback.targetPort.hasTab(rollback.targetActiveViewActorId)
      ) {
        rollback.targetPort.activateTab(rollback.targetActiveViewActorId);
      }
      if (this.#actorSystem.hasActor(sourceView.viewActor)) {
        this.#actorSystem.setParent(sourceView.viewActor, rollback.parentId);
      }
      sourceView.frameActor = rollback.sourceFrame;
      sourceView.framePort = rollback.sourcePort;
      sourceView.content.rehostWindowContent(rollback.sourcePort.getContentHost(sourceView.viewActor.id));
    } catch {
      sourceView.frameActor = rollback.sourceFrame;
      sourceView.framePort = rollback.sourcePort;
    }
  }

  private commitFloatTab(
    intent: Extract<WindowDockCommitIntent, { readonly kind: "float-tab" }>,
    sourceView: LiveWindowView,
    sourceTab: ReturnType<WindowFramePort["listTabs"]>[number]
  ): WindowDockCommitResult {
    if (!this.#createFloatingFrame) {
      return { committed: false, reason: "floating frame factory is not configured" };
    }
    const sourceFrame = sourceView.frameActor;
    const sourcePort = sourceView.framePort;
    const rollback = {
      parentId: this.#actorSystem.getParentId(sourceView.viewActor),
      sourceFrame,
      sourcePort,
      sourceActiveViewActorId: sourcePort.getFocusedViewActorId(),
      sourceTab
    };
    let createdFrame: ReturnType<WindowFloatingFrameFactory> | null = null;

    this.#cancelActiveInput?.();
    try {
      createdFrame = this.#createFloatingFrame({
        source: intent.source,
        tab: sourceTab,
        bounds: intent.bounds,
        reason: intent.reason
      });
      if (!createdFrame.framePort.hasTab(sourceView.viewActor.id)) {
        createdFrame.framePort.addTab(sourceTab, { active: true });
      } else {
        createdFrame.framePort.activateTab(sourceView.viewActor.id);
      }
      sourceView.content.rehostWindowContent(createdFrame.framePort.getContentHost(sourceView.viewActor.id));
      sourcePort.removeTab(sourceView.viewActor.id);
      sourceView.frameActor = createdFrame.frameActor;
      sourceView.framePort = createdFrame.framePort;
      this.#actorSystem.setParent(sourceView.viewActor, createdFrame.frameActor);
      this.recordViewActivation(sourceView);
      this.#windowFocus?.focusActorWindow(createdFrame.frameActor, toWindowFocusReason(intent.reason));
    } catch (error) {
      this.rollbackFloat(sourceView, rollback, createdFrame);
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

  private commitSplitTab(
    intent: Extract<WindowDockCommitIntent, { readonly kind: "split-tab" }>,
    sourceView: LiveWindowView,
    sourceTab: ReturnType<WindowFramePort["listTabs"]>[number],
    targetFrame: Actor,
    targetPort: WindowFramePort
  ): WindowDockCommitResult {
    const sourceFrame = sourceView.frameActor;
    const sourcePort = sourceView.framePort;
    const rollback = {
      parentId: this.#actorSystem.getParentId(sourceView.viewActor),
      sourceFrame,
      sourcePort,
      sourceActiveViewActorId: sourcePort.getFocusedViewActorId(),
      sourceTab,
      targetFrame,
      targetPort,
      targetActiveViewActorId: targetPort.getFocusedViewActorId()
    };

    this.#cancelActiveInput?.();
    try {
      targetPort.splitTab(sourceTab, {
        active: true,
        targetTabsetId: intent.targetTabsetId,
        placement: intent.placement
      });
      sourceView.content.rehostWindowContent(targetPort.getContentHost(sourceView.viewActor.id));
      sourcePort.removeTab(sourceView.viewActor.id);
      sourceView.frameActor = targetFrame;
      sourceView.framePort = targetPort;
      this.#actorSystem.setParent(sourceView.viewActor, targetFrame);
      this.recordViewActivation(sourceView);
      this.#windowFocus?.focusActorWindow(targetFrame, toWindowFocusReason(intent.reason));
    } catch (error) {
      this.rollbackMerge(sourceView, rollback);
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

  private rollbackFloat(
    sourceView: LiveWindowView,
    rollback: {
      readonly parentId: string | null;
      readonly sourceFrame: Actor;
      readonly sourcePort: WindowFramePort;
      readonly sourceActiveViewActorId: string | null;
      readonly sourceTab: ReturnType<WindowFramePort["listTabs"]>[number];
    },
    createdFrame: ReturnType<WindowFloatingFrameFactory> | null
  ): void {
    try {
      if (!rollback.sourcePort.hasTab(sourceView.viewActor.id)) {
        rollback.sourcePort.addTab(rollback.sourceTab, { active: false });
      }
      if (
        rollback.sourceActiveViewActorId &&
        rollback.sourcePort.hasTab(rollback.sourceActiveViewActorId)
      ) {
        rollback.sourcePort.activateTab(rollback.sourceActiveViewActorId);
      }
      if (this.#actorSystem.hasActor(sourceView.viewActor)) {
        this.#actorSystem.setParent(sourceView.viewActor, rollback.parentId);
      }
      sourceView.frameActor = rollback.sourceFrame;
      sourceView.framePort = rollback.sourcePort;
      sourceView.content.rehostWindowContent(rollback.sourcePort.getContentHost(sourceView.viewActor.id));
    } catch {
      sourceView.frameActor = rollback.sourceFrame;
      sourceView.framePort = rollback.sourcePort;
    } finally {
      if (createdFrame && this.#actorSystem.hasActor(createdFrame.frameActor)) {
        this.#actorSystem.destroyActor(createdFrame.frameActor);
      }
    }
  }
}

function mapRuntimeDockRootToViewKeys(
  node: WindowFrameRuntimeDockNode,
  viewsByActorId: ReadonlyMap<string, LiveWindowView>
): WindowFrameDockNode | null {
  if (node.kind === "tabset") {
    const tabs: WindowViewKey[] = [];
    const seen = new Set<WindowViewKey>();
    for (const viewActorId of node.tabs) {
      const viewKey = viewsByActorId.get(viewActorId)?.viewKey;
      if (!viewKey || seen.has(viewKey)) continue;
      seen.add(viewKey);
      tabs.push(viewKey);
    }
    if (tabs.length === 0) return null;
    const activeTabId = node.activeViewActorId
      ? viewsByActorId.get(node.activeViewActorId)?.viewKey
      : null;
    return {
      kind: "tabset",
      id: node.id,
      tabs,
      activeTabId: activeTabId && tabs.includes(activeTabId) ? activeTabId : tabs[0]
    };
  }

  const first = mapRuntimeDockRootToViewKeys(node.first, viewsByActorId);
  const second = mapRuntimeDockRootToViewKeys(node.second, viewsByActorId);
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

function mapFrameDockNodeToRuntimeRoot(
  node: WindowFrameDockNode,
  liveViewsByKey: ReadonlyMap<WindowViewKey, LiveWindowView>
): WindowFrameRuntimeDockNode | null {
  if (node.kind === "tabset") {
    const tabs: string[] = [];
    const seen = new Set<string>();
    for (const viewKey of node.tabs) {
      const viewActorId = liveViewsByKey.get(viewKey)?.viewActor.id;
      if (!viewActorId || seen.has(viewActorId)) continue;
      seen.add(viewActorId);
      tabs.push(viewActorId);
    }
    if (tabs.length === 0) return null;
    const activeViewActorId = liveViewsByKey.get(node.activeTabId)?.viewActor.id;
    return {
      kind: "tabset",
      id: node.id,
      tabs,
      activeViewActorId: activeViewActorId && tabs.includes(activeViewActorId)
        ? activeViewActorId
        : tabs[0] ?? null
    };
  }

  const first = mapFrameDockNodeToRuntimeRoot(node.first, liveViewsByKey);
  const second = mapFrameDockNodeToRuntimeRoot(node.second, liveViewsByKey);
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

function createFrameTabFromLiveView(
  liveView: LiveWindowView,
  layout: WindowWorkspaceFrameLayout
): ReturnType<WindowFramePort["listTabs"]>[number] {
  const currentTab = liveView.framePort.listTabs()
    .find((tab) => tab.viewActorId === liveView.viewActor.id);
  return {
    viewActorId: liveView.viewActor.id,
    identity: liveView.identity,
    viewKey: liveView.viewKey,
    title: layout.views[liveView.viewKey]?.title ?? currentTab?.title ?? liveView.viewKey
  };
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

function findRuntimeDockRootActiveViewActorId(root: WindowFrameRuntimeDockNode): string | null {
  if (root.kind === "tabset") return root.activeViewActorId ?? root.tabs[0] ?? null;
  return findRuntimeDockRootActiveViewActorId(root.first) ?? findRuntimeDockRootActiveViewActorId(root.second);
}

function findRuntimeDockRootNextActiveViewActorIdAfterRemove(
  root: WindowFrameRuntimeDockNode,
  viewActorId: string
): string | null {
  if (root.kind === "tabset") {
    if (!root.tabs.includes(viewActorId)) return null;
    const remainingTabs = root.tabs.filter((tab) => tab !== viewActorId);
    if (remainingTabs.length === 0) return null;
    if (root.activeViewActorId && root.activeViewActorId !== viewActorId && remainingTabs.includes(root.activeViewActorId)) {
      return root.activeViewActorId;
    }
    const removedIndex = root.tabs.indexOf(viewActorId);
    return remainingTabs[Math.min(removedIndex, remainingTabs.length - 1)] ?? remainingTabs[0] ?? null;
  }
  return findRuntimeDockRootNextActiveViewActorIdAfterRemove(root.first, viewActorId) ??
    findRuntimeDockRootNextActiveViewActorIdAfterRemove(root.second, viewActorId);
}

function shouldRestoreFrameFullscreen(root: WindowFrameDockNode): boolean {
  return collectFrameViewKeys(root).length === 1;
}

function listRuntimeDockRootViewActorIds(node: WindowFrameRuntimeDockNode): readonly string[] {
  if (node.kind === "tabset") return [...node.tabs];
  const viewActorIds: string[] = [];
  const seen = new Set<string>();
  for (const viewActorId of [
    ...listRuntimeDockRootViewActorIds(node.first),
    ...listRuntimeDockRootViewActorIds(node.second)
  ]) {
    if (seen.has(viewActorId)) continue;
    seen.add(viewActorId);
    viewActorIds.push(viewActorId);
  }
  return viewActorIds;
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

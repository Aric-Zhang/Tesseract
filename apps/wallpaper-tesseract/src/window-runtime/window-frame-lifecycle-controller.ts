import type {
  Actor,
  ActorWindowFocusService
} from "../actor-runtime";
import { ActorSystem } from "../actor-runtime";
import type {
  WindowDockCommitIntent,
  WindowDockCommitResult,
  WindowDockCommitValidationResult,
  WindowFrameLayoutRestorePort,
  WindowFrameLayoutRestoreResult,
  WindowFloatingFrameFactory,
  WindowFrameLayoutSnapshotSource,
  WindowFrameLifecycleController,
  WindowFrameLifecycleReason,
  WindowViewLocation,
  WindowViewLocationSource,
  WindowViewOwnerCommandPort,
  WindowViewFullscreenReason,
  WindowViewFullscreenSession,
  WindowViewPresentationCommandPort
} from "./window-frame-lifecycle";
import type { WindowContentRehostable } from "./floating-window-host";
import type { WindowFramePort, WindowFrameRuntimeDockNode } from "./window-frame-port";
import type { WindowViewFactoryRegistry, WindowViewFactoryResult } from "./window-view-factory-registry";
import type { WindowViewKey } from "./window-view-key";
import { vec2 } from "../scene-runtime";
import {
  collectFrameViewKeys,
  normalizeWindowWorkspaceFrameLayout,
  type WindowFrameDockNode,
  type WindowWorkspaceFrameLayout,
  type WindowWorkspaceViewDescriptor
} from "./window-workspace-layout";

export interface LiveWindowView {
  readonly viewKey: WindowViewKey;
  frameActor: Actor;
  framePort: WindowFramePort;
  readonly viewActor: Actor;
  readonly content: WindowContentRehostable;
  readonly dispose?: () => void;
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
  readonly actorWindowFocus?: ActorWindowFocusService;
  readonly cancelActiveInput?: () => void;
  readonly createFloatingFrame?: WindowFloatingFrameFactory;
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
  readonly #actorWindowFocus?: ActorWindowFocusService;
  readonly #cancelActiveInput?: () => void;
  readonly #createFloatingFrame?: WindowFloatingFrameFactory;
  readonly #liveViews = new Map<WindowViewKey, LiveWindowView>();
  readonly #fullscreenSessionsByViewActorId = new Map<string, ManagedWindowViewFullscreenSession>();

  constructor(options: WindowFrameLifecycleControllerOptions) {
    this.#actorSystem = options.actorSystem;
    this.#factories = options.factories;
    this.#actorWindowFocus = options.actorWindowFocus;
    this.#cancelActiveInput = options.cancelActiveInput;
    this.#createFloatingFrame = options.createFloatingFrame;
  }

  openView(
    viewKey: WindowViewKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">
  ): void {
    const liveView = this.getLiveView(viewKey);
    if (liveView) {
      liveView.framePort.activateTab(liveView.viewActor.id);
      this.#actorWindowFocus?.focusActorWindow(liveView.frameActor, toActorWindowFocusReason(reason));
      return;
    }
    const created = this.#factories.create(viewKey, { reason });
    this.trackCreatedView(viewKey, created);
    this.#actorWindowFocus?.focusActorWindow(created.frameActor, toActorWindowFocusReason(reason));
  }

  closeFrame(
    frameId: string,
    _reason: Extract<WindowFrameLifecycleReason, "close-button" | "programmatic">
  ): void {
    const frameActor = this.#actorSystem.getActor(frameId);
    if (!frameActor) return;
    this.#cancelActiveInput?.();
    const liveViews = this.listLiveViewsForFrame(frameActor);
    const disposers = new Set(liveViews.map((liveView) => liveView.dispose).filter(Boolean));
    for (const dispose of disposers) {
      dispose?.();
    }
    if (this.#actorSystem.hasActor(frameActor)) {
      this.#actorSystem.destroyActor(frameActor);
    }
    this.pruneLiveViews();
  }

  activateFrameTab(
    frameId: string,
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
  ): void {
    const liveView = this.getLiveViewByActorId(viewActorId);
    if (!liveView || liveView.frameActor.id !== frameId) return;
    liveView.framePort.activateTab(viewActorId);
    this.#actorWindowFocus?.focusActorWindow(liveView.frameActor, toActorWindowFocusReason(reason));
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
    const targetFrame = this.#actorSystem.getActor(intent.targetFrameId);
    if (!targetFrame) {
      return invalidDockCommit("target frame is missing");
    }
    if (this.listLiveViewsForFrame(targetFrame).length === 0) {
      return invalidDockCommit("target frame has no live views");
    }
    const targetPort = this.listLiveViewsForFrame(targetFrame)[0].framePort;
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

    const targetFrame = this.#actorSystem.getActor(intent.targetFrameId);
    if (!targetFrame) {
      return { committed: false, reason: "dock commit target disappeared" };
    }
    const targetView = this.listLiveViewsForFrame(targetFrame)[0];
    if (!targetView) {
      return { committed: false, reason: "target frame has no live views" };
    }
    const targetPort = targetView.framePort;
    if (intent.kind === "split-tab") {
      return this.commitSplitTab(intent, sourceView, sourceTab, targetFrame, targetPort);
    }

    const rollback = {
      parentId: this.#actorSystem.getParentId(sourceView.viewActor),
      sourceFrame,
      sourcePort,
      sourceActiveViewActorId: sourcePort.getActiveViewActorId(),
      sourceTab,
      targetFrame,
      targetPort,
      targetActiveViewActorId: targetPort.getActiveViewActorId()
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
      this.#actorWindowFocus?.focusActorWindow(targetFrame, toActorWindowFocusReason(intent.reason));
    } catch (error) {
      this.rollbackMerge(sourceView, rollback);
      return { committed: false, reason: describeError(error, "dock merge failed") };
    }

    const remainingSourceViews = this.listLiveViewsForFrame(sourceFrame);
    if (remainingSourceViews.length > 0 || !this.#actorSystem.hasActor(sourceFrame)) {
      return { committed: true, sourceFrameDestroyed: false };
    }
    try {
      this.#actorSystem.destroyActor(sourceFrame);
      return { committed: true, sourceFrameDestroyed: true };
    } catch (error) {
      return {
        committed: true,
        sourceFrameDestroyed: false,
        warning: describeError(error, "source frame destroy failed")
      };
    }
  }

  getLiveView(viewKey: WindowViewKey): LiveWindowView | null {
    const liveView = this.#liveViews.get(viewKey);
    if (!liveView) return null;
    if (
      !this.#actorSystem.hasActor(liveView.frameActor) ||
      !this.#actorSystem.hasActor(liveView.viewActor)
    ) {
      this.#liveViews.delete(viewKey);
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
      if (this.isFullscreenIsolationFrame(liveView.frameActor)) continue;
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
          position: vec2(Math.round(bounds.left), Math.round(bounds.top)),
          size: vec2(Math.round(bounds.width), Math.round(bounds.height)),
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

    for (const viewKey of visibleViewKeys) {
      if (this.getLiveView(viewKey)) continue;
      if (!this.#factories.get(viewKey)) {
        skippedViewKeys.push(viewKey);
        continue;
      }
      try {
        this.openView(viewKey, reason);
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
      const targetLiveView = frameLiveViews[0];
      const targetFrame = targetLiveView.frameActor;
      const targetPort = targetLiveView.framePort;
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
      this.#actorWindowFocus?.focusActorWindow(targetFrame, toActorWindowFocusReason(reason));
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
    this.#actorWindowFocus?.focusActorWindow(liveView.frameActor, toActorWindowFocusReason(reason));
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
    if (rootViewActorIds.length <= 1 && rootViewActorIds[0] === viewActorId) {
      this.#fullscreenSessionsByViewActorId.set(viewActorId, {
        viewActorId,
        viewKey: liveView.viewKey,
        mode: "direct-frame",
        fullscreenFrameId: liveView.frameActor.id,
        previousPresentation: liveView.framePort.presentation
      });
      liveView.framePort.setPresentation("fullscreen");
      this.#actorWindowFocus?.focusActorWindow(liveView.frameActor, toActorWindowFocusReason("programmatic"));
      return;
    }
    this.enterIsolatedViewFullscreen(liveView, sourceRoot, reason);
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
      sourceActiveViewActorId: sourcePort.getActiveViewActorId(),
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
      this.#actorWindowFocus?.focusActorWindow(createdFrame.frameActor, toActorWindowFocusReason("programmatic"));
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
      this.#actorWindowFocus?.focusActorWindow(sourceFrame, toActorWindowFocusReason("programmatic"));
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
        this.#actorWindowFocus?.focusActorWindow(created.frameActor, toActorWindowFocusReason("programmatic"));
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
      this.#actorWindowFocus?.focusActorWindow(fullscreenFrame, toActorWindowFocusReason("programmatic"));
    }
  }

  private trackCreatedView(viewKey: WindowViewKey, created: WindowViewFactoryResult): void {
    this.#liveViews.set(viewKey, {
      viewKey,
      frameActor: created.frameActor,
      framePort: created.framePort,
      viewActor: created.viewActor,
      content: created.content,
      dispose: created.dispose
    });
  }

  private listLiveViewsForFrame(frameActor: Actor): readonly LiveWindowView[] {
    return [...this.#liveViews.values()]
      .filter((liveView) => liveView.frameActor === frameActor);
  }

  private toLocation(liveView: LiveWindowView): WindowViewLocation {
    return {
      viewKey: liveView.viewKey,
      viewActorId: liveView.viewActor.id,
      ownerFrameActorId: liveView.frameActor.id,
      ownerFrameVisiblePath: liveView.framePort.visiblePath,
      ownerFrameVisible: liveView.framePort.visible,
      ownerFrameActiveInHierarchy: this.#actorSystem.isActorActive(liveView.frameActor),
      activeInFrame: liveView.framePort.isViewActiveInFrame(liveView.viewActor.id),
      visibleInFrame: liveView.framePort.isViewVisibleInFrame(liveView.viewActor.id),
      presentation: liveView.framePort.presentation
    };
  }

  private toViewDescriptor(liveView: LiveWindowView): WindowWorkspaceViewDescriptor {
    const tab = liveView.framePort.listTabs()
      .find((candidate) => candidate.viewActorId === liveView.viewActor.id);
    return {
      viewKey: liveView.viewKey,
      actorId: liveView.viewActor.id,
      title: tab?.title
    };
  }

  private isFullscreenIsolationFrame(frameActor: Actor): boolean {
    for (const session of this.#fullscreenSessionsByViewActorId.values()) {
      if (session.mode === "isolated-frame" && session.fullscreenFrameId === frameActor.id) {
        return true;
      }
    }
    return false;
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
    const frameActor = this.#actorSystem.getActor(frameId);
    if (!frameActor) return null;
    return this.listLiveViewsForFrame(frameActor)[0]?.framePort ?? null;
  }

  private pruneLiveViews(): void {
    for (const [viewKey, liveView] of this.#liveViews) {
      if (
        this.#actorSystem.hasActor(liveView.frameActor) &&
        this.#actorSystem.hasActor(liveView.viewActor)
      ) {
        continue;
      }
      this.#liveViews.delete(viewKey);
    }
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
      sourceActiveViewActorId: sourcePort.getActiveViewActorId(),
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
      this.#actorWindowFocus?.focusActorWindow(createdFrame.frameActor, toActorWindowFocusReason(intent.reason));
    } catch (error) {
      this.rollbackFloat(sourceView, rollback, createdFrame);
      return { committed: false, reason: describeError(error, "dock float failed") };
    }

    const remainingSourceViews = this.listLiveViewsForFrame(sourceFrame);
    if (remainingSourceViews.length > 0 || !this.#actorSystem.hasActor(sourceFrame)) {
      return { committed: true, sourceFrameDestroyed: false };
    }
    try {
      this.#actorSystem.destroyActor(sourceFrame);
      return { committed: true, sourceFrameDestroyed: true };
    } catch (error) {
      return {
        committed: true,
        sourceFrameDestroyed: false,
        warning: describeError(error, "source frame destroy failed")
      };
    }
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
      sourceActiveViewActorId: sourcePort.getActiveViewActorId(),
      sourceTab,
      targetFrame,
      targetPort,
      targetActiveViewActorId: targetPort.getActiveViewActorId()
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
      this.#actorWindowFocus?.focusActorWindow(targetFrame, toActorWindowFocusReason(intent.reason));
    } catch (error) {
      this.rollbackMerge(sourceView, rollback);
      return { committed: false, reason: describeError(error, "dock split failed") };
    }

    const remainingSourceViews = this.listLiveViewsForFrame(sourceFrame);
    if (remainingSourceViews.length > 0 || !this.#actorSystem.hasActor(sourceFrame)) {
      return { committed: true, sourceFrameDestroyed: false };
    }
    try {
      this.#actorSystem.destroyActor(sourceFrame);
      return { committed: true, sourceFrameDestroyed: true };
    } catch (error) {
      return {
        committed: true,
        sourceFrameDestroyed: false,
        warning: describeError(error, "source frame destroy failed")
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

function findRuntimeDockRootActiveViewActorId(root: WindowFrameRuntimeDockNode): string | null {
  if (root.kind === "tabset") return root.activeViewActorId ?? root.tabs[0] ?? null;
  return findRuntimeDockRootActiveViewActorId(root.first) ?? findRuntimeDockRootActiveViewActorId(root.second);
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

function toActorWindowFocusReason(
  reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
): "menu-restore" | "programmatic" {
  return reason === "menu" ? "menu-restore" : "programmatic";
}

function invalidDockCommit(reason: string): WindowDockCommitValidationResult {
  return { valid: false, reason };
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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

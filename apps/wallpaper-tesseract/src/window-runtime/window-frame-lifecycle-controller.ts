import type {
  Actor,
  ActorWindowFocusService
} from "../actor-runtime";
import { ActorSystem } from "../actor-runtime";
import type {
  WindowDockCommitIntent,
  WindowDockCommitResult,
  WindowDockCommitValidationResult,
  WindowFloatingFrameFactory,
  WindowFrameLifecycleController,
  WindowFrameLifecycleReason
} from "./window-frame-lifecycle";
import type { WindowContentRehostable } from "./floating-window-host";
import type { WindowFramePort } from "./window-frame-port";
import type { WindowViewFactoryRegistry, WindowViewFactoryResult } from "./window-view-factory-registry";
import type { WindowViewKey } from "./window-view-key";

export interface LiveWindowView {
  readonly viewKey: WindowViewKey;
  frameActor: Actor;
  framePort: WindowFramePort;
  readonly viewActor: Actor;
  readonly content: WindowContentRehostable;
  readonly dispose?: () => void;
}

export interface WindowFrameLifecycleControllerOptions {
  readonly actorSystem: ActorSystem;
  readonly factories: WindowViewFactoryRegistry;
  readonly actorWindowFocus?: ActorWindowFocusService;
  readonly cancelActiveInput?: () => void;
  readonly createFloatingFrame?: WindowFloatingFrameFactory;
}

export class DefaultWindowFrameLifecycleController implements WindowFrameLifecycleController {
  readonly #actorSystem: ActorSystem;
  readonly #factories: WindowViewFactoryRegistry;
  readonly #actorWindowFocus?: ActorWindowFocusService;
  readonly #cancelActiveInput?: () => void;
  readonly #createFloatingFrame?: WindowFloatingFrameFactory;
  readonly #liveViews = new Map<WindowViewKey, LiveWindowView>();

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
      targetPort.addTab(sourceTab, { active: true });
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

import type {
  Actor,
  ActorWindowFocusService
} from "../actor-runtime";
import { ActorSystem } from "../actor-runtime";
import type {
  WindowFrameLifecycleController,
  WindowFrameLifecycleReason
} from "./window-frame-lifecycle";
import type { WindowViewFactoryRegistry, WindowViewFactoryResult } from "./window-view-factory-registry";
import type { WindowViewKey } from "./window-view-key";

interface LiveWindowView {
  readonly viewKey: WindowViewKey;
  frameActor: Actor;
  readonly viewActor: Actor;
  readonly dispose?: () => void;
}

export interface WindowFrameLifecycleControllerOptions {
  readonly actorSystem: ActorSystem;
  readonly factories: WindowViewFactoryRegistry;
  readonly actorWindowFocus?: ActorWindowFocusService;
  readonly cancelActiveInput?: () => void;
}

export class DefaultWindowFrameLifecycleController implements WindowFrameLifecycleController {
  readonly #actorSystem: ActorSystem;
  readonly #factories: WindowViewFactoryRegistry;
  readonly #actorWindowFocus?: ActorWindowFocusService;
  readonly #cancelActiveInput?: () => void;
  readonly #liveViews = new Map<WindowViewKey, LiveWindowView>();

  constructor(options: WindowFrameLifecycleControllerOptions) {
    this.#actorSystem = options.actorSystem;
    this.#factories = options.factories;
    this.#actorWindowFocus = options.actorWindowFocus;
    this.#cancelActiveInput = options.cancelActiveInput;
  }

  openView(
    viewKey: WindowViewKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">
  ): void {
    const liveView = this.getLiveView(viewKey);
    if (liveView) {
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

  listLiveViews(): readonly LiveWindowView[] {
    this.pruneLiveViews();
    return [...this.#liveViews.values()];
  }

  private trackCreatedView(viewKey: WindowViewKey, created: WindowViewFactoryResult): void {
    this.#liveViews.set(viewKey, {
      viewKey,
      frameActor: created.frameActor,
      viewActor: created.viewActor,
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
}

function toActorWindowFocusReason(
  reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">
): "menu-restore" | "programmatic" {
  return reason === "menu" ? "menu-restore" : "programmatic";
}

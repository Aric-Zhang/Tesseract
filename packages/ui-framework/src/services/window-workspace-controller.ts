import type { Actor, ActorSystemView } from "actor-core";
import type { ActorInputStackPrioritySource } from "actor-input";
import type { UiFrame, UiScheduledService } from "../ports/ui-scheduler";
import type { WindowFocusCommandPort, WindowFocusReason } from "./window-focus-command-port";
import type {
  WindowWorkspaceFrameEntry,
  WindowWorkspaceViewCatalog
} from "./window-workspace-view-catalog";
import type { WindowWorkspaceStackPriorityPort } from "./window-workspace-stack-priority-port";

export const WINDOW_WORKSPACE_CONTROLLER_ID = "window-workspace-controller";
export const WINDOW_FLOATING_FOCUS_LAYER_START = 2_000;
export const WINDOW_FLOATING_FOCUS_LAYER_END = 9_999;

export interface WindowWorkspaceControllerOptions {
  readonly actorSystem: ActorSystemView;
  readonly catalog: WindowWorkspaceViewCatalog;
  readonly stackPriorityPort?: WindowWorkspaceStackPriorityPort;
}

export interface WindowWorkspaceStackEntry {
  readonly actorId: string;
  readonly componentId: string;
  readonly basePriority: number;
  readonly effectivePriority: number;
  readonly rank: number | null;
  readonly visible: boolean;
  readonly activeInHierarchy: boolean;
  readonly presentation: WindowWorkspaceFrameEntry["presentation"];
}

interface IndexedWindowFrameEntry {
  readonly entry: WindowWorkspaceFrameEntry;
  readonly sourceIndex: number;
}

export class WindowWorkspaceController implements UiScheduledService, ActorInputStackPrioritySource, WindowFocusCommandPort {
  readonly id = WINDOW_WORKSPACE_CONTROLLER_ID;
  readonly priority = -100;
  enabled = true;

  readonly #actorSystem: ActorSystemView;
  readonly #catalog: WindowWorkspaceViewCatalog;
  readonly #stackPriorityPort?: WindowWorkspaceStackPriorityPort;
  readonly #stackOrder: string[] = [];
  readonly #effectivePriorities = new Map<string, number>();
  #pendingFocusFrameId: string | null = null;
  #disposed = false;

  constructor(options: WindowWorkspaceControllerOptions) {
    this.#actorSystem = options.actorSystem;
    this.#catalog = options.catalog;
    this.#stackPriorityPort = options.stackPriorityPort;
    this.reconcile();
  }

  updateFrame(_frame: UiFrame): void {
    // First-pass strategy: window counts are small, so polling keeps actor,
    // state, and source changes aligned. Once docking/layout grows, move this
    // to explicit invalidation from actor/window/source change events.
    this.reconcile();
  }

  reconcile(): void {
    if (this.#disposed) return;
    const frames = this.listIndexedFrames();
    const framesByActorId = new Map(frames.map((entry) => [entry.entry.frameActorId, entry]));
    this.pruneStackOrder(framesByActorId);
    this.appendNewFrames(frames);
    this.applyPendingFocus(framesByActorId);
    this.applyEffectivePriorities(framesByActorId);
  }

  bringToFront(actorOrActorId: Actor | string): void {
    if (this.#disposed) return;
    this.reconcile();
    const actorId = typeof actorOrActorId === "string"
      ? actorOrActorId
      : this.findOwningStackManagedFrameActor(actorOrActorId)?.id;
    if (!actorId) return;
    const index = this.#stackOrder.indexOf(actorId);
    if (index < 0) return;
    this.#stackOrder.splice(index, 1);
    this.#stackOrder.push(actorId);
    this.reconcile();
  }

  getEffectivePriority(actorId: string): number | null {
    if (this.#disposed) return null;
    return this.#effectivePriorities.get(actorId) ?? null;
  }

  getEffectiveStackPriorityForActor(actor: Actor): number | null {
    if (this.#disposed) return null;
    const owningFrame = this.findOwningRegisteredFrameActor(actor);
    if (!owningFrame) return null;
    const entry = this.getFrameEntry(owningFrame.id);
    return entry?.effectiveStackPriority ?? null;
  }

  findOwningWindowActor(actor: Actor): Actor | null {
    return this.findOwningStackManagedFrameActor(actor);
  }

  private findOwningStackManagedFrameActor(actor: Actor): Actor | null {
    if (this.#disposed || !this.#actorSystem.hasActor(actor)) return null;
    const owningFrame = this.findOwningRegisteredFrameActor(actor);
    if (!owningFrame) return null;
    const entry = this.getFrameEntry(owningFrame.id);
    return entry?.stackManaged ? owningFrame : null;
  }

  private findOwningRegisteredFrameActor(actor: Actor): Actor | null {
    if (this.#disposed || !this.#actorSystem.hasActor(actor)) return null;
    let current: Actor | null = actor;
    while (current) {
      if (this.getFrameEntry(current.id)) return current;
      const parentId = this.#actorSystem.getParentId(current);
      current = parentId ? this.#actorSystem.getActor(parentId) : null;
    }
    return null;
  }

  focusActorWindow(actor: Actor, _reason: WindowFocusReason): void {
    this.bringToFront(actor);
  }

  requestFocusOnVisible(actor: Actor, _reason: WindowFocusReason): void {
    if (this.#disposed) return;
    const owningFrame = this.findOwningStackManagedFrameActor(actor);
    this.#pendingFocusFrameId = owningFrame?.id ?? null;
    this.reconcile();
  }

  listStackEntries(): readonly WindowWorkspaceStackEntry[] {
    if (this.#disposed) return [];
    const framesByActorId = new Map(this.listIndexedFrames().map((entry) => [entry.entry.frameActorId, entry]));
    const eligibleIds = this.listEligibleActorIds(framesByActorId);
    const entries: WindowWorkspaceStackEntry[] = [];
    for (const actorId of this.#stackOrder) {
      const entry = framesByActorId.get(actorId);
      if (!entry) continue;
      const rank = eligibleIds.indexOf(actorId);
      entries.push({
        actorId,
        componentId: entry.entry.frameId,
        basePriority: entry.entry.baseStackPriority,
        effectivePriority: entry.entry.effectiveStackPriority,
        rank: rank >= 0 ? rank : null,
        visible: entry.entry.effectiveVisible,
        activeInHierarchy: entry.entry.activeInHierarchy,
        presentation: entry.entry.presentation
      });
    }
    return entries;
  }

  dispose(): void {
    this.#disposed = true;
    this.#effectivePriorities.clear();
    this.#pendingFocusFrameId = null;
    this.#stackOrder.length = 0;
  }

  private listIndexedFrames(): readonly IndexedWindowFrameEntry[] {
    return this.#catalog.listFrameEntries()
      .map((entry, sourceIndex) => ({ entry, sourceIndex }));
  }

  private pruneStackOrder(framesByActorId: ReadonlyMap<string, IndexedWindowFrameEntry>): void {
    for (let index = this.#stackOrder.length - 1; index >= 0; index -= 1) {
      if (!framesByActorId.has(this.#stackOrder[index] ?? "")) {
        this.#stackOrder.splice(index, 1);
      }
    }
    for (const actorId of [...this.#effectivePriorities.keys()]) {
      if (!framesByActorId.has(actorId)) {
        this.#effectivePriorities.delete(actorId);
      }
    }
  }

  private appendNewFrames(frames: readonly IndexedWindowFrameEntry[]): void {
    const newFrames = frames
      .filter((entry) => entry.entry.stackManaged)
      .filter((entry) => !this.#stackOrder.includes(entry.entry.frameActorId))
      .sort(compareInitialFrameOrder);
    for (const entry of newFrames) {
      this.#stackOrder.push(entry.entry.frameActorId);
    }
  }

  private applyPendingFocus(framesByActorId: ReadonlyMap<string, IndexedWindowFrameEntry>): void {
    if (!this.#pendingFocusFrameId) return;
    const entry = framesByActorId.get(this.#pendingFocusFrameId);
    if (!entry || !entry.entry.stackManaged) {
      this.#pendingFocusFrameId = null;
      return;
    }
    if (!this.isEligibleForDenseStack(entry)) return;
    this.moveActorIdToFront(entry.entry.frameActorId);
    this.#pendingFocusFrameId = null;
  }

  private applyEffectivePriorities(framesByActorId: ReadonlyMap<string, IndexedWindowFrameEntry>): void {
    this.#effectivePriorities.clear();
    const eligibleActorIds = this.listEligibleActorIds(framesByActorId);
    for (const [rank, actorId] of eligibleActorIds.entries()) {
      const entry = framesByActorId.get(actorId);
      if (!entry) continue;
      const effectivePriority = Math.min(
        WINDOW_FLOATING_FOCUS_LAYER_START + rank,
        WINDOW_FLOATING_FOCUS_LAYER_END
      );
      this.#effectivePriorities.set(actorId, effectivePriority);
      this.#stackPriorityPort?.setFrameStackPriority(actorId, effectivePriority);
    }
    for (const entry of framesByActorId.values()) {
      if (!entry.entry.stackManaged || this.#effectivePriorities.has(entry.entry.frameActorId)) continue;
      this.#stackPriorityPort?.setFrameStackPriority(entry.entry.frameActorId, entry.entry.baseStackPriority);
    }
  }

  private listEligibleActorIds(framesByActorId: ReadonlyMap<string, IndexedWindowFrameEntry>): string[] {
    return this.#stackOrder.filter((actorId) => {
      const entry = framesByActorId.get(actorId);
      return Boolean(entry && this.isEligibleForDenseStack(entry));
    });
  }

  private isEligibleForDenseStack(entry: IndexedWindowFrameEntry): boolean {
    return entry.entry.visible &&
      entry.entry.effectiveVisible &&
      entry.entry.activeInHierarchy &&
      entry.entry.presentation === "windowed" &&
      entry.entry.stackManaged;
  }

  private moveActorIdToFront(actorId: string): void {
    const index = this.#stackOrder.indexOf(actorId);
    if (index < 0) return;
    this.#stackOrder.splice(index, 1);
    this.#stackOrder.push(actorId);
  }

  private getFrameEntry(frameActorId: string): WindowWorkspaceFrameEntry | null {
    return this.#catalog.listFrameEntries()
      .find((entry) => entry.frameActorId === frameActorId) ?? null;
  }
}

function compareInitialFrameOrder(a: IndexedWindowFrameEntry, b: IndexedWindowFrameEntry): number {
  const priorityDelta = a.entry.baseStackPriority - b.entry.baseStackPriority;
  if (priorityDelta !== 0) return priorityDelta;
  return a.sourceIndex - b.sourceIndex;
}

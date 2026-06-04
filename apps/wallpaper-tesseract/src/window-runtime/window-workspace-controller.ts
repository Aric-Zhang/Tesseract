import type {
  Actor,
  ActorSystemView,
  ActorWindowFocusReason,
  ActorWindowFocusService
} from "../actor-runtime";
import type { RuntimeObject, SceneFrame } from "../scene-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent
} from "./floating-window-component";
import type { WindowControlItem, WindowControlSource } from "./window-control-source";

export const WINDOW_WORKSPACE_CONTROLLER_ID = "window-workspace-controller";
export const WINDOW_FLOATING_FOCUS_LAYER_START = 2_000;
export const WINDOW_FLOATING_FOCUS_LAYER_END = 9_999;

export interface WindowWorkspaceControllerOptions {
  readonly actorSystem: ActorSystemView;
  readonly source: WindowControlSource;
}

export interface WindowWorkspaceStackEntry {
  readonly actorId: string;
  readonly componentId: string;
  readonly basePriority: number;
  readonly effectivePriority: number;
  readonly rank: number | null;
  readonly visible: boolean;
  readonly activeInHierarchy: boolean;
  readonly presentation: FloatingWindowComponent["presentation"];
}

interface IndexedWindowControlItem {
  readonly item: WindowControlItem;
  readonly component: FloatingWindowComponent;
  readonly sourceIndex: number;
}

export class WindowWorkspaceController implements RuntimeObject, ActorWindowFocusService {
  readonly id = WINDOW_WORKSPACE_CONTROLLER_ID;
  readonly priority = -100;
  enabled = true;

  readonly #actorSystem: ActorSystemView;
  readonly #source: WindowControlSource;
  readonly #stackOrder: string[] = [];
  readonly #effectivePriorities = new Map<string, number>();
  #pendingFocusActorId: string | null = null;
  #disposed = false;

  constructor(options: WindowWorkspaceControllerOptions) {
    this.#actorSystem = options.actorSystem;
    this.#source = options.source;
    this.reconcile();
  }

  updateFrame(_frame: SceneFrame): void {
    this.reconcile();
  }

  reconcile(): void {
    if (this.#disposed) return;
    const windows = this.listIndexedWindows();
    const windowsByActorId = new Map(windows.map((entry) => [entry.item.actorId, entry]));
    this.pruneStackOrder(windowsByActorId);
    this.appendNewWindows(windows);
    this.applyPendingFocus(windowsByActorId);
    this.applyEffectivePriorities(windowsByActorId);
  }

  bringToFront(actorOrActorId: Actor | string): void {
    if (this.#disposed) return;
    this.reconcile();
    const actorId = typeof actorOrActorId === "string"
      ? actorOrActorId
      : this.findOwningWindowActor(actorOrActorId)?.id;
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
    const owningWindow = this.findOwningWindowActor(actor);
    return owningWindow ? this.getEffectivePriority(owningWindow.id) : null;
  }

  findOwningWindowActor(actor: Actor): Actor | null {
    if (this.#disposed || !this.#actorSystem.hasActor(actor)) return null;
    let current: Actor | null = actor;
    while (current) {
      if (current.getComponent(floatingWindowComponentType)) return current;
      const parentId = this.#actorSystem.getParentId(current);
      current = parentId ? this.#actorSystem.getActor(parentId) : null;
    }
    return null;
  }

  focusActorWindow(actor: Actor, _reason: ActorWindowFocusReason): void {
    this.bringToFront(actor);
  }

  requestFocusOnVisible(actor: Actor, _reason: ActorWindowFocusReason): void {
    if (this.#disposed) return;
    const owningWindow = this.findOwningWindowActor(actor);
    this.#pendingFocusActorId = owningWindow?.id ?? actor.id;
    this.reconcile();
  }

  listStackEntries(): readonly WindowWorkspaceStackEntry[] {
    if (this.#disposed) return [];
    const windowsByActorId = new Map(this.listIndexedWindows().map((entry) => [entry.item.actorId, entry]));
    const eligibleIds = this.listEligibleActorIds(windowsByActorId);
    const entries: WindowWorkspaceStackEntry[] = [];
    for (const actorId of this.#stackOrder) {
      const entry = windowsByActorId.get(actorId);
      if (!entry) continue;
      const rank = eligibleIds.indexOf(actorId);
      entries.push({
        actorId,
        componentId: entry.component.id,
        basePriority: entry.component.basePriority,
        effectivePriority: entry.component.inputStackPriority,
        rank: rank >= 0 ? rank : null,
        visible: entry.item.visible,
        activeInHierarchy: entry.item.activeInHierarchy,
        presentation: entry.component.presentation
      });
    }
    return entries;
  }

  dispose(): void {
    this.#disposed = true;
    this.#effectivePriorities.clear();
    this.#pendingFocusActorId = null;
    this.#stackOrder.length = 0;
  }

  private listIndexedWindows(): readonly IndexedWindowControlItem[] {
    return this.#source.listWindows().flatMap((item, sourceIndex) => {
      const component = item.actor.getComponent(floatingWindowComponentType);
      return component ? [{ item, component, sourceIndex }] : [];
    });
  }

  private pruneStackOrder(windowsByActorId: ReadonlyMap<string, IndexedWindowControlItem>): void {
    for (let index = this.#stackOrder.length - 1; index >= 0; index -= 1) {
      if (!windowsByActorId.has(this.#stackOrder[index] ?? "")) {
        this.#stackOrder.splice(index, 1);
      }
    }
    for (const actorId of [...this.#effectivePriorities.keys()]) {
      if (!windowsByActorId.has(actorId)) {
        this.#effectivePriorities.delete(actorId);
      }
    }
  }

  private appendNewWindows(windows: readonly IndexedWindowControlItem[]): void {
    const newWindows = windows
      .filter((entry) => !this.#stackOrder.includes(entry.item.actorId))
      .sort(compareInitialWindowOrder);
    for (const entry of newWindows) {
      this.#stackOrder.push(entry.item.actorId);
    }
  }

  private applyPendingFocus(windowsByActorId: ReadonlyMap<string, IndexedWindowControlItem>): void {
    if (!this.#pendingFocusActorId) return;
    const entry = windowsByActorId.get(this.#pendingFocusActorId);
    if (!entry || !entry.item.canToggle) {
      this.#pendingFocusActorId = null;
      return;
    }
    if (!this.isEligibleForDenseStack(entry)) return;
    this.moveActorIdToFront(entry.item.actorId);
    this.#pendingFocusActorId = null;
  }

  private applyEffectivePriorities(windowsByActorId: ReadonlyMap<string, IndexedWindowControlItem>): void {
    this.#effectivePriorities.clear();
    const eligibleActorIds = this.listEligibleActorIds(windowsByActorId);
    for (const [rank, actorId] of eligibleActorIds.entries()) {
      const entry = windowsByActorId.get(actorId);
      if (!entry) continue;
      const effectivePriority = Math.min(
        WINDOW_FLOATING_FOCUS_LAYER_START + rank,
        WINDOW_FLOATING_FOCUS_LAYER_END
      );
      this.#effectivePriorities.set(actorId, effectivePriority);
      entry.component.setEffectivePriority(effectivePriority);
    }
    for (const entry of windowsByActorId.values()) {
      if (this.#effectivePriorities.has(entry.item.actorId)) continue;
      entry.component.setEffectivePriority(entry.component.basePriority);
    }
  }

  private listEligibleActorIds(windowsByActorId: ReadonlyMap<string, IndexedWindowControlItem>): string[] {
    return this.#stackOrder.filter((actorId) => {
      const entry = windowsByActorId.get(actorId);
      return Boolean(entry && this.isEligibleForDenseStack(entry));
    });
  }

  private isEligibleForDenseStack(entry: IndexedWindowControlItem): boolean {
    return entry.item.visible &&
      entry.item.activeInHierarchy &&
      entry.component.presentation === "windowed";
  }

  private moveActorIdToFront(actorId: string): void {
    const index = this.#stackOrder.indexOf(actorId);
    if (index < 0) return;
    this.#stackOrder.splice(index, 1);
    this.#stackOrder.push(actorId);
  }
}

function compareInitialWindowOrder(a: IndexedWindowControlItem, b: IndexedWindowControlItem): number {
  const priorityDelta = a.component.basePriority - b.component.basePriority;
  if (priorityDelta !== 0) return priorityDelta;
  return a.sourceIndex - b.sourceIndex;
}

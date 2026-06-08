import type { Actor, ActorSystemView } from "actor-core";
import type { WindowViewIdentity } from "../model/window-view-identity";
import type { WindowViewKey } from "../model/window-view-key";
import type { WindowViewFactoryRegistry } from "../ports/window-view-factory-registry";
import { getWindowViewFactoryIdentity } from "../ports/window-view-factory-registry";
import type { WindowViewLocationSource } from "./window-frame-lifecycle";
import type { WindowFramePresentation } from "../model/window-frame-tab";
import type { WindowFramePort } from "../ports/window-frame-port";
import type { WindowFramePortRegistryEntry, WindowFramePortRegistryView } from "../ports/window-frame-port-registry";
import { isWindowFrameStackManaged } from "./window-workspace-stack-priority-port";

export interface WindowWorkspaceViewEntry {
  readonly identity: WindowViewIdentity;
  readonly viewKey: WindowViewKey;
  readonly viewActorId: string | null;
  readonly ownerFrameActorId: string | null;
  readonly label: string;
  readonly order: number;
  readonly sourceIndex: number;
  readonly group: string | null;
  readonly enabled: boolean;
  readonly live: boolean;
  readonly activeInFrame: boolean;
  readonly visibleInFrame: boolean;
  readonly ownerFrameVisible: boolean;
  readonly ownerFrameActiveInHierarchy: boolean;
  readonly presentation: WindowFramePresentation | null;
  readonly activationSequence: number;
}

export interface WindowWorkspaceFrameEntry {
  readonly frameActor: Actor;
  readonly frameId: string;
  readonly frameActorId: string;
  readonly framePort: WindowFramePort;
  readonly baseStackPriority: number;
  readonly effectiveStackPriority: number;
  readonly stackManaged: boolean;
  readonly visible: boolean;
  readonly effectiveVisible: boolean;
  readonly activeInHierarchy: boolean;
  readonly presentation: WindowFramePresentation;
  readonly sourceIndex: number;
}

export interface WindowWorkspaceViewCatalog {
  listViewEntries(): readonly WindowWorkspaceViewEntry[];
  getViewEntryByIdentity(identity: WindowViewIdentity): WindowWorkspaceViewEntry | null;
  getViewEntryByActorId(viewActorId: string): WindowWorkspaceViewEntry | null;
  listFrameEntries(): readonly WindowWorkspaceFrameEntry[];
}

export interface WindowWorkspaceViewCatalogOptions {
  readonly actorSystem: ActorSystemView;
  readonly factories: WindowViewFactoryRegistry;
  readonly locations: WindowViewLocationSource;
  readonly framePorts: WindowFramePortRegistryView;
}

export function createWindowWorkspaceViewCatalog(
  options: WindowWorkspaceViewCatalogOptions
): WindowWorkspaceViewCatalog {
  return {
    listViewEntries() {
      return listViewEntries(options);
    },
    getViewEntryByIdentity(identity) {
      return this.listViewEntries()
        .find((entry) => isSameWindowViewIdentity(entry.identity, identity)) ?? null;
    },
    getViewEntryByActorId(viewActorId) {
      return this.listViewEntries()
        .find((entry) => entry.viewActorId === viewActorId) ?? null;
    },
    listFrameEntries() {
      return listFrameEntries(options);
    }
  };
}

function listViewEntries(options: WindowWorkspaceViewCatalogOptions): readonly WindowWorkspaceViewEntry[] {
  const factories = options.factories.list();
  const factoryByViewKey = new Map(factories.map((factory) => [factory.viewKey, factory]));
  const locationsByViewKey = new Map(options.locations.listLocations().map((location) => [location.viewKey, location]));
  const entries: WindowWorkspaceViewEntry[] = [];

  for (const [factoryIndex, factory] of factories.entries()) {
    const identity = getWindowViewFactoryIdentity(factory);
    const location = locationsByViewKey.get(factory.viewKey) ?? null;
    entries.push({
      identity,
      viewKey: identity.viewKey,
      viewActorId: location?.viewActorId ?? null,
      ownerFrameActorId: location?.ownerFrameActorId ?? null,
      label: factory.label,
      order: factory.order ?? factoryIndex,
      sourceIndex: factoryIndex,
      group: factory.group ?? null,
      enabled: factory.enabled ?? true,
      live: location !== null,
      activeInFrame: location?.activeInFrame ?? false,
      visibleInFrame: location?.visibleInFrame ?? false,
      ownerFrameVisible: location?.ownerFrameVisible ?? false,
      ownerFrameActiveInHierarchy: location?.ownerFrameActiveInHierarchy ?? false,
      presentation: location?.presentation ?? null,
      activationSequence: location?.activationSequence ?? 0
    });
  }

  for (const location of options.locations.listLocations()) {
    if (factoryByViewKey.has(location.viewKey)) continue;
    entries.push({
      identity: location.identity,
      viewKey: location.viewKey,
      viewActorId: location.viewActorId,
      ownerFrameActorId: location.ownerFrameActorId,
      label: location.viewKey,
      order: Number.MAX_SAFE_INTEGER,
      sourceIndex: entries.length,
      group: null,
      enabled: true,
      live: true,
      activeInFrame: location.activeInFrame,
      visibleInFrame: location.visibleInFrame,
      ownerFrameVisible: location.ownerFrameVisible,
      ownerFrameActiveInHierarchy: location.ownerFrameActiveInHierarchy,
      presentation: location.presentation,
      activationSequence: location.activationSequence
    });
  }

  return entries.sort(compareViewEntries);
}

function listFrameEntries(options: WindowWorkspaceViewCatalogOptions): readonly WindowWorkspaceFrameEntry[] {
  return options.framePorts.list()
    .filter((entry) => options.actorSystem.hasActor(entry.frameActor))
    .map((entry, sourceIndex) => toFrameEntry(options.actorSystem, entry, sourceIndex));
}

function toFrameEntry(
  actorSystem: ActorSystemView,
  entry: WindowFramePortRegistryEntry,
  sourceIndex: number
): WindowWorkspaceFrameEntry {
  const baseStackPriority = entry.getBaseStackPriority?.() ?? entry.getStackPriority();
  return {
    frameActor: entry.frameActor,
    frameId: entry.framePort.frameId,
    frameActorId: entry.frameActor.id,
    framePort: entry.framePort,
    baseStackPriority,
    effectiveStackPriority: entry.getStackPriority(),
    stackManaged: isWindowFrameStackManaged(entry),
    visible: entry.framePort.visible,
    effectiveVisible: entry.framePort.effectiveVisible,
    activeInHierarchy: actorSystem.isActorActive(entry.frameActor),
    presentation: entry.framePort.presentation,
    sourceIndex
  };
}

function compareViewEntries(a: WindowWorkspaceViewEntry, b: WindowWorkspaceViewEntry): number {
  const orderDelta = a.order - b.order;
  if (orderDelta !== 0) return orderDelta;
  return a.viewKey.localeCompare(b.viewKey);
}

function isSameWindowViewIdentity(a: WindowViewIdentity, b: WindowViewIdentity): boolean {
  return a.viewKey === b.viewKey &&
    a.typeKey === b.typeKey &&
    a.instanceId === b.instanceId &&
    a.multiplicity === b.multiplicity;
}

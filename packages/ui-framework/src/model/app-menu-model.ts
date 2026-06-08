import type {
  WindowViewIdentity,
  WindowViewTypeKey
} from "./window-view-identity";
import type { WindowViewKey } from "./window-view-key";
import type { WindowWorkspaceViewEntry } from "../services/window-workspace-view-catalog";

export type AppMenuLeadingAccessory =
  | { readonly kind: "none" }
  | { readonly kind: "checkbox" }
  | { readonly kind: "icon"; readonly name: AppMenuIconName };

export type AppMenuIconName =
  | "window"
  | "fullscreen"
  | "console"
  | "custom";

export type AppMenuItemViewModel =
  | AppMenuWindowCommandItemViewModel
  | AppMenuCheckableCommandItemViewModel;

export type AppMenuWindowAction =
  | { readonly kind: "open-or-focus-type"; readonly typeKey: WindowViewTypeKey }
  | { readonly kind: "new-instance"; readonly typeKey: WindowViewTypeKey }
  | { readonly kind: "focus-instance"; readonly identity: WindowViewIdentity };

export interface AppMenuWindowCommandItemViewModel {
  readonly kind: "window-command";
  readonly id: string;
  readonly action: AppMenuWindowAction;
  readonly typeKey: WindowViewTypeKey;
  readonly viewKey: WindowViewKey | null;
  readonly actorId: string | null;
  readonly label: string;
  readonly enabled: boolean;
  readonly live: boolean;
  readonly leading: AppMenuLeadingAccessory;
  readonly shortcutLabel?: string;
}

export interface AppMenuCheckableCommandItemViewModel {
  readonly kind: "checkable-command";
  readonly id: string;
  readonly commandId: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly checked: boolean;
  readonly leading: AppMenuLeadingAccessory;
  readonly shortcutLabel?: string;
}

interface SortableMenuItem {
  readonly item: AppMenuWindowCommandItemViewModel;
  readonly order: number;
  readonly sourceIndex: number;
  readonly offset: number;
}

export function createWindowMenuItem(item: WindowWorkspaceViewEntry): AppMenuWindowCommandItemViewModel {
  return {
    kind: "window-command",
    id: `type:${item.identity.typeKey}`,
    action: { kind: "open-or-focus-type", typeKey: item.identity.typeKey },
    typeKey: item.identity.typeKey,
    viewKey: item.viewKey,
    actorId: item.viewActorId,
    label: item.label,
    enabled: item.enabled,
    live: item.live,
    leading: { kind: "none" }
  };
}

export function createWindowMenuItems(
  items: readonly WindowWorkspaceViewEntry[]
): readonly AppMenuWindowCommandItemViewModel[] {
  const entriesByType = new Map<WindowViewTypeKey, WindowWorkspaceViewEntry[]>();
  for (const item of items) {
    entriesByType.set(item.identity.typeKey, [
      ...(entriesByType.get(item.identity.typeKey) ?? []),
      item
    ]);
  }
  const rows: SortableMenuItem[] = [];
  for (const entries of entriesByType.values()) {
    const representative = pickRepresentativeEntry(entries);
    rows.push({
      item: createWindowMenuItem(representative),
      order: Math.min(...entries.map((entry) => entry.order)),
      sourceIndex: Math.min(...entries.map((entry) => entry.sourceIndex)),
      offset: 0
    });
    if (entries.some((entry) => entry.identity.multiplicity === "multi-instance")) {
      rows.push({
        item: {
          kind: "window-command",
          id: `new:${representative.identity.typeKey}`,
          action: { kind: "new-instance", typeKey: representative.identity.typeKey },
          typeKey: representative.identity.typeKey,
          viewKey: null,
          actorId: null,
          label: `New ${representative.label}`,
          enabled: entries.some((entry) => entry.enabled),
          live: false,
          leading: { kind: "none" }
        },
        order: Math.min(...entries.map((entry) => entry.order)),
        sourceIndex: Math.min(...entries.map((entry) => entry.sourceIndex)),
        offset: 0.1
      });
    }
  }
  return rows
    .sort((a, b) => {
      const orderDelta = a.order - b.order;
      if (orderDelta !== 0) return orderDelta;
      const sourceDelta = a.sourceIndex - b.sourceIndex;
      if (sourceDelta !== 0) return sourceDelta;
      return a.offset - b.offset;
    })
    .map((row) => row.item);
}

function pickRepresentativeEntry(entries: readonly WindowWorkspaceViewEntry[]): WindowWorkspaceViewEntry {
  return [...entries].sort((a, b) => {
    const activationDelta = b.activationSequence - a.activationSequence;
    if (activationDelta !== 0) return activationDelta;
    const liveDelta = Number(b.live) - Number(a.live);
    if (liveDelta !== 0) return liveDelta;
    const orderDelta = a.order - b.order;
    return orderDelta !== 0 ? orderDelta : a.sourceIndex - b.sourceIndex;
  })[0] ?? entries[0];
}

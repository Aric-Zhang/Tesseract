import type { MenuItemDescriptor } from "ui-framework";
import type {
  WindowViewIdentity,
  WindowViewTypeKey,
  WindowWorkspaceViewEntry
} from "../../window-runtime";
import type { WindowViewKey } from "../../window-runtime";

export type WindowMenuAction =
  | { readonly kind: "open-or-focus-type"; readonly typeKey: WindowViewTypeKey }
  | { readonly kind: "new-instance"; readonly typeKey: WindowViewTypeKey }
  | { readonly kind: "focus-instance"; readonly identity: WindowViewIdentity };

export interface WindowMenuPayload {
  readonly action: WindowMenuAction;
  readonly viewKey: WindowViewKey | null;
  readonly actorId: string | null;
}

type WindowMenuItemDescriptor = MenuItemDescriptor<WindowMenuPayload>;

interface SortableMenuItem {
  readonly item: WindowMenuItemDescriptor;
  readonly order: number;
  readonly sourceIndex: number;
  readonly offset: number;
}

export function createWindowMenuItem(item: WindowWorkspaceViewEntry): WindowMenuItemDescriptor {
  return {
    id: `type:${item.identity.typeKey}`,
    label: item.label,
    enabled: item.enabled,
    leading: { kind: "none" },
    payload: {
      action: { kind: "open-or-focus-type", typeKey: item.identity.typeKey },
      viewKey: item.viewKey,
      actorId: item.viewActorId
    }
  };
}

export function createWindowMenuItems(
  items: readonly WindowWorkspaceViewEntry[]
): readonly WindowMenuItemDescriptor[] {
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
          id: `new:${representative.identity.typeKey}`,
          label: `New ${representative.label}`,
          enabled: entries.some((entry) => entry.enabled),
          leading: { kind: "none" },
          payload: {
            action: { kind: "new-instance", typeKey: representative.identity.typeKey },
            viewKey: null,
            actorId: null
          }
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

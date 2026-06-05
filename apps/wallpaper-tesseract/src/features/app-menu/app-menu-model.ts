import type { WindowControlItem, WindowViewFactory, WindowViewKey } from "../../window-runtime";

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
  | AppMenuOpenViewItemViewModel
  | AppMenuCheckableCommandItemViewModel;

export interface AppMenuOpenViewItemViewModel {
  readonly kind: "open-view";
  readonly id: string;
  readonly viewKey: WindowViewKey;
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

export interface CreateWindowMenuItemsOptions {
  readonly factories?: readonly WindowViewFactory[];
}

interface WindowMenuEntry {
  readonly viewKey: WindowViewKey;
  readonly actorId: string | null;
  readonly label: string;
  readonly order: number;
  readonly sourceIndex: number;
  readonly enabled: boolean;
  readonly live: boolean;
}

export function createWindowMenuItem(item: WindowControlItem): AppMenuOpenViewItemViewModel {
  return createWindowMenuItemFromEntry(createEntryFromWindow(item));
}

function createWindowMenuItemFromEntry(entry: WindowMenuEntry): AppMenuOpenViewItemViewModel {
  return {
    kind: "open-view",
    id: entry.viewKey,
    viewKey: entry.viewKey,
    actorId: entry.actorId,
    label: entry.label,
    enabled: entry.enabled,
    live: entry.live,
    leading: { kind: "none" }
  };
}

export function createWindowMenuItems(
  items: readonly WindowControlItem[],
  options: CreateWindowMenuItemsOptions = {}
): readonly AppMenuOpenViewItemViewModel[] {
  return createWindowMenuEntries(items, options)
    .map(createWindowMenuItemFromEntry);
}

function createWindowMenuEntries(
  items: readonly WindowControlItem[],
  options: CreateWindowMenuItemsOptions
): readonly WindowMenuEntry[] {
  const liveByViewKey = new Map(items.map((item) => [item.viewKey, item]));
  const entries = new Map<WindowViewKey, WindowMenuEntry>();

  for (const [factoryIndex, factory] of (options.factories ?? []).entries()) {
    const liveItem = liveByViewKey.get(factory.viewKey);
    entries.set(factory.viewKey, liveItem
      ? createEntryFromWindow(liveItem, factory, factoryIndex)
      : {
          viewKey: factory.viewKey,
          actorId: null,
          label: factory.label,
          order: factory.order ?? 0,
          sourceIndex: factoryIndex,
          enabled: factory.enabled ?? true,
          live: false
        });
  }

  for (const [itemIndex, item] of items.entries()) {
    if (entries.has(item.viewKey)) continue;
    entries.set(item.viewKey, createEntryFromWindow(item, undefined, itemIndex));
  }

  return [...entries.values()].sort((a, b) => {
    const orderDelta = a.order - b.order;
    return orderDelta !== 0 ? orderDelta : a.sourceIndex - b.sourceIndex;
  });
}

function createEntryFromWindow(
  item: WindowControlItem,
  factory?: WindowViewFactory,
  sourceIndex = 0
): WindowMenuEntry {
  return {
    viewKey: item.viewKey,
    actorId: item.actorId,
    label: factory?.label ?? item.label,
    order: factory?.order ?? item.order,
    sourceIndex,
    enabled: factory?.enabled ?? item.canToggle,
    live: true
  };
}

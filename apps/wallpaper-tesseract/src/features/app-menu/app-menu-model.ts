import type { WindowViewKey, WindowWorkspaceViewEntry } from "../../window-runtime";

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

export function createWindowMenuItem(item: WindowWorkspaceViewEntry): AppMenuOpenViewItemViewModel {
  return {
    kind: "open-view",
    id: item.viewKey,
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
): readonly AppMenuOpenViewItemViewModel[] {
  return [...items]
    .sort((a, b) => {
      const orderDelta = a.order - b.order;
      return orderDelta !== 0 ? orderDelta : a.sourceIndex - b.sourceIndex;
    })
    .map(createWindowMenuItem);
}

import type { WindowControlItem } from "../../window-runtime";

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
  | AppMenuWindowToggleItemViewModel;

export interface AppMenuWindowToggleItemViewModel {
  readonly kind: "window-toggle";
  readonly id: string;
  readonly actorId: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly checked: boolean;
  readonly leading: AppMenuLeadingAccessory;
  readonly shortcutLabel?: string;
}

export function createWindowMenuItem(item: WindowControlItem): AppMenuWindowToggleItemViewModel {
  return {
    kind: "window-toggle",
    id: item.actorId,
    actorId: item.actorId,
    label: item.label,
    enabled: item.canToggle,
    checked: item.visible,
    leading: { kind: "checkbox" }
  };
}

export function createWindowMenuItems(
  items: readonly WindowControlItem[]
): readonly AppMenuWindowToggleItemViewModel[] {
  return items.map(createWindowMenuItem);
}

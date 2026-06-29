export type MenuItemRole = "command" | "checkbox" | "separator" | "submenu";

export type MenuLeadingAccessory =
  | { readonly kind: "none" }
  | { readonly kind: "checkbox" }
  | { readonly kind: "icon"; readonly name: string };

export interface MenuItemDescriptor<TPayload = unknown> {
  readonly id: string;
  readonly label: string;
  readonly role?: MenuItemRole;
  readonly enabled?: boolean;
  readonly checked?: boolean;
  readonly leading?: MenuLeadingAccessory;
  readonly shortcutLabel?: string;
  readonly payload?: TPayload;
}

export interface MenuBarItemDescriptor {
  readonly id: string;
  readonly label: string;
  readonly enabled?: boolean;
}

export interface MenuCommand<TPayload = unknown> {
  readonly itemId: string;
  readonly itemActorId: string;
  readonly payload: TPayload | undefined;
}

export interface MenuCommandSink<TPayload = unknown> {
  activateMenuItem(command: MenuCommand<TPayload>): void;
}

export function normalizeMenuItemDescriptor<TPayload>(
  descriptor: MenuItemDescriptor<TPayload>
): Required<Omit<MenuItemDescriptor<TPayload>, "payload" | "shortcutLabel">> &
    Pick<MenuItemDescriptor<TPayload>, "payload" | "shortcutLabel"> {
  if (!descriptor.id) throw new Error("Menu item descriptor requires id.");
  if (!descriptor.label && descriptor.role !== "separator") {
    throw new Error("Menu item descriptor requires label.");
  }
  return {
    id: descriptor.id,
    label: descriptor.label,
    role: descriptor.role ?? "command",
    enabled: descriptor.enabled ?? true,
    checked: descriptor.checked ?? false,
    leading: descriptor.leading ?? { kind: "none" },
    shortcutLabel: descriptor.shortcutLabel,
    payload: descriptor.payload
  };
}

export function normalizeMenuBarItemDescriptor(
  descriptor: MenuBarItemDescriptor
): Required<MenuBarItemDescriptor> {
  if (!descriptor.id) throw new Error("Menu bar item descriptor requires id.");
  if (!descriptor.label) throw new Error("Menu bar item descriptor requires label.");
  return {
    id: descriptor.id,
    label: descriptor.label,
    enabled: descriptor.enabled ?? true
  };
}

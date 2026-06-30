export type UiButtonVariant = "plain" | "toolbar";

export type UiButtonIconDescriptor =
  | { readonly kind: "none" }
  | { readonly kind: "text"; readonly value: string }
  | {
      readonly kind: "svg-path";
      readonly path: string;
      readonly viewBox: string;
    };

export interface UiButtonDescriptor {
  readonly id: string;
  readonly label?: string;
  readonly accessibleLabel?: string;
  readonly title?: string;
  readonly icon?: UiButtonIconDescriptor;
  readonly enabled?: boolean;
  readonly variant?: UiButtonVariant;
}

export interface NormalizedUiButtonDescriptor {
  readonly id: string;
  readonly label?: string;
  readonly accessibleLabel: string;
  readonly title?: string;
  readonly icon: UiButtonIconDescriptor;
  readonly enabled: boolean;
  readonly variant: UiButtonVariant;
}

export interface UiButtonRenderState {
  readonly pressed?: boolean;
  readonly active?: boolean;
  readonly disabled?: boolean;
}

const DEFAULT_ICON: UiButtonIconDescriptor = { kind: "none" };

export function normalizeUiButtonDescriptor(
  descriptor: UiButtonDescriptor
): NormalizedUiButtonDescriptor {
  if (!descriptor.id) {
    throw new Error("UiButtonDescriptor requires id.");
  }
  const label = normalizeOptionalString(descriptor.label, "label");
  const title = normalizeOptionalString(descriptor.title, "title");
  const accessibleLabel = normalizeOptionalString(descriptor.accessibleLabel, "accessibleLabel")
    ?? label
    ?? title;
  if (!accessibleLabel) {
    throw new Error("UiButtonDescriptor requires label, title, or accessibleLabel.");
  }
  return {
    id: descriptor.id,
    label,
    accessibleLabel,
    title,
    icon: cloneIcon(descriptor.icon ?? DEFAULT_ICON),
    enabled: descriptor.enabled ?? true,
    variant: normalizeVariant(descriptor.variant)
  };
}

export function cloneUiButtonIconDescriptor(icon: UiButtonIconDescriptor): UiButtonIconDescriptor {
  return cloneIcon(icon);
}

function normalizeOptionalString(value: string | undefined, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`UiButtonDescriptor ${fieldName} must be a string.`);
  }
  return value;
}

function normalizeVariant(variant: UiButtonVariant | undefined): UiButtonVariant {
  if (variant === undefined) return "plain";
  if (variant !== "plain" && variant !== "toolbar") {
    throw new Error(`Invalid UiButtonDescriptor variant: ${String(variant)}`);
  }
  return variant;
}

function cloneIcon(icon: UiButtonIconDescriptor): UiButtonIconDescriptor {
  if (icon.kind === "none") return { kind: "none" };
  if (icon.kind === "text") {
    if (typeof icon.value !== "string") {
      throw new Error("UiButtonIconDescriptor text value must be a string.");
    }
    return { kind: "text", value: icon.value };
  }
  if (icon.kind === "svg-path") {
    if (!icon.path || !icon.viewBox) {
      throw new Error("UiButtonIconDescriptor svg-path requires path and viewBox.");
    }
    return {
      kind: "svg-path",
      path: icon.path,
      viewBox: icon.viewBox
    };
  }
  throw new Error(`Invalid UiButtonIconDescriptor kind: ${String((icon as { kind?: unknown }).kind)}`);
}

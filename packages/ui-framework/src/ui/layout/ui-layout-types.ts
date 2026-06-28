export type UiLayoutSlot =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "fill"
  | "overlay";

export type UiLayoutStretch =
  | "none"
  | "horizontal"
  | "vertical"
  | "both";

export interface UiLayoutSize {
  readonly width?: number;
  readonly height?: number;
}

export interface UiLayoutItemDescriptor {
  readonly slot: UiLayoutSlot;
  readonly order: number;
  readonly layer: number;
  readonly stretch: UiLayoutStretch;
  readonly minSize?: UiLayoutSize;
  readonly preferredSize?: UiLayoutSize;
}

export interface UiLayoutItemComponentOptions {
  readonly id?: string;
  readonly slot?: UiLayoutSlot;
  readonly order?: number;
  readonly layer?: number;
  readonly stretch?: UiLayoutStretch;
  readonly minSize?: UiLayoutSize | null;
  readonly preferredSize?: UiLayoutSize | null;
}

export type UiLayoutItemUpdate = Partial<
  Omit<UiLayoutItemComponentOptions, "id">
>;

import type { WindowDockRect, WindowDockSplitPlacement } from "./window-dock-targets";
import type { WindowViewIdentity } from "./window-view-identity";
import type { WindowViewKey } from "./window-view-key";

export type WindowFramePresentation = "windowed" | "fullscreen";
export type WindowFrameSuppressionReason = "workspace-run";

export interface WindowFrameTab {
  readonly viewActorId: string;
  readonly identity?: WindowViewIdentity;
  readonly viewKey: WindowViewKey;
  readonly title: string;
}

export interface WindowFrameRuntimeTabsetNode {
  readonly kind: "tabset";
  readonly id: string;
  readonly tabs: readonly string[];
  readonly activeViewActorId: string | null;
}

export interface WindowFrameRuntimeSplitNode {
  readonly kind: "split";
  readonly id: string;
  readonly direction: "horizontal" | "vertical";
  readonly ratio: number;
  readonly first: WindowFrameRuntimeDockNode;
  readonly second: WindowFrameRuntimeDockNode;
}

export type WindowFrameRuntimeDockNode =
  | WindowFrameRuntimeTabsetNode
  | WindowFrameRuntimeSplitNode;

export interface WindowFrameDockTargetTabset {
  readonly targetTabsetId: string;
  readonly tabBounds: WindowDockRect;
  readonly contentBounds: WindowDockRect;
}

export interface WindowFrameDockTabOptions {
  readonly active?: boolean;
  readonly targetTabsetId?: string;
}

export interface WindowFrameDockSplitOptions {
  readonly targetTabsetId: string;
  readonly placement: WindowDockSplitPlacement;
  readonly active?: boolean;
}

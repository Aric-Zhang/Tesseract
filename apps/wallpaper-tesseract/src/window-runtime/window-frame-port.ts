import type { ParameterPath } from "../scene-runtime";
import type { FloatingWindowState } from "./floating-window-state";
import type { WindowContentHost } from "./floating-window-host";
import type { WindowDockRect } from "./window-dock-targets";
import type { WindowDockSplitPlacement } from "./window-dock-targets";
import type { WindowViewKey } from "./window-view-key";

export type WindowFramePresentation = "windowed" | "fullscreen";

export interface WindowFrameTab {
  readonly viewActorId: string;
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

export interface WindowFramePort {
  readonly frameId: string;
  readonly visiblePath: ParameterPath<boolean> | null;
  readonly visible: boolean;
  readonly presentation: WindowFramePresentation;

  listTabs(): readonly WindowFrameTab[];
  getRuntimeDockRoot(): WindowFrameRuntimeDockNode;
  restoreRuntimeDockRoot(root: WindowFrameRuntimeDockNode, options?: {
    readonly tabs?: readonly WindowFrameTab[];
    readonly activeViewActorId?: string | null;
  }): void;
  listDockTargetTabsets(): readonly WindowFrameDockTargetTabset[];
  getActiveViewActorId(): string | null;
  isViewActiveInFrame(viewActorId: string): boolean;
  isViewVisibleInFrame(viewActorId: string): boolean;
  addTab(tab: WindowFrameTab, options?: {
    readonly active?: boolean;
    readonly targetTabsetId?: string;
  }): void;
  splitTab(tab: WindowFrameTab, options: {
    readonly targetTabsetId: string;
    readonly placement: WindowDockSplitPlacement;
    readonly active?: boolean;
  }): void;
  removeTab(viewActorId: string): void;
  activateTab(viewActorId: string): void;
  hasTab(viewActorId: string): boolean;
  hasTabset(targetTabsetId: string): boolean;
  getContentHost(viewActorId: string): WindowContentHost;
  getFloatingBounds(): WindowDockRect;
  restoreFloatingState(state: FloatingWindowState): void;
  setPresentation(presentation: WindowFramePresentation): void;
  requestVisible(visible: boolean, timeStamp?: number): void;
}

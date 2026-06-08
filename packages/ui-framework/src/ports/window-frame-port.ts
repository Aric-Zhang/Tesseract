import type { FloatingWindowState } from "../model/floating-window-state";
import type { WindowContentHost } from "./window-content-host";
import type { UiLayoutPath } from "./ui-layout-state";
import type { WindowDockRect, WindowDockSplitPlacement } from "../model/window-dock-targets";
import type {
  WindowFrameDockTargetTabset,
  WindowFramePresentation,
  WindowFrameRuntimeDockNode,
  WindowFrameSuppressionReason,
  WindowFrameTab
} from "../model/window-frame-tab";

export interface WindowFramePort {
  readonly frameId: string;
  readonly visiblePath: UiLayoutPath<boolean> | null;
  /**
   * Persistent frame visibility. Runtime presentation sessions should use
   * `effectiveVisible` instead of mutating this value.
   */
  readonly visible: boolean;
  readonly effectiveVisible: boolean;
  readonly presentationSuppressed: boolean;
  readonly presentation: WindowFramePresentation;

  listTabs(): readonly WindowFrameTab[];
  getRuntimeDockRoot(): WindowFrameRuntimeDockNode;
  restoreRuntimeDockRoot(root: WindowFrameRuntimeDockNode, options?: {
    readonly tabs?: readonly WindowFrameTab[];
    readonly activeViewActorId?: string | null;
  }): void;
  listDockTargetTabsets(): readonly WindowFrameDockTargetTabset[];
  getFocusedViewActorId(): string | null;
  getActiveViewActorIds(): readonly string[];
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
  setPresentationSuppressed(reason: WindowFrameSuppressionReason, suppressed: boolean): void;
  requestVisible(visible: boolean, timeStamp?: number): void;
}

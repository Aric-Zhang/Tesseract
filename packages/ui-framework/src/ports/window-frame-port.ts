import type { FloatingWindowState } from "../model/floating-window-state";
import type { UiLayoutPath } from "./ui-layout-state";
import type { WindowDockRect } from "../model/window-dock-targets";
import type {
  WindowFramePresentation,
  WindowFrameSuppressionReason
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
  readonly persistable: boolean;
  readonly presentationSuppressed: boolean;
  readonly presentation: WindowFramePresentation;

  getFloatingBounds(): WindowDockRect;
  restoreFloatingState(state: FloatingWindowState): void;
  setPresentation(presentation: WindowFramePresentation): void;
  setPresentationSuppressed(reason: WindowFrameSuppressionReason, suppressed: boolean): void;
  requestVisible(visible: boolean, timeStamp?: number): void;
}

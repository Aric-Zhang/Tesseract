import type { WindowViewKey } from "./window-view-key";

export type WindowFrameLifecycleReason =
  | "close-button"
  | "dock-drop"
  | "menu"
  | "programmatic";

export interface WindowFrameLifecycleController {
  openView(viewKey: WindowViewKey, reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">): void;
  closeFrame(
    frameId: string,
    reason: Extract<WindowFrameLifecycleReason, "close-button" | "programmatic">
  ): void;
}

export interface WindowFrameIntentSink {
  requestOpenView(viewKey: WindowViewKey, reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">): void;
  requestCloseFrame(
    frameId: string,
    reason: Extract<WindowFrameLifecycleReason, "close-button" | "programmatic">
  ): void;
}

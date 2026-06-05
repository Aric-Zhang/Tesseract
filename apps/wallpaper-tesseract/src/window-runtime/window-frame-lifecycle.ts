import type { Actor } from "../actor-runtime";
import type { WindowViewKey } from "./window-view-key";
import type { WindowDockRect } from "./window-dock-targets";
import type { WindowTabDragSource } from "./window-tab-drag-session";
import type { WindowFramePort, WindowFrameTab } from "./window-frame-port";

export type WindowFrameLifecycleReason =
  | "close-button"
  | "dock-drop"
  | "menu"
  | "tab-click"
  | "programmatic";

export interface WindowFrameLifecycleController {
  openView(viewKey: WindowViewKey, reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">): void;
  closeFrame(
    frameId: string,
    reason: Extract<WindowFrameLifecycleReason, "close-button" | "programmatic">
  ): void;
  activateFrameTab(
    frameId: string,
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
  ): void;
  validateDockCommit(intent: WindowDockCommitIntent): WindowDockCommitValidationResult;
  commitDock(intent: WindowDockCommitIntent): WindowDockCommitResult;
}

export type WindowDockCommitIntent =
  | {
      readonly kind: "merge-tabs";
      readonly source: WindowTabDragSource;
      readonly targetFrameId: string;
      readonly reason: Extract<WindowFrameLifecycleReason, "dock-drop">;
    }
  | {
      readonly kind: "float-tab";
      readonly source: WindowTabDragSource;
      readonly bounds: WindowDockRect;
      readonly reason: Extract<WindowFrameLifecycleReason, "dock-drop">;
    };

export type WindowDockCommitValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

export type WindowDockCommitResult =
  | {
      readonly committed: true;
      readonly sourceFrameDestroyed: boolean;
      readonly warning?: string;
    }
  | { readonly committed: false; readonly reason: string };

export interface WindowFloatingFrameCreateOptions {
  readonly source: WindowTabDragSource;
  readonly tab: WindowFrameTab;
  readonly bounds: WindowDockRect;
  readonly reason: Extract<WindowFrameLifecycleReason, "dock-drop">;
}

export interface WindowFloatingFrameCreateResult {
  readonly frameActor: Actor;
  readonly framePort: WindowFramePort;
}

export type WindowFloatingFrameFactory = (
  options: WindowFloatingFrameCreateOptions
) => WindowFloatingFrameCreateResult;

export interface WindowFrameIntentSink {
  requestOpenView(viewKey: WindowViewKey, reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">): void;
  requestCloseFrame(
    frameId: string,
    reason: Extract<WindowFrameLifecycleReason, "close-button" | "programmatic">
  ): void;
  requestActivateFrameTab?(
    frameId: string,
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
  ): void;
  requestCommitDock?(intent: WindowDockCommitIntent): void;
}

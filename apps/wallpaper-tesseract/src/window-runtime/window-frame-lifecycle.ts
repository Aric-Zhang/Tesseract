import type { Actor } from "../actor-runtime";
import type { ParameterPath } from "../scene-runtime";
import type { WindowViewKey } from "./window-view-key";
import type { WindowDockRect } from "./window-dock-targets";
import type { WindowDockSplitPlacement } from "./window-dock-targets";
import type { WindowTabDragSource } from "./window-tab-drag-session";
import type { WindowFramePort, WindowFramePresentation, WindowFrameTab } from "./window-frame-port";
import type { WindowWorkspaceFrameLayout } from "./window-workspace-layout";

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

export interface WindowViewLocation {
  readonly viewKey: WindowViewKey;
  readonly viewActorId: string;
  readonly ownerFrameActorId: string;
  readonly ownerFrameVisiblePath: ParameterPath<boolean> | null;
  readonly ownerFrameVisible: boolean;
  readonly ownerFrameActiveInHierarchy: boolean;
  readonly activeInFrame: boolean;
  readonly visibleInFrame: boolean;
  readonly presentation: WindowFramePresentation;
}

export interface WindowViewLocationSource {
  getLocationByViewKey(viewKey: WindowViewKey): WindowViewLocation | null;
  getLocationByViewActorId(viewActorId: string): WindowViewLocation | null;
  listLocations(): readonly WindowViewLocation[];
}

export interface WindowViewOwnerCommandPort {
  activateView(
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
  ): void;
  focusOwner(
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "programmatic">
  ): void;
  setOwnerPresentation(viewActorId: string, presentation: WindowFramePresentation): void;
  requestOwnerVisible(viewActorId: string, visible: boolean, timeStamp?: number): void;
}

export type WindowViewFullscreenReason = "programmatic" | "scene-toggle";

export interface WindowViewFullscreenSession {
  readonly viewActorId: string;
  readonly viewKey: WindowViewKey;
  readonly mode: "direct-frame" | "isolated-frame";
  readonly fullscreenFrameId: string;
}

export interface WindowViewPresentationCommandPort {
  enterViewFullscreen(viewActorId: string, reason: WindowViewFullscreenReason): void;
  exitViewFullscreen(viewActorId: string, reason: WindowViewFullscreenReason): void;
  getViewFullscreenSession(viewActorId: string): WindowViewFullscreenSession | null;
  isViewFullscreenIsolated(viewActorId: string): boolean;
}

export interface WindowFrameLayoutSnapshotSource {
  createFrameLayoutSnapshot(): WindowWorkspaceFrameLayout;
}

export interface WindowFrameLayoutRestoreResult {
  readonly restoredViewKeys: readonly WindowViewKey[];
  readonly skippedViewKeys: readonly WindowViewKey[];
  readonly destroyedFrameIds: readonly string[];
}

export interface WindowFrameLayoutRestorePort {
  restoreFrameLayout(
    layout: WindowWorkspaceFrameLayout,
    reason: Extract<WindowFrameLifecycleReason, "programmatic">
  ): WindowFrameLayoutRestoreResult;
}

export type WindowDockCommitIntent =
  | {
    readonly kind: "merge-tabs";
    readonly source: WindowTabDragSource;
    readonly targetFrameId: string;
    readonly targetTabsetId: string;
    readonly reason: Extract<WindowFrameLifecycleReason, "dock-drop">;
  }
  | {
      readonly kind: "split-tab";
      readonly source: WindowTabDragSource;
      readonly targetFrameId: string;
      readonly targetTabsetId: string;
      readonly placement: WindowDockSplitPlacement;
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
  readonly reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "programmatic">;
  readonly runtimeOnly?: boolean;
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

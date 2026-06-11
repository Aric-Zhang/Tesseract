import type { Actor } from "actor-core";
import type { WindowDockPreviewOperation, WindowDockRect, WindowDockSplitPlacement } from "../model/window-dock-targets";
import type { WindowTabDragSource } from "../model/window-tab-drag-session";
import type { WindowFramePresentation, WindowFrameTab } from "../model/window-frame-tab";
import type { WindowViewIdentity, WindowViewTypeKey } from "../model/window-view-identity";
import type { WindowViewKey } from "../model/window-view-key";
import type { WindowWorkspaceFrameLayout } from "../model/window-workspace-layout";
import type { UiLayoutPath } from "../ports/ui-layout-state";
import type { WindowFramePort } from "../ports/window-frame-port";

export type WindowFrameLifecycleReason =
  | "close-button"
  | "dock-drop"
  | "menu"
  | "tab-click"
  | "tab-action"
  | "programmatic";

export interface WindowFrameLifecycleController {
  openView(
    viewKey: WindowViewKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options?: WindowOpenViewOptions
  ): void;
  openOrFocusViewType(
    typeKey: WindowViewTypeKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options?: WindowOpenViewOptions
  ): WindowViewIdentity | null;
  createViewInstance(
    typeKey: WindowViewTypeKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options?: WindowOpenViewOptions
  ): WindowViewIdentity | null;
  focusViewInstance(
    identity: WindowViewIdentity,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic" | "tab-click">
  ): boolean;
  closeFrame(
    frameId: string,
    reason: Extract<WindowFrameLifecycleReason, "close-button" | "programmatic">
  ): WindowCloseFrameResult;
  closeView(
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "tab-action" | "programmatic">,
    options?: WindowCloseViewOptions
  ): WindowCloseViewResult;
  activateFrameTab(
    frameId: string,
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
  ): void;
  resizeFrameSplit(
    frameId: string,
    splitId: string,
    ratio: number,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "programmatic">
  ): WindowFrameSplitResizeResult;
  validateDockCommit(intent: WindowDockCommitIntent): WindowDockCommitValidationResult;
  commitDock(intent: WindowDockCommitIntent): WindowDockCommitResult;
}

export interface WindowViewLocation {
  readonly viewKey: WindowViewKey;
  readonly identity: WindowViewIdentity;
  readonly viewActorId: string;
  readonly ownerFrameActorId: string;
  readonly ownerFrameVisiblePath: UiLayoutPath<boolean> | null;
  readonly ownerFrameVisible: boolean;
  readonly ownerFrameActiveInHierarchy: boolean;
  readonly activeInFrame: boolean;
  readonly visibleInFrame: boolean;
  readonly presentation: WindowFramePresentation;
  readonly activationSequence: number;
}

export interface WindowOpenViewOptions {
  readonly preferredFrameId?: string;
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

export type WindowViewFullscreenReason = "programmatic" | "toggle";

export interface WindowViewFullscreenSession {
  readonly viewActorId: string;
  readonly viewKey: WindowViewKey;
  readonly mode: "direct-frame" | "isolated-frame";
  readonly fullscreenFrameId: string;
}

export interface WindowViewPresentationCommandPort {
  enterViewFullscreen(viewActorId: string, reason: WindowViewFullscreenReason): void;
  enterViewWorkspaceFullscreen(viewActorId: string, reason: WindowViewFullscreenReason): void;
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
    readonly operation: Extract<WindowDockPreviewOperation, "cross-frame-merge" | "same-frame-reorder">;
    readonly source: WindowTabDragSource;
    readonly targetFrameId: string;
    readonly targetTabsetId: string;
    readonly reason: Extract<WindowFrameLifecycleReason, "dock-drop">;
  }
  | {
      readonly kind: "split-tab";
      readonly operation: Extract<WindowDockPreviewOperation, "cross-frame-split" | "same-frame-split">;
      readonly source: WindowTabDragSource;
      readonly targetFrameId: string;
      readonly targetTabsetId: string;
      readonly placement: WindowDockSplitPlacement;
      readonly reason: Extract<WindowFrameLifecycleReason, "dock-drop">;
    }
  | {
      readonly kind: "float-tab";
      readonly operation: Extract<WindowDockPreviewOperation, "cross-frame-float">;
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

export type WindowFrameSplitResizeResult =
  | { readonly resized: true }
  | { readonly resized: false; readonly reason: string };

export type WindowCloseViewResult =
  | {
      readonly closed: true;
      readonly sourceFrameId: string;
      readonly ownerFrameDestroyed: boolean;
      readonly nextActiveViewActorId: string | null;
      readonly warning?: string;
    }
  | {
      readonly closed: false;
      readonly reason: string;
      readonly sourceFrameId?: string;
      readonly error?: string;
      readonly warning?: string;
    };

export interface WindowCloseViewOptions {
  readonly viewKey?: WindowViewKey;
  readonly identity?: WindowViewIdentity;
  readonly ownerFrameId?: string;
}

export type WindowCloseFrameResult =
  | {
      readonly closed: true;
      readonly frameId: string;
      readonly closedViewActorIds: readonly string[];
      readonly warning?: string;
    }
  | {
      readonly closed: false;
      readonly frameId?: string;
      readonly reason: string;
      readonly error?: string;
    };

export interface WindowFloatingFrameCreateOptions {
  readonly source?: WindowTabDragSource;
  readonly tab?: WindowFrameTab;
  readonly viewKey?: WindowViewKey;
  readonly title?: string;
  readonly bounds?: WindowDockRect;
  readonly reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "programmatic">;
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
  requestOpenView(
    viewKey: WindowViewKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options?: WindowOpenViewOptions
  ): void;
  requestOpenOrFocusViewType?(
    typeKey: WindowViewTypeKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options?: WindowOpenViewOptions
  ): void;
  requestCreateViewInstance?(
    typeKey: WindowViewTypeKey,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">,
    options?: WindowOpenViewOptions
  ): void;
  requestFocusViewInstance?(
    identity: WindowViewIdentity,
    reason: Extract<WindowFrameLifecycleReason, "menu" | "programmatic">
  ): void;
  requestCloseFrame(
    frameId: string,
    reason: Extract<WindowFrameLifecycleReason, "close-button" | "programmatic">
  ): void;
  requestCloseView?(
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "tab-action" | "programmatic">,
    options?: WindowCloseViewOptions
  ): void;
  requestActivateFrameTab?(
    frameId: string,
    viewActorId: string,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "menu" | "tab-click" | "programmatic">
  ): void;
  requestResizeFrameSplit?(
    frameId: string,
    splitId: string,
    ratio: number,
    reason: Extract<WindowFrameLifecycleReason, "dock-drop" | "programmatic">
  ): void;
  requestCommitDock?(intent: WindowDockCommitIntent): void;
}

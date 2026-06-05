export {
  DEFAULT_FLOATING_WINDOW_MIN_SIZE,
  cloneFloatingWindowState,
  createDefaultFloatingWindowState,
  registerFloatingWindowParameters
} from "./floating-window-state";
export { createActorWindowFocusServiceProxy } from "./actor-window-focus-service";
export type { ActorWindowFocusServiceProxy } from "./actor-window-focus-service";
export { createDockTargetRegionSource } from "./dock-target-frame-source";
export type {
  DockTargetRegionSource,
  DockTargetRegionSourceOptions
} from "./dock-target-frame-source";
export type {
  FloatingWindowParameterPaths,
  FloatingWindowState,
  FloatingWindowStateOptions,
  RegisterFloatingWindowParametersOptions
} from "./floating-window-state";
export { windowViewKey } from "./window-view-key";
export type { WindowViewKey } from "./window-view-key";
export {
  createSingletonWindowViewIdentity,
  createWindowViewKeyFromTypeAndInstance,
  windowViewInstanceId,
  windowViewTypeKey
} from "./window-view-identity";
export type {
  WindowViewIdentity,
  WindowViewInstanceId,
  WindowViewMultiplicity,
  WindowViewTypeKey
} from "./window-view-identity";
export type {
  WindowFramePort,
  WindowFramePresentation,
  WindowFrameRuntimeDockNode,
  WindowFrameRuntimeSplitNode,
  WindowFrameRuntimeTabsetNode,
  WindowFrameTab
} from "./window-frame-port";
export type {
  WindowFrameIntentSink,
  WindowFrameLifecycleController,
  WindowFrameLifecycleReason,
  WindowFloatingFrameCreateOptions,
  WindowFloatingFrameCreateResult,
  WindowFloatingFrameFactory,
  WindowFrameLayoutRestorePort,
  WindowFrameLayoutRestoreResult,
  WindowFrameLayoutSnapshotSource,
  WindowViewLocation,
  WindowViewLocationSource,
  WindowViewOwnerCommandPort,
  WindowViewFullscreenReason,
  WindowViewFullscreenSession,
  WindowViewPresentationCommandPort
} from "./window-frame-lifecycle";
export { DefaultWindowFrameLifecycleController } from "./window-frame-lifecycle-controller";
export type { WindowFrameLifecycleControllerOptions } from "./window-frame-lifecycle-controller";
export { getWindowViewFactoryIdentity, WindowViewFactoryRegistry } from "./window-view-factory-registry";
export type {
  WindowViewFactory,
  WindowViewFactoryCreateOptions,
  WindowViewFactoryResult
} from "./window-view-factory-registry";
export {
  createWindowContentAttachment,
  getWindowContentAttachment
} from "./floating-window-host";
export {
  findOwningFloatingWindowHost,
  findOwningWindowContentHost
} from "./window-content-host-resolver";
export {
  WindowDockPreviewComponent,
  WindowDockPreviewController
} from "./window-dock-preview-component";
export type {
  WindowDockPreviewControllerState,
  WindowDockPreviewComponentOptions,
  WindowDockPreviewControllerOptions,
  WindowTabDragSink
} from "./window-dock-preview-component";
export {
  rectFromDomRect,
  resolveWindowDockPreview
} from "./window-dock-targets";
export type {
  ResolveWindowDockPreviewOptions,
  WindowDockPreview,
  WindowDockPoint,
  WindowDockRect,
  WindowDockSplitPlacement,
  WindowDockTargetRegion
} from "./window-dock-targets";
export { WindowTabDragSession } from "./window-tab-drag-session";
export type {
  WindowTabDragSessionEndResult,
  WindowTabDragSessionMoveResult,
  WindowTabDragSessionOptions,
  WindowTabDragSessionStart,
  WindowTabDragSessionState,
  WindowTabDragSource
} from "./window-tab-drag-session";
export type {
  FloatingWindowContentAttachment,
  FloatingWindowHost,
  WindowContentAttachment,
  WindowContentAttachmentRequest,
  WindowContentHost,
  WindowContentRehostable
} from "./floating-window-host";
export {
  DEFAULT_FLOATING_WINDOW_PRIORITY,
  FloatingWindowComponent,
  floatingWindowComponentType
} from "./floating-window-component";
export type {
  FloatingWindowActivationMode,
  FloatingWindowCloseMode,
  FloatingWindowComponentOptions,
  FloatingWindowComponentServices,
  FloatingWindowMenuDescriptor,
  FloatingWindowMenuOptions,
  FloatingWindowPresentation
} from "./floating-window-component";
export { floatingWindowComponentDefinition } from "./floating-window-definition";
export { installWindowComponentDefinitions } from "./install-component-definitions";
export type { RegisteredWindowActor } from "./registered-window-actor";
export { createWindowControlSource } from "./window-control-source";
export type {
  WindowControlItem,
  WindowControlSource,
  WindowControlSourceOptions
} from "./window-control-source";
export { createWindowMenuViewSource } from "./window-menu-view-source";
export type {
  WindowMenuViewItem,
  WindowMenuViewSource,
  WindowMenuViewSourceOptions
} from "./window-menu-view-source";
export {
  hydrateWindowWorkspaceFrameLayout,
  parsePersistedWindowWorkspaceFrameLayout,
  serializeWindowWorkspaceFrameLayout,
  WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION
} from "./window-workspace-layout-persistence";
export type {
  PersistedWindowWorkspaceFrameDescriptor,
  PersistedWindowWorkspaceFrameLayout,
  PersistedWindowWorkspaceViewDescriptor
} from "./window-workspace-layout-persistence";
export {
  loadPersistedWindowWorkspaceFrameLayout,
  WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_CONTROLLER_ID,
  WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY,
  WindowWorkspaceFrameLayoutPersistenceController
} from "./window-workspace-layout-persistence-controller";
export type {
  WindowWorkspaceFrameLayoutPersistenceControllerOptions,
  WindowWorkspaceFrameLayoutStorage
} from "./window-workspace-layout-persistence-controller";
export {
  closeFrameInWorkspaceFrameLayout,
  collectFrameViewKeys,
  createSingleTabWindowFrame,
  createWindowWorkspaceFrameLayout,
  createWindowWorkspaceLayout,
  dockWindowAsTab,
  findDockTabsetContaining,
  findFrameContainingView,
  normalizeWindowWorkspaceFrameLayout,
  normalizeWindowWorkspaceLayout,
  removeWindowFromDock,
  removeWindowFromLayout,
  restoreViewAsSingleTabFrame,
  setActiveDockTab,
  splitDockViewInFrameLayout,
  splitDockTab,
  undockWindow
} from "./window-workspace-layout";
export type {
  CreateSingleTabWindowFrameOptions,
  CreateWindowWorkspaceFrameLayoutOptions,
  CreateWindowWorkspaceLayoutOptions,
  RestoreViewAsSingleTabFrameOptions,
  SplitDockTabOptions,
  WindowFrameSplitPlacement,
  WindowFrameDockNode,
  WindowFrameSplitNode,
  WindowFrameTabsetNode,
  WindowSplitLayoutCommit,
  WindowSplitLayoutCommitResult,
  WindowWorkspaceFrameDescriptor,
  WindowWorkspaceFrameLayout,
  WindowWorkspaceFramePresentation,
  WindowWorkspaceViewDescriptor,
  WindowWorkspaceDockNode,
  WindowWorkspaceFloatingWindow,
  WindowWorkspaceLayout,
  WindowWorkspaceSplitDirection,
  WindowWorkspaceSplitNode,
  WindowWorkspaceSplitPlacement,
  WindowWorkspaceTabsetNode,
  WindowWorkspaceWindowDescriptor
} from "./window-workspace-layout";
export {
  WINDOW_FLOATING_FOCUS_LAYER_END,
  WINDOW_FLOATING_FOCUS_LAYER_START,
  WINDOW_WORKSPACE_CONTROLLER_ID,
  WindowWorkspaceController
} from "./window-workspace-controller";
export type {
  WindowWorkspaceControllerOptions,
  WindowWorkspaceStackEntry
} from "./window-workspace-controller";
export {
  WINDOW_VISIBILITY_ACTIVATION_CONTROLLER_ID,
  WINDOW_VISIBILITY_ACTIVATION_CONTROLLER_PRIORITY,
  WindowVisibilityActivationController
} from "./window-visibility-activation-controller";
export type { WindowVisibilityActivationControllerOptions } from "./window-visibility-activation-controller";

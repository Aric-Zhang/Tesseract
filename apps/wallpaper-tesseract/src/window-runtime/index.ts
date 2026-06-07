export {
  DEFAULT_FLOATING_WINDOW_MIN_SIZE,
  cloneFloatingWindowState,
  createDefaultFloatingWindowState,
  registerFloatingWindowParameters
} from "./floating-window-state";
export { createActorWindowFocusServiceProxy } from "./actor-window-focus-service";
export type { ActorWindowFocusServiceProxy } from "./actor-window-focus-service";
export { createDockTargetRegionSource } from "./dock-target-region-source";
export type {
  DockTargetRegionSource,
  DockTargetRegionSourceOptions
} from "./dock-target-region-source";
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
  createWindowViewIdentity,
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
  WindowFrameSuppressionReason,
  WindowFrameTab
} from "./window-frame-port";
export { WindowFramePortRegistry } from "./window-frame-port-registry";
export type {
  RegisteredWindowFramePort,
  WindowFramePortRegistryEntry,
  WindowFramePortRegistryView
} from "./window-frame-port-registry";
export { createWindowWorkspaceViewCatalog } from "./window-workspace-view-catalog";
export type {
  WindowWorkspaceFrameEntry,
  WindowWorkspaceViewCatalog,
  WindowWorkspaceViewEntry
} from "./window-workspace-view-catalog";
export { createWindowWorkspaceStackPriorityPort } from "./window-workspace-stack-priority-port";
export type { WindowWorkspaceStackPriorityPort } from "./window-workspace-stack-priority-port";
export type {
  WindowFrameIntentSink,
  WindowFrameLifecycleController,
  WindowFrameLifecycleReason,
  WindowCloseFrameResult,
  WindowCloseViewResult,
  WindowCloseViewOptions,
  WindowFloatingFrameCreateOptions,
  WindowFloatingFrameCreateResult,
  WindowFloatingFrameFactory,
  WindowFrameLayoutRestorePort,
  WindowFrameLayoutRestoreResult,
  WindowFrameLayoutSnapshotSource,
  WindowViewLocation,
  WindowViewLocationSource,
  WindowOpenViewOptions,
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
  WindowViewRuntimeFactoryResult
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
export {
  createWindowTabCloseAction,
  isWindowTabAction
} from "./window-tab-action";
export type { WindowTabAction } from "./window-tab-action";
export {
  WINDOW_FRAME_TAB_ACTION_PART_ID,
  WINDOW_FRAME_TAB_PART_ID,
  findWindowFrameTabActionAtPoint,
  findWindowFrameTabAtPoint,
  renderWindowFrameTabsetTabs
} from "./window-frame-tab-chrome";
export type {
  RenderWindowFrameTabsetOptions,
  WindowFrameTabChromeMaps
} from "./window-frame-tab-chrome";
export {
  WindowFrameSurfaceComponent,
  windowFrameSurfaceComponentType
} from "./window-frame-surface-component";
export type {
  WindowFrameSurfaceComponentOptions,
  WindowFrameSurfaceHit,
  WindowFrameSurfaceHost
} from "./window-frame-surface-component";
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
export {
  WORKSPACE_ROOT_FRAME_ID,
  WORKSPACE_ROOT_FRAME_PRIORITY,
  WorkspaceRootDockFrameComponent,
  workspaceRootDockFrameComponentType
} from "./workspace-root-dock-frame-component";
export type {
  WorkspaceRootDockFrameComponentOptions,
  WorkspaceRootDockFrameComponentServices
} from "./workspace-root-dock-frame-component";
export { workspaceRootDockFrameComponentDefinition } from "./workspace-root-dock-frame-definition";
export { windowFrameSurfaceComponentDefinition } from "./window-frame-surface-definition";
export { installWindowComponentDefinitions } from "./install-component-definitions";
export type { RegisteredWindowActor } from "./registered-window-actor";
export {
  hydrateWindowWorkspaceFrameLayout,
  getPersistedViewDescriptorIdentity,
  getPersistedViewDescriptorRuntimeViewKey,
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
  findFrameContainingView,
  normalizeWindowWorkspaceFrameLayout,
  restoreViewAsSingleTabFrame,
  splitDockViewInFrameLayout
} from "./window-workspace-layout";
export type {
  CreateSingleTabWindowFrameOptions,
  CreateWindowWorkspaceFrameLayoutOptions,
  RestoreViewAsSingleTabFrameOptions,
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
  WindowWorkspaceSplitDirection,
  WindowWorkspaceSplitPlacement
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
  WINDOW_WORKSPACE_PRESENTATION_CONTROLLER_ID,
  WindowWorkspacePresentationController
} from "./window-workspace-presentation-controller";
export type {
  WindowWorkspacePresentationControllerOptions,
  WindowWorkspacePresentationResult,
  WindowWorkspacePresentationSession
} from "./window-workspace-presentation-controller";

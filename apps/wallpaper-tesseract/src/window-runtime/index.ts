export { DEFAULT_FLOATING_WINDOW_MIN_SIZE, cloneFloatingWindowState, createDefaultFloatingWindowState } from "ui-framework/window";
export { addUiVec2, assertUiVec2, cloneUiVec2, equalsUiVec2, uiVec2 } from "ui-framework/actor-ui";
export { uiLayoutPath } from "ui-framework/actor-ui";
export type { UiFrame, UiScheduledService, UiScheduler, UiSchedulerRegistration } from "ui-framework/actor-ui";
export type { UiActorContext, UiActorContextRegistration } from "ui-framework/actor-ui";
export type { UiPoint, UiSize, UiVec2 } from "ui-framework/actor-ui";
export type { UiLayoutCommand, UiLayoutCommandOperation, UiLayoutCommandSink, UiLayoutCommandSource, UiLayoutPath, UiLayoutStateReader, UiLayoutStateChange, UiLayoutStateChangedEvent } from "ui-framework/actor-ui";
export { createWindowFocusServiceProxy } from "./window-focus-service-proxy";
export type { WindowFocusServiceProxy } from "./window-focus-service-proxy";
export type {
  WindowFocusCommandPort,
  WindowFocusReason
} from "./window-focus-command-port";
export { createDockTargetRegionSource } from "./dock-target-region-source";
export type {
  DockTargetRegionSource,
  DockTargetRegionSourceOptions
} from "./dock-target-region-source";
export { createWindowFrameTargetabilitySource } from "ui-framework/window";
export type { WindowFrameTargetability, WindowFrameTargetabilitySource, WindowFrameTargetabilitySourceOptions } from "ui-framework/window";
export type { FloatingWindowParameterPaths, FloatingWindowState, FloatingWindowStateOptions } from "ui-framework/window";
export { windowViewKey } from "ui-framework/window";
export type { WindowViewKey } from "ui-framework/window";
export { createSingletonWindowViewIdentity, createWindowViewIdentity, createWindowViewKeyFromTypeAndInstance, windowViewInstanceId, windowViewTypeKey } from "ui-framework/window";
export type { WindowViewIdentity, WindowViewInstanceId, WindowViewMultiplicity, WindowViewTypeKey } from "ui-framework/window";
export type {
  WindowFramePort,
  WindowFramePresentation,
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
  WindowFrameSplitResizeResult,
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
export { createWindowWorkspaceContentId } from "ui-framework/window";
export type { WindowContentLayoutCommit, WindowContentLayoutCommitRegistration } from "ui-framework/window";
export { WindowContentRegistry } from "./floating-window-host";
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
export { rectFromDomRect } from "ui-framework/window";
export { resolveWindowDockPreview } from "ui-framework/window";
export type {
  ResolveWindowDockPreviewOptions,
  WindowDockPreview,
  WindowDockPoint,
  WindowDockRect,
  WindowDockSplitPlacement,
  WindowDockTargetRegion
} from "ui-framework/window";
export { WindowTabDragSession } from "ui-framework/window";
export type {
  WindowTabDragSessionEndResult,
  WindowTabDragSessionMoveResult,
  WindowTabDragSessionOptions,
  WindowTabDragSessionStart,
  WindowTabDragSessionState,
  WindowTabDragSource
} from "ui-framework/window";
export {
  createWindowTabCloseAction,
  isWindowTabAction
} from "ui-framework/window";
export type { WindowTabAction } from "ui-framework/window";
export {
  WINDOW_FRAME_TAB_ACTION_PART_ID,
  WINDOW_FRAME_TAB_PART_ID,
  findWindowFrameTabActionAtPoint,
  findWindowFrameTabAtPoint,
  renderWindowFrameTabsetTabs
} from "ui-framework/window";
export type {
  RenderWindowFrameTabsetOptions,
  WindowFrameTabChromeMaps
} from "ui-framework/window";
export {
  WindowFrameSurfaceComponent,
  windowFrameSurfaceComponentType
} from "ui-framework/window";
export type {
  WindowFrameSurfaceComponentOptions,
  WindowFrameSurfaceHit,
  WindowFrameSurfaceHost
} from "ui-framework/window";
export type {
  WindowContentRegistrationPort,
  WindowRegisteredContent
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
export {
  createFloatingWindowComponentDefinition,
  floatingWindowComponentDefinition
} from "./floating-window-definition";
export type { FloatingWindowComponentDefinitionOptions } from "./floating-window-definition";
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
export { windowFrameSurfaceComponentDefinition } from "ui-framework/window";
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
  WINDOW_FULLSCREEN_PRESENTATION_LAYER,
  WINDOW_TOP_DOCKED_CHROME_LAYER,
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

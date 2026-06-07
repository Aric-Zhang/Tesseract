import {
  createDockTargetRegionSource,
  createWindowWorkspaceStackPriorityPort,
  createWindowWorkspaceViewCatalog,
  DefaultWindowFrameLifecycleController,
  floatingWindowComponentType,
  getPersistedViewDescriptorIdentity,
  getPersistedViewDescriptorRuntimeViewKey,
  hydrateWindowWorkspaceFrameLayout,
  loadPersistedWindowWorkspaceFrameLayout,
  WindowDockPreviewController,
  type WindowDockRect,
  type WindowFloatingFrameCreateOptions,
  type WindowFrameIntentSink,
  type WindowFramePort,
  WindowFramePortRegistry,
  WindowViewFactoryRegistry,
  type WindowViewKey,
  WindowWorkspaceController,
  WindowWorkspaceFrameLayoutPersistenceController,
  type WindowWorkspaceFrameLayoutStorage,
  WindowWorkspacePresentationController,
  WORKSPACE_ROOT_FRAME_ID,
  workspaceRootDockFrameComponentType,
  type FloatingWindowParameterPaths,
  type FloatingWindowState,
  type WindowFocusServiceProxy,
  uiVec2,
  type UiVec2
} from "../../window-runtime";
import { SceneParameterStore } from "../../scene-runtime";
import type { FeatureActorContext, RuntimeObject, RuntimeRegistration } from "../../runtime/ports";
import type { WindowWorkspaceViewCatalog } from "../../window-runtime";

export interface WindowWorkspaceFloatingFramePolicy {
  readonly preferredActorId: string;
  readonly preferredComponentId: string;
  readonly paths?: FloatingWindowParameterPaths;
  readonly fallbackState: FloatingWindowState;
  readonly minSize: UiVec2;
  readonly className: string;
  readonly contentClassName?: string;
  readonly priority: number;
  readonly menuOrder?: number;
}

export interface WindowWorkspaceDefaultOpenView {
  readonly viewKey: WindowViewKey;
  readonly preferredFrameId?: string;
}

export interface InstallWindowWorkspaceFeatureOptions {
  readonly context: FeatureActorContext;
  readonly sceneStore: SceneParameterStore;
  readonly floatingFrameParent: HTMLElement;
  readonly rootFrameParent: HTMLElement;
  readonly windowFocus: WindowFocusServiceProxy;
  readonly cancelActiveInput: () => void;
  readonly floatingFramePolicies: ReadonlyMap<WindowViewKey, WindowWorkspaceFloatingFramePolicy>;
  readonly defaultOpenViews: readonly WindowWorkspaceDefaultOpenView[];
  readonly layoutStorage: WindowWorkspaceFrameLayoutStorage | null;
  readonly registerRuntimeService: (object: RuntimeObject) => RuntimeRegistration;
}

export interface InstalledWindowWorkspaceFeature {
  readonly framePorts: WindowFramePortRegistry;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly frameIntents: WindowFrameIntentSink;
  readonly tabDragSink: WindowDockPreviewController;
  readonly lifecycle: DefaultWindowFrameLifecycleController;
  readonly catalog: WindowWorkspaceViewCatalog;
  readonly presentationController: WindowWorkspacePresentationController;
  restorePersistedLayout(): boolean;
  openDefaultViews(): void;
  dispose(): void;
}

export function installWindowWorkspaceFeature(
  options: InstallWindowWorkspaceFeatureOptions
): InstalledWindowWorkspaceFeature {
  const framePorts = new WindowFramePortRegistry();
  const dockTargetRegionSource = createDockTargetRegionSource({
    actorSystem: options.context.actorSystem,
    framePorts
  });
  const dockPreview = new WindowDockPreviewController({
    source: dockTargetRegionSource,
    parent: options.floatingFrameParent
  });
  const viewFactories = new WindowViewFactoryRegistry();
  let lifecycle: DefaultWindowFrameLifecycleController | null = null;
  const requireLifecycle = (): DefaultWindowFrameLifecycleController => {
    if (!lifecycle) {
      throw new Error("Window frame lifecycle controller is not initialized.");
    }
    return lifecycle;
  };
  const frameIntents: WindowFrameIntentSink = {
    requestOpenView(viewKey, reason) {
      requireLifecycle().openView(viewKey, reason);
    },
    requestOpenOrFocusViewType(typeKey, reason, openOptions) {
      requireLifecycle().openOrFocusViewType(typeKey, reason, openOptions);
    },
    requestCreateViewInstance(typeKey, reason, openOptions) {
      requireLifecycle().createViewInstance(typeKey, reason, openOptions);
    },
    requestFocusViewInstance(identity, reason) {
      requireLifecycle().focusViewInstance(identity, reason);
    },
    requestCloseFrame(frameId, reason) {
      requireLifecycle().closeFrame(frameId, reason);
    },
    requestCloseView(viewActorId, reason, closeOptions) {
      requireLifecycle().closeView(viewActorId, reason, closeOptions);
    },
    requestActivateFrameTab(frameId, viewActorId, reason) {
      requireLifecycle().activateFrameTab(frameId, viewActorId, reason);
    },
    requestCommitDock(intent) {
      requireLifecycle().commitDock(intent);
    }
  };
  const floatingFrameCounters = new Map<WindowViewKey, number>();
  const createFloatingFrameForView = (createOptions: WindowFloatingFrameCreateOptions): {
    frameActor: ReturnType<typeof options.context.actorSystem.createActor>;
    framePort: WindowFramePort;
  } => {
    const viewKey = createOptions.viewKey ?? createOptions.source?.viewKey;
    if (!viewKey) {
      throw new Error("Floating frame shell creation requires a view key.");
    }
    const title = createOptions.title ?? createOptions.tab?.title ?? viewKey;
    const frameOptions = getFloatingFrameOptions(
      options.sceneStore,
      options.floatingFramePolicies,
      viewKey,
      title,
      createOptions.bounds,
      createOptions.reason
    );
    const ids = allocateFloatingFrameIds(
      options.context.actorSystem,
      floatingFrameCounters,
      viewKey,
      frameOptions.preferredActorId,
      frameOptions.preferredComponentId
    );
    const actor = options.context.actorSystem.createActor({
      id: ids.actorId,
      name: `${title} Window`
    });
    try {
      const window = options.context.componentRegistry.addComponent(actor, floatingWindowComponentType, {
        id: ids.componentId,
        parent: options.floatingFrameParent,
        title,
        paths: createOptions.runtimeOnly || !frameOptions.paths ? undefined : frameOptions.paths,
        stateBinding: createOptions.runtimeOnly || !frameOptions.paths ? { kind: "runtime" } : undefined,
        initialState: frameOptions.initialState,
        minSize: frameOptions.minSize,
        className: frameOptions.className,
        contentClassName: frameOptions.contentClassName,
        priority: frameOptions.priority,
        activeViewActorId: createOptions.tab?.viewActorId,
        activeViewKey: createOptions.tab?.viewKey ?? viewKey,
        tabs: createOptions.tab ? [createOptions.tab] : [],
        frameIntentSink: frameIntents,
        tabDragSink: dockPreview,
        framePortRegistry: framePorts,
        windowMenu: createOptions.runtimeOnly
          ? { ...frameOptions.windowMenu, include: false }
          : frameOptions.windowMenu
      });
      return {
        frameActor: actor,
        framePort: window as WindowFramePort
      };
    } catch (error) {
      if (options.context.actorSystem.hasActor(actor)) {
        options.context.actorSystem.destroyActor(actor);
      }
      throw error;
    }
  };

  lifecycle = new DefaultWindowFrameLifecycleController({
    actorSystem: options.context.actorSystem,
    factories: viewFactories,
    windowFocus: options.windowFocus,
    cancelActiveInput: options.cancelActiveInput,
    createFloatingFrame: createFloatingFrameForView,
    framePorts
  });
  const workspaceRootFrameActor = options.context.actorSystem.createActor({
    id: WORKSPACE_ROOT_FRAME_ID,
    name: "Workspace Root"
  });
  options.context.componentRegistry.addComponent(workspaceRootFrameActor, workspaceRootDockFrameComponentType, {
    id: "workspace-root-dock-frame:root",
    parent: options.rootFrameParent,
    frameIntentSink: frameIntents,
    tabDragSink: dockPreview,
    framePortRegistry: framePorts
  });
  const catalog = createWindowWorkspaceViewCatalog({
    actorSystem: options.context.actorSystem,
    factories: viewFactories,
    locations: lifecycle,
    framePorts
  });
  const workspaceController = new WindowWorkspaceController({
    actorSystem: options.context.actorSystem,
    catalog,
    stackPriorityPort: createWindowWorkspaceStackPriorityPort(framePorts)
  });
  options.windowFocus.bind(workspaceController);
  options.registerRuntimeService(workspaceController);
  const presentationController = new WindowWorkspacePresentationController({
    framePorts,
    presentation: lifecycle
  });
  options.registerRuntimeService(presentationController);
  options.registerRuntimeService(new WindowWorkspaceFrameLayoutPersistenceController({
    source: lifecycle,
    storage: options.layoutStorage
  }));

  return {
    framePorts,
    viewFactories,
    frameIntents,
    tabDragSink: dockPreview,
    lifecycle,
    catalog,
    presentationController,
    restorePersistedLayout() {
      const persistedFrameLayout = loadPersistedWindowWorkspaceFrameLayout(options.layoutStorage);
      if (!persistedFrameLayout) return false;
      const restoreResult = lifecycle.restoreFrameLayout(
        createHydratableFrameLayout(persistedFrameLayout),
        "programmatic"
      );
      return restoreResult.restoredViewKeys.length > 0;
    },
    openDefaultViews() {
      for (const view of options.defaultOpenViews) {
        lifecycle.openView(view.viewKey, "programmatic", {
          preferredFrameId: view.preferredFrameId
        });
      }
    },
    dispose() {
      dockPreview.dispose();
    }
  };
}

interface FloatingFrameShellOptions {
  readonly preferredActorId: string;
  readonly preferredComponentId: string;
  readonly paths?: FloatingWindowParameterPaths;
  readonly initialState: FloatingWindowState;
  readonly minSize: UiVec2;
  readonly className: string;
  readonly contentClassName?: string;
  readonly priority: number;
  readonly windowMenu: {
    readonly include?: boolean;
    readonly viewKey: WindowViewKey;
    readonly label?: string;
    readonly order?: number;
    readonly activationMode?: "visible";
  };
}

function getFloatingFrameOptions(
  store: SceneParameterStore,
  policies: ReadonlyMap<WindowViewKey, WindowWorkspaceFloatingFramePolicy>,
  viewKey: WindowViewKey,
  title: string,
  bounds: WindowDockRect | undefined,
  reason: WindowFloatingFrameCreateOptions["reason"]
): FloatingFrameShellOptions {
  const policy = policies.get(viewKey);
  if (!policy) {
    throw new Error(`No floating frame shell is registered for view: ${viewKey}`);
  }
  const initialState = bounds
    ? createFloatingStateFromBounds(bounds, policy.minSize)
    : policy.paths
      ? readFloatingWindowState(store, policy.paths, {
          fallback: policy.fallbackState,
          forceVisible: reason === "menu"
        })
      : cloneFloatingWindowStateWithVisibility(policy.fallbackState, reason === "menu" ? true : undefined);
  return {
    preferredActorId: policy.preferredActorId,
    preferredComponentId: policy.preferredComponentId,
    paths: policy.paths,
    initialState,
    minSize: policy.minSize,
    className: policy.className,
    contentClassName: policy.contentClassName,
    priority: policy.priority,
    windowMenu: {
      include: true,
      viewKey,
      label: title,
      order: policy.menuOrder,
      activationMode: "visible"
    }
  };
}

function cloneFloatingWindowStateWithVisibility(
  state: FloatingWindowState,
  visibleOverride?: boolean
): FloatingWindowState {
  return {
    position: uiVec2(state.position.x, state.position.y),
    size: uiVec2(state.size.x, state.size.y),
    visible: visibleOverride ?? state.visible
  };
}

function createFloatingStateFromBounds(bounds: WindowDockRect, minSize: UiVec2): FloatingWindowState {
  return {
    position: uiVec2(Math.max(0, Math.round(bounds.left)), Math.max(0, Math.round(bounds.top))),
    size: uiVec2(
      Math.max(minSize.x, Math.round(bounds.width)),
      Math.max(minSize.y, Math.round(bounds.height))
    ),
    visible: true
  };
}

function allocateFloatingFrameIds(
  actorSystem: { getActor(id: string): unknown },
  counters: Map<WindowViewKey, number>,
  viewKey: WindowViewKey,
  preferredActorId: string,
  preferredComponentId: string
): { readonly actorId: string; readonly componentId: string } {
  if (!actorSystem.getActor(preferredActorId)) {
    return { actorId: preferredActorId, componentId: preferredComponentId };
  }
  let counter = counters.get(viewKey) ?? 1;
  while (true) {
    const actorId = `${preferredActorId}:floating-${counter}`;
    const componentId = `${preferredComponentId}:floating-${counter}`;
    counters.set(viewKey, counter + 1);
    counter += 1;
    if (!actorSystem.getActor(actorId)) {
      return { actorId, componentId };
    }
  }
}

function readFloatingWindowState(
  store: SceneParameterStore,
  paths: FloatingWindowParameterPaths,
  options: {
    readonly fallback: FloatingWindowState;
    readonly forceVisible?: boolean;
  }
): FloatingWindowState {
  const position = readVec2(store, paths.position, options.fallback.position);
  const size = readVec2(store, paths.size, options.fallback.size);
  const visible = options.forceVisible ? true : store.get<boolean>(paths.visible);
  return { position, size, visible };
}

function readVec2(
  store: SceneParameterStore,
  path: FloatingWindowParameterPaths["position"] | FloatingWindowParameterPaths["size"],
  fallback: UiVec2
): UiVec2 {
  const value = store.get<UiVec2>(path);
  return value ? uiVec2(value.x, value.y) : uiVec2(fallback.x, fallback.y);
}

function createHydratableFrameLayout(persisted: Parameters<typeof hydrateWindowWorkspaceFrameLayout>[0]) {
  return hydrateWindowWorkspaceFrameLayout(
    persisted,
    persisted.views.map((view) => ({
      viewKey: getPersistedViewDescriptorRuntimeViewKey(view),
      identity: getPersistedViewDescriptorIdentity(view),
      actorId: `persisted:${getPersistedViewDescriptorIdentity(view).instanceId}`,
      title: view.title,
      canDock: view.canDock
    }))
  );
}

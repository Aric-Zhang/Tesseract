import { GizmoEventSystem } from "gizmo-core";
import { installActorInputComponentDefinitions } from "actor-input";
import {
  ActorSystem,
  ComponentRegistry,
  installComponentDefinition,
  type Actor,
  type Component,
  type ComponentAttachmentDescriptor,
  type ComponentAttachmentRegistration,
  type ComponentAttachmentRuntime
} from "../actor-runtime";
import { installAppMenuFeature, installAppMenuComponentDefinitions } from "../features/app-menu";
import {
  ActiveInputCancellationRuntime,
  GizmoControllerAttachmentRuntime
} from "../gizmo-runtime";
import { installEditorStateObserverComponentDefinitions } from "editor";
import { createUiThemeModule, installUiComponentDefinitions } from "ui-framework";
import {
  createWindowFocusServiceProxy,
  createWindowWorkspaceContentId,
  DEFAULT_FLOATING_WINDOW_PRIORITY,
  installWindowComponentDefinitions,
  uiLayoutPath,
  uiVec2,
  windowViewInstanceId,
  windowViewKey,
  windowViewTypeKey,
  WORKSPACE_ROOT_FRAME_ID,
  type UiActorContext,
  type WindowFocusServiceProxy,
  type WindowViewFactory,
  type WindowViewKey,
  type WindowWorkspaceFrameLayoutStorage
} from "../window-runtime";
import {
  installWindowWorkspaceFeature,
  type InstalledWindowWorkspaceFeature,
  type WindowWorkspaceDefaultOpenView,
  type WindowWorkspaceFloatingFramePolicy
} from "../features/window-workspace";
import {
  genericFixtureViewComponentDefinition,
  genericFixtureViewComponentType
} from "./generic-fixture-view-component";
import {
  UiFixtureLayoutState,
  UiFixtureLayoutStorage,
  UiFixtureScheduler
} from "./fixture-state";

export interface UiFrameworkFixtureOptions {
  readonly parent?: HTMLElement;
  readonly autoOpen?: boolean;
  readonly autoTick?: boolean;
  readonly document?: Document;
  readonly layoutStorage?: WindowWorkspaceFrameLayoutStorage;
  readonly enableActorInput?: boolean;
}

export interface InstalledUiFrameworkFixture {
  readonly root: HTMLElement;
  readonly menuSlot: HTMLElement;
  readonly rootFrameSlot: HTMLElement;
  readonly floatingFrameParent: HTMLElement;
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly workspace: InstalledWindowWorkspaceFeature;
  readonly scheduler: UiFixtureScheduler;
  readonly layoutState: UiFixtureLayoutState;
  readonly layoutStorage: WindowWorkspaceFrameLayoutStorage;
  readonly windowFocus: WindowFocusServiceProxy;
  readonly cancelActiveInputCount: () => number;
  openDefaults(): void;
  tick(): void;
  dispose(): void;
}

const FIXTURE_WORKSPACE_MODE_PATH = uiLayoutPath<"develop" | "run">("uiFixture.workspace.mode");

const FIXTURE_VIEWS = [
  {
    viewKey: windowViewKey("fixture-panel:alpha"),
    typeKey: windowViewTypeKey("fixture-panel"),
    instanceId: windowViewInstanceId("fixture-panel:alpha"),
    title: "Panel Alpha",
    body: "A generic root panel.",
    defaultFrameId: WORKSPACE_ROOT_FRAME_ID
  },
  {
    viewKey: windowViewKey("fixture-panel:beta"),
    typeKey: windowViewTypeKey("fixture-panel"),
    instanceId: windowViewInstanceId("fixture-panel:beta"),
    title: "Panel Beta",
    body: "A second panel instance."
  },
  {
    viewKey: windowViewKey("fixture-log"),
    typeKey: windowViewTypeKey("fixture-log"),
    instanceId: windowViewInstanceId("fixture-log:main"),
    title: "Log Main",
    body: "A generic floating log."
  },
  {
    viewKey: windowViewKey("fixture-details"),
    typeKey: windowViewTypeKey("fixture-details"),
    instanceId: windowViewInstanceId("fixture-details:main"),
    title: "Details Main",
    body: "A generic details view."
  }
] as const;

export function installUiFrameworkFixture(
  options: UiFrameworkFixtureOptions = {}
): InstalledUiFrameworkFixture {
  const documentRef = options.document ?? document;
  const root = documentRef.createElement("div");
  root.className = "ui-framework-fixture";
  const menuSlot = documentRef.createElement("div");
  menuSlot.className = "ui-framework-fixture__menu";
  const rootFrameSlot = documentRef.createElement("div");
  rootFrameSlot.className = "ui-framework-fixture__root-frame";
  const floatingFrameParent = documentRef.createElement("div");
  floatingFrameParent.className = "ui-framework-fixture__floating-frames";
  root.append(menuSlot, rootFrameSlot, floatingFrameParent);
  (options.parent ?? documentRef.body).append(root);

  const actorSystem = new ActorSystem();
  const scheduler = new UiFixtureScheduler();
  const layoutState = new UiFixtureLayoutState({
    [FIXTURE_WORKSPACE_MODE_PATH]: "develop"
  });
  const layoutStorage = options.layoutStorage ?? new UiFixtureLayoutStorage();
  let cancelActiveInputCount = 0;
  const windowFocus = createWindowFocusServiceProxy();
  const actorInputRuntime = options.enableActorInput
    ? createFixtureActorInputRuntime({ windowFocus })
    : null;
  const componentRegistry = new ComponentRegistry({
    actorSystem,
    attachmentRuntime: actorInputRuntime?.attachmentRuntime
  });
  installActorInputComponentDefinitions(componentRegistry, {
    gizmoEventBinding: {
      actorInputStackPriority: windowFocus
    }
  });
  installEditorStateObserverComponentDefinitions(componentRegistry);
  installWindowComponentDefinitions(componentRegistry);
  installUiComponentDefinitions(componentRegistry);
  installAppMenuComponentDefinitions(componentRegistry);
  installComponentDefinition(componentRegistry, genericFixtureViewComponentDefinition);

  const context: UiActorContext = {
    actorSystem,
    componentRegistry,
    trackRegisteredActor() {
      return { dispose(): void {} };
    }
  };
  const workspace = installWindowWorkspaceFeature({
    context,
    layoutState,
    floatingFrameParent,
    rootFrameParent: rootFrameSlot,
    windowFocus,
    cancelActiveInput: () => {
      cancelActiveInputCount += 1;
      actorInputRuntime?.activeInput.cancelActiveActorInput();
    },
    floatingFramePolicies: createFixtureFloatingFramePolicies(),
    defaultOpenViews: createFixtureDefaultOpenViews(),
    layoutStorage,
    registerUiScheduledService: (service) => scheduler.register(service)
  });
  registerFixtureViewFactories(workspace.viewFactories, actorSystem, componentRegistry, documentRef);
  if (options.autoOpen ?? true) {
    workspace.openDefaultViews();
  }
  installAppMenuFeature({
    context,
    actorId: "ui-fixture-app-menu",
    actorName: "UI Fixture App Menu",
    hostElement: menuSlot,
    windowCatalog: workspace.catalog,
    windowFrameIntents: workspace.frameIntents,
    themeController: createFixtureThemeController(),
    workspaceModePath: FIXTURE_WORKSPACE_MODE_PATH
  });
  if (options.autoTick ?? true) {
    scheduler.tick();
  }

  return {
    root,
    menuSlot,
    rootFrameSlot,
    floatingFrameParent,
    actorSystem,
    componentRegistry,
    workspace,
    scheduler,
    layoutState,
    layoutStorage,
    windowFocus,
    cancelActiveInputCount: () => cancelActiveInputCount,
    openDefaults() {
      workspace.openDefaultViews();
      scheduler.tick();
    },
    tick() {
      scheduler.tick();
    },
    dispose() {
      workspace.dispose();
      actorInputRuntime?.dispose();
      scheduler.dispose();
      actorSystem.dispose();
      root.remove();
    }
  };
}

function createFixtureThemeController() {
  const themes = [
    { id: "default-dark", label: "Default Dark", diagnostics: [] },
    { id: "fixture-blue", label: "Fixture Blue", diagnostics: [] }
  ];
  let selectedThemeId = themes[0].id;
  return {
    listThemes: () => themes,
    getSelectedThemeId: () => selectedThemeId,
    getSelectedThemeDiagnostics: () => [],
    setTheme(themeId: string) {
      selectedThemeId = themes.some((theme) => theme.id === themeId)
        ? themeId
        : "default-dark";
      return createUiThemeModule({ id: selectedThemeId });
    }
  };
}

interface FixtureActorInputRuntime {
  readonly attachmentRuntime: ComponentAttachmentRuntime;
  readonly activeInput: ActiveInputCancellationRuntime;
  dispose(): void;
}

function createFixtureActorInputRuntime(options: {
  readonly windowFocus: WindowFocusServiceProxy;
}): FixtureActorInputRuntime {
  const activeInput = new ActiveInputCancellationRuntime();
  const gizmoEventSystem = new GizmoEventSystem({
    debug: true,
    debugConsole: true,
    onDebugLog: (entry) => {
      const capture = globalThis as typeof globalThis & {
        __uiFrameworkFixtureGizmoLog?: unknown[];
      };
      capture.__uiFrameworkFixtureGizmoLog?.push(entry);
    }
  });
  const attachmentRuntime = new FixtureCompositeComponentAttachmentRuntime([
    new GizmoControllerAttachmentRuntime({ registry: gizmoEventSystem }),
    activeInput
  ]);
  return {
    attachmentRuntime,
    activeInput,
    dispose() {
      attachmentRuntime.dispose?.();
      gizmoEventSystem.dispose();
      options.windowFocus.dispose();
    }
  };
}

class FixtureCompositeComponentAttachmentRuntime implements ComponentAttachmentRuntime {
  readonly #runtimes: readonly ComponentAttachmentRuntime[];

  constructor(runtimes: readonly ComponentAttachmentRuntime[]) {
    this.#runtimes = runtimes;
  }

  attach(
    actor: Actor,
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration {
    const registrations: ComponentAttachmentRegistration[] = [];
    for (const runtime of this.#runtimes) {
      registrations.push(runtime.attach(actor, component, attachments));
    }
    return {
      dispose: () => {
        for (let index = registrations.length - 1; index >= 0; index -= 1) {
          registrations[index].dispose();
        }
        registrations.length = 0;
      }
    };
  }

  dispose(): void {
    for (const runtime of this.#runtimes) {
      if ("dispose" in runtime && typeof runtime.dispose === "function") {
        runtime.dispose();
      }
    }
  }
}

function registerFixtureViewFactories(
  factories: InstalledWindowWorkspaceFeature["viewFactories"],
  actorSystem: ActorSystem,
  componentRegistry: ComponentRegistry,
  documentRef: Document
): void {
  for (const descriptor of FIXTURE_VIEWS) {
    const factory: WindowViewFactory = {
      viewKey: descriptor.viewKey,
      typeKey: descriptor.typeKey,
      instanceId: descriptor.instanceId,
      multiplicity: descriptor.typeKey === "fixture-panel" ? "multi-instance" : "singleton",
      label: descriptor.title,
      order: FIXTURE_VIEWS.indexOf(descriptor),
      createViewRuntime({ parentFrameActor, identity, contentRegistration }) {
        const viewActor = actorSystem.createActor({
          id: `ui-fixture-view:${identity.instanceId}`,
          name: `${descriptor.title} View`,
          parent: parentFrameActor
        });
        const component = componentRegistry.addComponent(viewActor, genericFixtureViewComponentType, {
          id: `${viewActor.id}:content`,
          title: descriptor.title,
          body: descriptor.body,
          contentId: createWindowWorkspaceContentId(identity),
          contentRegistration,
          document: documentRef
        });
        return {
          viewActor,
          content: component,
          title: descriptor.title,
          disposeViewRuntime() {
            if (actorSystem.hasActor(viewActor)) {
              actorSystem.destroyActor(viewActor);
            }
          }
        };
      }
    };
    factories.register(factory);
  }
}

function createFixtureFloatingFramePolicies(): ReadonlyMap<WindowViewKey, WindowWorkspaceFloatingFramePolicy> {
  return new Map(FIXTURE_VIEWS.map((view, index) => [
    view.viewKey,
    {
      preferredActorId: `ui-fixture-frame:${view.viewKey}`,
      preferredComponentId: `ui-fixture-frame:${view.viewKey}:window`,
      fallbackState: {
        position: uiVec2(48 + index * 24, 72 + index * 20),
        size: uiVec2(300, 210),
        visible: true
      },
      minSize: uiVec2(160, 120),
      className: "ui-fixture-floating-frame",
      contentClassName: "ui-fixture-floating-frame__content",
      priority: DEFAULT_FLOATING_WINDOW_PRIORITY + index,
      menuOrder: index
    }
  ]));
}

function createFixtureDefaultOpenViews(): readonly WindowWorkspaceDefaultOpenView[] {
  return [
    {
      viewKey: FIXTURE_VIEWS[0].viewKey,
      preferredFrameId: WORKSPACE_ROOT_FRAME_ID
    },
    {
      viewKey: FIXTURE_VIEWS[2].viewKey
    }
  ];
}

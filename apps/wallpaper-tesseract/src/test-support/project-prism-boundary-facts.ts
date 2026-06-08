import {
  definePathZone,
  type SourceZoneDefinition,
  type ZoneDependencyRule
} from "./architecture-boundaries";

export const projectPrismSourceZones = [
  definePathZone("actor-core-candidate", "Actor primitives that are UI-free, scene-free, update-scheduler-free, and window-focus-free.", [
    /^\.\/actor-runtime\//
  ]),
  definePathZone("actor-binding-debt", "App-local attachment/runtime placement that still blocks actor-input and state/runtime extraction.", [
    /^\.\/update-runtime\//,
    /^\.\/state-runtime\//
  ], { debt: true }),
  definePathZone("actor-input-candidate", "Actor input and gizmo-core adapter candidates.", [
    /^\.\/gizmo-runtime\/index\.ts$/
  ]),
  definePathZone("ui-framework-candidate", "Generic window, tab, dock, menu, and app shell UI candidates.", [
    /^\.\/window-runtime\//,
    /^\.\/features\/app-menu\//,
    /^\.\/features\/window-workspace\//,
    /^\.\/app\/app-shell\.ts$/
  ]),
  definePathZone("ui-state-binding-debt", "Generic UI candidates still coupled to scene-runtime state/path/vector types.", [
    /^\.\/window-runtime\//,
    /^\.\/features\/app-menu\/app-menu-bar-component\.ts$/,
    /^\.\/features\/window-workspace\/install-window-workspace-feature\.ts$/
  ], { debt: true }),
  definePathZone("dock-surface-truth-debt", "Dock/tab surface state still has frame-level active-tab and strict content-host invariants to resolve before UI framework extraction.", [
    /^\.\/window-runtime\/window-dock-surface-model\.ts$/,
    /^\.\/window-runtime\/window-frame-port\.ts$/,
    /^\.\/window-runtime\/window-frame-surface-component\.ts$/,
    /^\.\/window-runtime\/window-frame-lifecycle-controller\.ts$/,
    /^\.\/window-runtime\/floating-window-component\.ts$/,
    /^\.\/window-runtime\/workspace-root-dock-frame-component\.ts$/
  ], { debt: true }),
  definePathZone("editor-candidate", "Concrete editor features and editor presentation components.", [
    /^\.\/debug\//,
    /^\.\/hierarchy\//,
    /^\.\/features\/inspector\//,
    /^\.\/features\/tool-windows\//,
    /^\.\/features\/scene\//,
    /^\.\/features\/camera3\/components\//,
    /^\.\/gizmos\//
  ]),
  definePathZone("app-composition", "Wallpaper app bootstrap and composition layer.", [
    /^\.\/app\/(?!app-shell\.ts$)[^/]+\.ts$/,
    /^\.\/demo\.ts$/
  ]),
  definePathZone("app-composition-debt", "Wallpaper app composition still knows concrete editor/runtime policy details.", [
    /^\.\/app\/create-wallpaper-app\.ts$/,
    /^\.\/app\/install-component-definitions\.ts$/,
    /^\.\/app\/workspace-mode\.ts$/
  ], { debt: true }),
  definePathZone("component-definition-installer-debt", "App-local component definition helper placement that still blocks package-owned installers.", [
    /^\.\/component-definitions\.ts$/,
    /^\.\/gizmo-runtime\/install-component-definitions\.ts$/
  ], { debt: true }),
  definePathZone("app-runtime-debt", "Transitional app runtime context and registration ports.", [
    /^\.\/app-runtime\//,
    /^\.\/runtime\/ports\//
  ], { debt: true }),
  definePathZone("state-domain-debt", "Mixed scene/editor/ui state runtime that must split before runtime extraction.", [
    /^\.\/scene-runtime\//
  ], { debt: true }),
  definePathZone("runtime-ownership-debt", "Runtime-like world/camera/object code still owned by editor/app folders.", [
    /^\.\/camera3-control\//,
    /^\.\/features\/camera3\/model\//,
    /^\.\/features\/camera3\/components\/(?:camera3-motion-component|camera3-rig-component|scene-camera3-viewport-binding-component)\.ts$/,
    /^\.\/features\/scene\/(?:install-scene-view-feature|scene-view-content-installer|renderable-scene-view|scene-window-actor-factory)\.ts$/,
    /^\.\/features\/scene\/components\/scene-viewport-component\.ts$/,
    /^\.\/tesseract4\//
  ], { debt: true })
] as const satisfies readonly SourceZoneDefinition[];

export interface ProjectPrismDebtBlocker {
  readonly zoneId: string;
  readonly blocks: readonly string[];
  readonly blocker: string;
  readonly deletionCondition: string;
}

export interface ProjectPrismPackageTarget {
  readonly id: "actor-core" | "actor-input" | "ui-framework" | "runtime-core" | "runtime-three" | "editor" | "wallpaper-app";
  readonly cleanCandidateZones: readonly string[];
  readonly debtZones: readonly string[];
  readonly blockedBy: readonly string[];
  readonly extractionPhase: string;
  readonly extractionStatus: "allowed" | "blocked" | "deferred";
}

export const projectPrismDebtBlockers = [
  {
    zoneId: "actor-binding-debt",
    blocks: ["state/runtime bridge split"],
    blocker: "Actor-core and actor-input no longer own app-local update scheduling or focus services. Remaining binding debt is package placement for update-runtime and staged state observer binding ownership.",
    deletionCondition: "Update runtime and state observer binding are expressed through package-owned ports outside app-local glue."
  },
  {
    zoneId: "ui-state-binding-debt",
    blocks: ["ui-framework extraction"],
    blocker: "Generic UI files still import scene-runtime state, vector, runtime object, or workspace mode facts.",
    deletionCondition: "UI receives state/path/vector/update services through UI-owned ports or a ui-layout-state package."
  },
  {
    zoneId: "dock-surface-truth-debt",
    blocks: ["ui-framework extraction"],
    blocker: "Dock surface display and commit state still mix frame-level active assumptions, permissive content fallback, and cross-frame-only dock semantics; root/floating tabs cannot reliably split or reorder within their owning frame.",
    deletionCondition: "Dock tree tabset active ids are the only selected/visible content truth; frame-level focus is MRU-only; known view content never mounts to whole-frame primary content in split mode; same-frame tab split/reorder is explicit and tested for root/floating frames."
  },
  {
    zoneId: "app-composition-debt",
    blocks: ["app bootstrap thinning", "package extraction handoff"],
    blocker: "App composition still wires concrete scene/debug/hierarchy/inspector policy and workspace mode presentation behavior.",
    deletionCondition: "App composition imports public runtime/editor/UI installers and bootstrap ports only."
  },
  {
    zoneId: "component-definition-installer-debt",
    blocks: ["ui-framework extraction", "wallpaper app thinning"],
    blocker: "The broad pseudo-core installer has been deleted, but the idempotent installComponentDefinition helper and app-local gizmo runtime installer still live in app-local source.",
    deletionCondition: "The generic helper moves to the package that owns component registration, or app-local package installers stop depending on shared helper code."
  },
  {
    zoneId: "app-runtime-debt",
    blocks: ["app runtime deletion", "package-owned port extraction"],
    blocker: "AppRuntimeContext and runtime/ports are transitional glue that still define feature actor and registry contracts.",
    deletionCondition: "Reusable ports move to the package that owns the contract; wallpaper app becomes thin composition."
  },
  {
    zoneId: "state-domain-debt",
    blocks: ["runtime-core extraction", "ui-framework extraction", "state/scheduler split"],
    blocker: "scene-runtime mixes runtime state, editor state, UI layout state, scheduler, and observer facts.",
    deletionCondition: "runtime-state, editor-state, and ui-layout-state become separate facts with explicit adapters."
  },
  {
    zoneId: "runtime-ownership-debt",
    blocks: ["runtime-core extraction", "runtime-three extraction"],
    blocker: "Tesseract, Camera3, Scene render host, and Three/WebGL ownership are still partly app/editor feature owned.",
    deletionCondition: "Runtime worlds/cameras/projections expose command/query/frame-source ports consumed by editor Scene views."
  }
] as const satisfies readonly ProjectPrismDebtBlocker[];

export interface ProjectPrismRuntimeExtractionBlocker {
  readonly id: string;
  readonly files: readonly string[];
  readonly blocks: readonly string[];
  readonly requiredPort: string;
  readonly blocker: string;
  readonly deletionCondition: string;
}

export const projectPrismRuntimeExtractionBlockers = [
  {
    id: "camera3-three-model",
    files: [
      "./features/camera3/model/camera3-rig.ts",
      "./features/camera3/model/camera3-projection-mode.ts"
    ],
    blocks: ["runtime-core extraction", "runtime-three extraction"],
    requiredPort: "RuntimeCameraActor + RuntimeThreeCameraBackend",
    blocker: "Camera3 model directly owns Three camera/vector objects instead of a runtime camera port plus renderer backend.",
    deletionCondition: "Camera model exposes renderer-agnostic camera state; Three camera realization moves to runtime-three backend."
  },
  {
    id: "camera3-motion-scene-scheduler",
    files: [
      "./camera3-control/camera3-motion-controller.ts",
      "./features/camera3/components/camera3-motion-component.ts"
    ],
    blocks: ["runtime-core extraction", "state/scheduler split"],
    requiredPort: "RuntimeFrameSource + RuntimeCommandSink",
    blocker: "Camera3 motion implements app-local RuntimeObject and is still scheduled by the app scene runtime.",
    deletionCondition: "Camera motion consumes package-owned runtime frame and command ports, not app scene runtime services."
  },
  {
    id: "scene-view-render-host",
    files: [
      "./features/scene/install-scene-view-feature.ts",
      "./features/scene/scene-view-content-installer.ts",
      "./features/scene/renderable-scene-view.ts",
      "./features/scene/scene-window-actor-factory.ts",
      "./features/scene/components/scene-viewport-component.ts"
    ],
    blocks: ["runtime-core extraction", "ui-framework extraction", "editor/runtime split"],
    requiredPort: "FrameSourceRegistry + EditorSceneViewHost",
    blocker: "Scene View still binds runtime render output, editor window lifecycle, DOM host, and current renderable projection.",
    deletionCondition: "Runtime exposes frame sources; editor Scene View consumes them through an editor host without owning runtime resources."
  },
  {
    id: "tesseract4-runtime-object",
    files: [
      "./tesseract4/tesseract4-runtime-object.ts",
      "./tesseract4/components/tesseract4-component.ts",
      "./tesseract4/components/tesseract4-actor-factory.ts"
    ],
    blocks: ["runtime-core extraction", "runtime-three extraction"],
    requiredPort: "RuntimeWorldActor + RuntimeThreeRenderable",
    blocker: "Tesseract4 runtime object owns 4D world update, Three line adapter, app-local UpdateFrame scheduling, and actor component creation path together.",
    deletionCondition: "4D world/projection update is runtime-core; Three renderable adapter is runtime-three; actor/editor binding is an adapter."
  }
] as const satisfies readonly ProjectPrismRuntimeExtractionBlocker[];

export interface ProjectPrismUiFrameworkExtractionBlocker {
  readonly id: string;
  readonly files: readonly string[];
  readonly blocks: readonly string[];
  readonly requiredPort: string;
  readonly blocker: string;
  readonly deletionCondition: string;
}

export const projectPrismUiFrameworkExtractionBlockers = [
  {
    id: "dock-surface-truth-model",
    files: [
      "./window-runtime/window-dock-surface-model.ts",
      "./window-runtime/window-frame-port.ts",
      "./window-runtime/window-frame-surface-component.ts",
      "./window-runtime/window-frame-lifecycle-controller.ts",
      "./window-runtime/floating-window-component.ts",
      "./window-runtime/workspace-root-dock-frame-component.ts"
    ],
    blocks: ["ui-framework extraction"],
    requiredPort: "per-tabset dock surface truth model + same-frame dock operations + shared tab interaction state machine",
    blocker: "Root/floating split tab behavior still depends on single frame active-tab assumptions, permissive content fallback, and cross-frame-only dock commit semantics that reject root/floating same-frame edge splits.",
    deletionCondition: "Per-tabset active ids drive rendering/content visibility, frame-level active is MRU-only, root/floating same-frame split/reorder is supported, and root/floating tab click/close/drag/cancel/commit share one actor-input state machine."
  },
  {
    id: "floating-window-scene-state-paths",
    files: [
      "./window-runtime/floating-window-state.ts",
      "./window-runtime/floating-window-component.ts",
      "./window-runtime/window-frame-lifecycle.ts",
      "./window-runtime/window-frame-port.ts"
    ],
    blocks: ["ui-framework extraction"],
    requiredPort: "ui-layout-state path/value port",
    blocker: "Generic window state now uses UI-owned geometry, layout paths, and command sinks, but its persistent backing still goes through a scene-runtime state-store adapter.",
    deletionCondition: "Window persistence and observation depend on UI-owned layout state storage/observer contracts, not scene-runtime adapters."
  },
  {
    id: "workspace-runtime-service-registration",
    files: [
      "./window-runtime/window-workspace-controller.ts",
      "./window-runtime/window-workspace-layout-persistence-controller.ts",
      "./window-runtime/window-workspace-presentation-controller.ts",
      "./features/window-workspace/install-window-workspace-feature.ts"
    ],
    blocks: ["ui-framework extraction", "state/scheduler split"],
    requiredPort: "ui-scheduler-port + workspace layout persistence port",
    blocker: "Workspace controllers are still registered as app scene runtime RuntimeObject services.",
    deletionCondition: "Workspace UI services use package-owned scheduling and persistence ports."
  }
] as const satisfies readonly ProjectPrismUiFrameworkExtractionBlocker[];

export interface ProjectPrismAppCompositionBlocker {
  readonly id: string;
  readonly files: readonly string[];
  readonly blocks: readonly string[];
  readonly blocker: string;
  readonly deletionCondition: string;
}

export const projectPrismAppCompositionBlockers = [
  {
    id: "wallpaper-app-concrete-feature-policy",
    files: [
      "./app/create-wallpaper-app.ts"
    ],
    blocks: ["app bootstrap thinning", "formal package extraction"],
    blocker: "App composition still wires Scene/Debug/Hierarchy/Inspector state, actor ids, default views, floating policies, hierarchy metadata, and debug log sink policy.",
    deletionCondition: "App composition imports runtime/editor/UI installers and connects only bootstrap ports, stores, shell, and render loop."
  },
  {
    id: "central-component-definition-installer",
    files: [
      "./app/install-component-definitions.ts",
      "./component-definitions.ts"
    ],
    blocks: ["actor-core extraction", "ui-framework extraction"],
    blocker: "Component definition installation is still centralized at the app level.",
    deletionCondition: "Each package owns and exports its component definition installer."
  },
  {
    id: "workspace-mode-app-controller",
    files: [
      "./app/workspace-mode.ts"
    ],
    blocks: ["ui-framework extraction", "editor-state split"],
    blocker: "Workspace mode presentation controller lives in app composition and coordinates editor/window presentation state.",
    deletionCondition: "Workspace mode becomes editor/UI state coordination behind explicit ports."
  }
] as const satisfies readonly ProjectPrismAppCompositionBlocker[];

export const projectPrismZoneDependencyRules = [
  {
    sourceZone: "actor-core-candidate",
    forbiddenTargetZones: [
      "actor-input-candidate",
      "ui-framework-candidate",
      "editor-candidate",
      "runtime-ownership-debt",
      "state-domain-debt",
      "app-composition",
      "app-runtime-debt"
    ]
  },
  {
    sourceZone: "actor-input-candidate",
    forbiddenTargetZones: [
      "ui-framework-candidate",
      "editor-candidate",
      "runtime-ownership-debt",
      "app-composition"
    ]
  },
  {
    sourceZone: "ui-framework-candidate",
    forbiddenTargetZones: [
      "editor-candidate",
      "runtime-ownership-debt",
      "app-composition"
    ]
  },
  {
    sourceZone: "runtime-core-candidate",
    forbiddenTargetZones: [
      "actor-input-candidate",
      "ui-framework-candidate",
      "editor-candidate",
      "runtime-ownership-debt",
      "app-composition",
      "app-runtime-debt"
    ]
  },
  {
    sourceZone: "runtime-three-candidate",
    forbiddenTargetZones: [
      "ui-framework-candidate",
      "editor-candidate",
      "app-composition",
      "app-runtime-debt"
    ]
  },
  {
    sourceZone: "editor-candidate",
    forbiddenTargetZones: [
      "app-composition"
    ]
  }
] as const satisfies readonly ZoneDependencyRule[];

export const projectPrismPackageTargets = [
  {
    id: "actor-core",
    cleanCandidateZones: ["actor-core-candidate"],
    debtZones: [],
    blockedBy: [],
    extractionPhase: "Phase 2",
    extractionStatus: "allowed"
  },
  {
    id: "actor-input",
    cleanCandidateZones: ["actor-input-candidate"],
    debtZones: [],
    blockedBy: [],
    extractionPhase: "Phase 2",
    extractionStatus: "allowed"
  },
  {
    id: "ui-framework",
    cleanCandidateZones: ["ui-framework-candidate"],
    debtZones: ["ui-state-binding-debt", "dock-surface-truth-debt", "component-definition-installer-debt"],
    blockedBy: ["ui-state-binding-debt", "dock-surface-truth-debt", "component-definition-installer-debt"],
    extractionPhase: "Phase 3",
    extractionStatus: "blocked"
  },
  {
    id: "runtime-core",
    cleanCandidateZones: [],
    debtZones: ["state-domain-debt", "runtime-ownership-debt"],
    blockedBy: ["state-domain-debt", "runtime-ownership-debt"],
    extractionPhase: "Phase 4",
    extractionStatus: "blocked"
  },
  {
    id: "runtime-three",
    cleanCandidateZones: [],
    debtZones: ["runtime-ownership-debt"],
    blockedBy: ["runtime-ownership-debt"],
    extractionPhase: "Phase 5",
    extractionStatus: "blocked"
  },
  {
    id: "editor",
    cleanCandidateZones: ["editor-candidate"],
    debtZones: ["runtime-ownership-debt", "ui-state-binding-debt"],
    blockedBy: ["runtime-ownership-debt", "ui-state-binding-debt"],
    extractionPhase: "Phase 6",
    extractionStatus: "deferred"
  },
  {
    id: "wallpaper-app",
    cleanCandidateZones: ["app-composition"],
    debtZones: ["app-composition-debt", "app-runtime-debt", "component-definition-installer-debt"],
    blockedBy: ["app-composition-debt", "app-runtime-debt", "component-definition-installer-debt"],
    extractionPhase: "Phase 7",
    extractionStatus: "blocked"
  }
] as const satisfies readonly ProjectPrismPackageTarget[];

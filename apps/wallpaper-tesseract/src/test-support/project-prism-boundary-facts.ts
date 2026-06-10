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
    /^\.\/gizmo-runtime\/install-component-definitions\.ts$/,
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
    /^\.\/app\/app-shell\.ts$/,
    /^\.\/ui-framework-fixture\//
  ]),
  definePathZone("runtime-core-candidate", "Renderer-agnostic runtime world, camera, projection, frame, scheduler, and command contracts.", [
    /^packages\/runtime-core\/src\//
  ]),
  definePathZone("runtime-three-candidate", "Three/WebGL runtime backend candidates that realize runtime contracts without importing editor or UI code.", [
    /^packages\/runtime-three\/src\//
  ]),
  definePathZone("runtime-production-candidate", "App-local production runtime ownership staging that may depend on runtime packages but not editor/UI/app composition.", [
    /^\.\/runtime\/(?!ports\/)/
  ]),
  definePathZone("editor-candidate", "Concrete editor features and editor presentation components.", [
    /^\.\/debug\//,
    /^\.\/editor\//,
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
    /^\.\/app\/adapters\//,
    /^\.\/app\/create-wallpaper-app\.ts$/,
    /^\.\/app\/install-component-definitions\.ts$/,
    /^\.\/app\/workspace-mode\.ts$/
  ], { debt: true }),
  definePathZone("app-runtime-debt", "Transitional app runtime context and registration ports.", [
    /^\.\/app-runtime\//,
    /^\.\/runtime\/ports\//
  ], { debt: true }),
  definePathZone("state-domain-debt", "Remaining scene-runtime compatibility scheduler/value surface after state-domain split.", [
    /^\.\/scene-runtime\//
  ], { debt: true }),
  definePathZone("runtime-ownership-debt", "Runtime-like world/camera/object code still owned by editor/app folders.", [
    /^\.\/app\/create-wallpaper-app\.ts$/,
    /^\.\/camera3-control\//,
    /^\.\/features\/camera3\/model\//,
    /^\.\/features\/camera3\/components\/(?:camera3-motion-component|camera3-rig-component|scene-camera3-viewport-binding-component)\.ts$/,
    /^\.\/features\/scene\/(?:install-scene-view-feature|scene-view-content-installer|renderable-scene-view|scene-window-actor-factory)\.ts$/,
    /^\.\/features\/scene\/components\/scene-viewport-component\.ts$/,
    /^\.\/scene-runtime\/scene-runtime\.ts$/,
    /^\.\/update-runtime\/frame-update-attachment-runtime\.ts$/,
    /^\.\/tesseract4\//
  ], { debt: true }),
  definePathZone("runtime-adapter-debt", "Phase 4D app-local adapters from current editor/runtime facts into runtime-core contracts.", [
    /^\.\/runtime-adapter\//
  ], { debt: true })
] as const satisfies readonly SourceZoneDefinition[];

export interface ProjectPrismDebtBlocker {
  readonly zoneId: string;
  readonly blocks: readonly string[];
  readonly blocker: string;
  readonly deletionCondition: string;
}

export interface ProjectPrismPackageTarget {
  readonly id:
    | "actor-core"
    | "actor-input"
    | "ui-framework"
    | "runtime-core-contracts"
    | "runtime-production-ownership"
    | "runtime-three-backend"
    | "runtime-render-production-ownership"
    | "editor"
    | "wallpaper-app";
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
    zoneId: "app-composition-debt",
    blocks: ["app bootstrap thinning", "package extraction handoff"],
    blocker: "App composition still wires concrete scene/debug/hierarchy/inspector policy and workspace mode presentation behavior.",
    deletionCondition: "App composition imports public runtime/editor/UI installers and bootstrap ports only."
  },
  {
    zoneId: "app-runtime-debt",
    blocks: ["app runtime deletion", "package-owned port extraction"],
    blocker: "AppRuntimeContext and runtime/ports are transitional glue that still define feature actor and registry contracts.",
    deletionCondition: "Reusable ports move to the package that owns the contract; wallpaper app becomes thin composition."
  },
  {
    zoneId: "state-domain-debt",
    blocks: ["scene-runtime compatibility deletion", "scheduler lane split"],
    blocker: "scene-runtime no longer owns editor/UI state, but still exposes compatibility scheduler and value helper surfaces.",
    deletionCondition: "SceneRuntime, scene-frame aliases, runtime-object aliases, and scene vec2 helpers are deleted or moved to their owning packages."
  },
  {
    zoneId: "runtime-ownership-debt",
    blocks: ["runtime-core extraction", "runtime-three extraction"],
    blocker: "Tesseract, Camera3, Scene render host, and Three/WebGL ownership are still partly app/editor feature owned.",
    deletionCondition: "Runtime worlds/cameras/projections expose command/query/frame-source ports consumed by editor Scene views."
  },
  {
    zoneId: "runtime-adapter-debt",
    blocks: ["runtime production ownership migration"],
    blocker: "Phase 4D adapters translate old app-local runtime facts into runtime-core contracts; they are not production owners.",
    deletionCondition: "Camera, world, projection, and frame-source owners are native runtime packages and no app-local adapter is needed."
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
    id: "frame-update-lane-split",
    files: [
      "./scene-runtime/scene-runtime.ts",
      "./update-runtime/frame-update-attachment-runtime.ts",
      "./app/create-wallpaper-app.ts"
    ],
    blocks: ["runtime production ownership", "state/scheduler split"],
    requiredPort: "RuntimeScheduler + UiComponentTickScheduler + EditorStateFlushScheduler",
    blocker: "SceneRuntime currently dispatches runtime work, UI component ticks, and editor state flush through one app-local frame update lane.",
    deletionCondition: "Runtime work, UI/component tick, and editor state flush have separate owners and no generic app-local RuntimeObject bus remains."
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

export const projectPrismUiFrameworkExtractionBlockers: readonly ProjectPrismUiFrameworkExtractionBlocker[] = [];

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
      "./app/install-component-definitions.ts"
    ],
    blocks: ["app bootstrap thinning", "editor/runtime package extraction"],
    blocker: "App-local component definition installation still wires product feature adapters and editor/runtime integration components.",
    deletionCondition: "Product features own their package installers and wallpaper app composes package-level installer functions only."
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
    sourceZone: "runtime-production-candidate",
    forbiddenTargetZones: [
      "actor-input-candidate",
      "ui-framework-candidate",
      "editor-candidate",
      "app-composition",
      "app-composition-debt",
      "app-runtime-debt",
      "actor-binding-debt",
      "state-domain-debt",
      "runtime-adapter-debt"
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
    debtZones: [],
    blockedBy: [],
    extractionPhase: "Phase 3B/3C",
    extractionStatus: "allowed"
  },
  {
    id: "runtime-core-contracts",
    cleanCandidateZones: ["runtime-core-candidate"],
    debtZones: [],
    blockedBy: [],
    extractionPhase: "Phase 4",
    extractionStatus: "allowed"
  },
  {
    id: "runtime-production-ownership",
    cleanCandidateZones: [],
    debtZones: ["runtime-ownership-debt", "runtime-adapter-debt"],
    blockedBy: ["runtime-ownership-debt", "runtime-adapter-debt"],
    extractionPhase: "Phase 5",
    extractionStatus: "blocked"
  },
  {
    id: "runtime-three-backend",
    cleanCandidateZones: ["runtime-three-candidate"],
    debtZones: [],
    blockedBy: [],
    extractionPhase: "Phase 5A",
    extractionStatus: "allowed"
  },
  {
    id: "runtime-render-production-ownership",
    cleanCandidateZones: [],
    debtZones: ["runtime-ownership-debt"],
    blockedBy: ["runtime-ownership-debt"],
    extractionPhase: "Phase 5",
    extractionStatus: "blocked"
  },
  {
    id: "editor",
    cleanCandidateZones: ["editor-candidate"],
    debtZones: ["runtime-ownership-debt"],
    blockedBy: ["runtime-ownership-debt"],
    extractionPhase: "Phase 6",
    extractionStatus: "deferred"
  },
  {
    id: "wallpaper-app",
    cleanCandidateZones: ["app-composition"],
    debtZones: ["app-composition-debt", "app-runtime-debt"],
    blockedBy: ["app-composition-debt", "app-runtime-debt"],
    extractionPhase: "Phase 7",
    extractionStatus: "blocked"
  }
] as const satisfies readonly ProjectPrismPackageTarget[];

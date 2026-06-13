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
    /^\.\/gizmo-runtime\/install-component-definitions\.ts$/
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
    /^packages\/editor\/src\//,
    /^\.\/features\/scene\/components\//
  ]),
  definePathZone("app-composition", "Wallpaper app bootstrap and composition layer.", [
    /^\.\/app\/(?!app-shell\.ts$)[^/]+\.ts$/,
    /^\.\/demo\.ts$/
  ]),
  definePathZone("app-composition-debt", "Wallpaper app composition still knows concrete editor/runtime policy details.", [
    /^\.\/features\/install-wallpaper-component-definitions\.ts$/,
    /^\.\/features\/workspace-mode\.ts$/,
    /^\.\/features\/install-wallpaper-product-features\.ts$/,
    /^\.\/gizmo-runtime\/install-component-definitions\.ts$/
  ], { debt: true }),
  definePathZone("runtime-ownership-debt", "Runtime-like world/camera/object code still owned by editor/app folders.", [
    /^\.\/features\/scene\/(?:index|install-scene-view-feature|renderable-scene-view)\.ts$/
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
    blocker: "Actor-core and actor-input no longer own app-local update scheduling or focus services. Remaining binding debt is package placement for runtime-work attachment ownership.",
    deletionCondition: "Runtime-work attachment is expressed through a package-owned port outside app-local glue."
  },
  {
    zoneId: "app-composition-debt",
    blocks: ["app bootstrap thinning", "package extraction handoff"],
    blocker: "App composition still wires concrete scene/debug/hierarchy/inspector policy and workspace mode presentation behavior.",
    deletionCondition: "App composition imports public runtime/editor/UI installers and bootstrap ports only."
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

export const projectPrismRuntimeExtractionBlockers: readonly ProjectPrismRuntimeExtractionBlocker[] = [
  {
    id: "scene-runtime-composition-feature-installer",
    files: [
      "./features/scene/install-scene-view-feature.ts",
      "./features/scene/renderable-scene-view.ts"
    ],
    blocks: ["runtime scene package placement", "multi-scene runtime composition"],
    requiredPort: "A runtime-owned Scene session/content installer consumed through narrow editor presentation ports.",
    blocker: "Scene feature installation still assembles editor Scene actor creation, runtime Scene session/content, Camera3 gizmo creation, and renderable frame-source bridging in one feature-level composition point.",
    deletionCondition: "Scene runtime session/content and renderable frame-source registration are owned by runtime packages or a narrower runtime owner; Scene feature code only connects editor presentation ports."
  }
];

export interface ProjectPrismUiFrameworkExtractionBlocker {
  readonly id: string;
  readonly files: readonly string[];
  readonly blocks: readonly string[];
  readonly requiredPort: string;
  readonly blocker: string;
  readonly deletionCondition: string;
}

export const projectPrismUiFrameworkExtractionBlockers: readonly ProjectPrismUiFrameworkExtractionBlocker[] = [];
export const projectPrismPrePhase6UiFrameworkBlockers: readonly ProjectPrismUiFrameworkExtractionBlocker[] = [];

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
      "./features/install-wallpaper-product-features.ts"
    ],
    blocks: ["product feature policy split", "formal package extraction"],
    blocker: "Wallpaper product feature composition still centralizes Scene/Debug/Hierarchy/Inspector actor ids, hierarchy metadata, default views, floating policies, app menu wiring, and workspace mode installation.",
    deletionCondition: "Product feature policy is split into owner-owned installers or deleted when existing runtime/editor/UI owners can express the behavior directly."
  },
  {
    id: "central-component-definition-installer",
    files: [
      "./features/install-wallpaper-component-definitions.ts"
    ],
    blocks: ["app bootstrap thinning", "editor/runtime package extraction"],
    blocker: "App-local component definition installation still wires product feature adapters and editor/runtime integration components.",
    deletionCondition: "Product features own their package installers and wallpaper app composes package-level installer functions only."
  },
  {
    id: "workspace-mode-app-controller",
    files: [
      "./features/workspace-mode.ts"
    ],
    blocks: ["ui-framework extraction", "editor-state split"],
    blocker: "Workspace mode presentation controller lives in app composition and coordinates editor/window presentation state.",
    deletionCondition: "Workspace mode becomes editor/UI state coordination behind explicit ports."
  },
  {
    id: "gizmo-runtime-definition-installer",
    files: [
      "./gizmo-runtime/install-component-definitions.ts"
    ],
    blocks: ["actor-input package cleanup", "product component definition split"],
    blocker: "Actor/gizmo binding definition installation remains app-local instead of being owned by actor-input or a narrow product binding owner.",
    deletionCondition: "Gizmo runtime binding definitions are installed through a package-owned or feature-owned installer without a central app-local definition aggregator."
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
      "app-composition"
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
      "app-composition"
    ]
  },
  {
    sourceZone: "runtime-three-candidate",
    forbiddenTargetZones: [
      "ui-framework-candidate",
      "editor-candidate",
      "app-composition"
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
      "actor-binding-debt",
      "runtime-ownership-debt"
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
    cleanCandidateZones: ["runtime-production-candidate"],
    debtZones: [],
    blockedBy: [],
    extractionPhase: "Phase 5.5",
    extractionStatus: "allowed"
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
    cleanCandidateZones: ["runtime-production-candidate", "runtime-three-candidate"],
    debtZones: [],
    blockedBy: [],
    extractionPhase: "Phase 5.5",
    extractionStatus: "allowed"
  },
  {
    id: "editor",
    cleanCandidateZones: ["editor-candidate"],
    debtZones: [],
    blockedBy: [],
    extractionPhase: "Phase 6",
    extractionStatus: "allowed"
  },
  {
    id: "wallpaper-app",
    cleanCandidateZones: ["app-composition"],
    debtZones: ["app-composition-debt"],
    blockedBy: ["app-composition-debt"],
    extractionPhase: "Phase 8",
    extractionStatus: "blocked"
  }
] as const satisfies readonly ProjectPrismPackageTarget[];

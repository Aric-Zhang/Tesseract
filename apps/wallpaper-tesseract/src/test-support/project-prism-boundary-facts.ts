import {
  definePathZone,
  type SourceZoneDefinition,
  type ZoneDependencyRule
} from "./architecture-boundaries";

export const projectPrismSourceZones = [
  definePathZone("actor-core-candidate", "Actor primitives that are UI-free, scene-free, update-scheduler-free, and window-focus-free.", [
    /^\.\/actor-runtime\//
  ]),
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
    /^\.\/features\/scene\/(?:index|install-scene-view-feature)\.ts$/,
    /^\.\/features\/scene\/components\//
  ]),
  definePathZone("app-composition", "Wallpaper app bootstrap and composition layer.", [
    /^\.\/app\/(?!app-shell\.ts$)[^/]+\.ts$/,
    /^\.\/demo\.ts$/
  ]),
  definePathZone("app-composition-debt", "Wallpaper app composition still coordinates product feature policy that has not moved behind owner installers.", [
    /^\.\/features\/workspace-mode\.ts$/,
    /^\.\/features\/install-wallpaper-product-features\.ts$/
  ], { debt: true }),
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
    zoneId: "app-composition-debt",
    blocks: ["app bootstrap thinning", "package extraction handoff"],
    blocker: "App composition still wires product feature ordering, hierarchy source composition, app menu wiring, and Scene run-mode command behavior.",
    deletionCondition: "App composition imports public runtime/editor/UI installers and bootstrap ports only."
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
    blocker: "Wallpaper product feature composition still assembles owner policy contributions, hierarchy source metadata, app menu wiring, and product feature ordering.",
    deletionCondition: "Product feature policy is split into owner-owned installers or deleted when existing runtime/editor/UI owners can express the behavior directly."
  },
  {
    id: "scene-run-mode-product-command",
    files: [
      "./features/workspace-mode.ts"
    ],
    blocks: ["ui-framework extraction", "editor-state split"],
    blocker: "Scene run-mode command module remains app-local because it coordinates product Scene semantics with window presentation ports.",
    deletionCondition: "Scene run-mode is either deleted as redundant behavior or expressed behind editor/UI owner ports without product-specific placement truth."
  }
] as const satisfies readonly ProjectPrismAppCompositionBlocker[];

export const projectPrismZoneDependencyRules = [
  {
    sourceZone: "actor-core-candidate",
    forbiddenTargetZones: [
      "actor-input-candidate",
      "ui-framework-candidate",
      "editor-candidate",
      "app-composition"
    ]
  },
  {
    sourceZone: "actor-input-candidate",
    forbiddenTargetZones: [
      "ui-framework-candidate",
      "editor-candidate",
      "app-composition"
    ]
  },
  {
    sourceZone: "ui-framework-candidate",
    forbiddenTargetZones: [
      "editor-candidate",
      "app-composition"
    ]
  },
  {
    sourceZone: "runtime-core-candidate",
    forbiddenTargetZones: [
      "actor-input-candidate",
      "ui-framework-candidate",
      "editor-candidate",
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
      "app-composition-debt"
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

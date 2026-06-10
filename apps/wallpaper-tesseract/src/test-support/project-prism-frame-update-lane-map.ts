export type ProjectPrismFrameUpdateLane =
  | "runtime-work"
  | "ui-component-tick"
  | "editor-state-flush"
  | "scheduler-dispatcher"
  | "shared-contract"
  | "barrel-export";

export type ProjectPrismFrameUpdateTargetOwner =
  | "runtime-scheduler"
  | "ui-component-scheduler"
  | "editor-state-flush-scheduler"
  | "app-composition-delete-after-split"
  | "shared-contract";

export interface ProjectPrismFrameUpdateLaneEntry {
  readonly id: string;
  readonly sourceFile: string;
  readonly lane: ProjectPrismFrameUpdateLane;
  readonly targetOwner: ProjectPrismFrameUpdateTargetOwner;
  readonly eligibleForRuntimeScheduler: boolean;
  readonly stopCondition: string;
}

export const projectPrismFrameUpdateLaneMap = [
  entry(
    "runtime-update-frame-contract",
    "./runtime/ports/update-frame.ts",
    "shared-contract",
    "shared-contract",
    false,
    "UpdateFrame/RuntimeObject compatibility contracts are deleted or moved once production scheduler lanes are split."
  ),
  entry(
    "runtime-object-registry-contract",
    "./runtime/ports/runtime-object-registry.ts",
    "shared-contract",
    "shared-contract",
    false,
    "RuntimeObjectRegistry compatibility contract is deleted after RuntimeScheduler owns runtime work."
  ),
  entry(
    "runtime-ports-barrel",
    "./runtime/ports/index.ts",
    "barrel-export",
    "shared-contract",
    false,
    "Barrel no longer exports mixed RuntimeObject compatibility contracts."
  ),
  entry(
    "scene-runtime-dispatcher",
    "./scene-runtime/scene-runtime.ts",
    "scheduler-dispatcher",
    "app-composition-delete-after-split",
    false,
    "SceneRuntime is deleted after runtime work, UI component tick, and editor state flush use separate owners."
  ),
  entry(
    "scene-runtime-object-alias",
    "./scene-runtime/runtime-object.ts",
    "shared-contract",
    "shared-contract",
    false,
    "scene-runtime no longer re-exports runtime object compatibility aliases."
  ),
  entry(
    "scene-runtime-barrel",
    "./scene-runtime/index.ts",
    "barrel-export",
    "shared-contract",
    false,
    "scene-runtime barrel no longer exports mixed scheduler contracts."
  ),
  entry(
    "app-render-loop-dispatch",
    "./app/create-wallpaper-app.ts",
    "scheduler-dispatcher",
    "app-composition-delete-after-split",
    false,
    "App render loop calls explicit runtime, UI tick, and editor state flush schedulers instead of sceneRuntime.updateFrame."
  ),
  entry(
    "app-runtime-context-dispatch-registration",
    "./app-runtime/app-runtime-context.ts",
    "scheduler-dispatcher",
    "app-composition-delete-after-split",
    false,
    "App runtime context no longer exposes a generic RuntimeObject registration bus."
  ),
  entry(
    "ui-scheduler-runtime-adapter",
    "./app/adapters/ui-scheduler-runtime-adapter.ts",
    "scheduler-dispatcher",
    "app-composition-delete-after-split",
    false,
    "UI scheduler adapter is deleted after UI tick has its own scheduler lane."
  ),
  entry(
    "frame-update-attachment-runtime",
    "./update-runtime/frame-update-attachment-runtime.ts",
    "scheduler-dispatcher",
    "ui-component-scheduler",
    false,
    "FrameUpdateAttachmentRuntime remains an actor/component tick dispatcher or is replaced by a UI component scheduler; it is not moved wholesale into RuntimeScheduler."
  ),
  entry(
    "runtime-work-attachment-runtime",
    "./update-runtime/runtime-work-attachment-runtime.ts",
    "scheduler-dispatcher",
    "runtime-scheduler",
    false,
    "RuntimeWorkAttachmentRuntime remains a binding bridge from actor/component lifecycle to RuntimeScheduler and is not itself runtime work."
  ),
  entry(
    "frame-update-runtime-barrel",
    "./update-runtime/index.ts",
    "barrel-export",
    "ui-component-scheduler",
    false,
    "update-runtime barrel exports only UI/component tick contracts after runtime work migrates."
  ),
  entry(
    "frame-state-controller",
    "./scene-runtime/frame-state-controller.ts",
    "editor-state-flush",
    "editor-state-flush-scheduler",
    false,
    "FrameStateController is split into domain state flush owners and no longer registers as RuntimeObject."
  ),
  entry(
    "camera3-motion-controller",
    "./camera3-control/camera3-motion-controller.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Camera motion consumes RuntimeScheduler/RuntimeCamera commands rather than app-local RuntimeObject scheduling."
  ),
  entry(
    "camera3-motion-component",
    "./features/camera3/components/camera3-motion-component.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Camera3 actor component binds editor commands to runtime camera state without owning scheduler dispatch."
  ),
  entry(
    "camera3-motion-definition",
    "./features/camera3/components/camera3-motion-definition.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Camera3 motion definition no longer uses frame-update attachment after camera runtime work migrates."
  ),
  entry(
    "tesseract4-runtime-object",
    "./tesseract4/tesseract4-runtime-object.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Tesseract4 world/projection update is owned by runtime packages, not app-local RuntimeObject."
  ),
  entry(
    "tesseract4-component",
    "./tesseract4/components/tesseract4-component.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Tesseract4 component binds actor/editor lifecycle to runtime world ownership without owning scheduler dispatch."
  ),
  entry(
    "tesseract4-definition",
    "./tesseract4/components/tesseract4-definition.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Tesseract4 definition no longer uses frame-update attachment after world runtime work migrates."
  ),
  entry(
    "tesseract4-barrel",
    "./tesseract4/index.ts",
    "barrel-export",
    "runtime-scheduler",
    false,
    "Tesseract4 barrel exports product runtime contracts from their final runtime owner."
  ),
  entry(
    "debug-log-content-component",
    "./debug/components/debug-log-content-component.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "Debug log refresh remains editor/UI tick and never enters RuntimeScheduler."
  ),
  entry(
    "debug-log-content-definition",
    "./debug/components/debug-log-content-definition.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "Debug log frame-update attachment belongs to UI component tick until replaced by a UI scheduler."
  ),
  entry(
    "hierarchy-panel-component",
    "./hierarchy/hierarchy-panel-component.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "Hierarchy panel refresh remains editor/UI tick and never enters RuntimeScheduler."
  ),
  entry(
    "hierarchy-panel-definition",
    "./hierarchy/hierarchy-panel-definition.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "Hierarchy frame-update attachment belongs to UI component tick until replaced by a UI scheduler."
  ),
  entry(
    "app-menu-bar-component",
    "./features/app-menu/app-menu-bar-component.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "App menu refresh remains UI tick and never enters RuntimeScheduler."
  ),
  entry(
    "app-menu-bar-definition",
    "./features/app-menu/app-menu-bar-definition.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "App menu frame-update attachment belongs to UI component tick until replaced by a UI scheduler."
  )
] as const satisfies readonly ProjectPrismFrameUpdateLaneEntry[];

export const projectPrismRuntimeWorkLane = projectPrismFrameUpdateLaneMap.filter(
  (entry) => entry.lane === "runtime-work"
);

export const projectPrismUiComponentTickLane = projectPrismFrameUpdateLaneMap.filter(
  (entry) => entry.lane === "ui-component-tick"
);

export const projectPrismEditorStateFlushLane = projectPrismFrameUpdateLaneMap.filter(
  (entry) => entry.lane === "editor-state-flush"
);

export const projectPrismSchedulerDispatcherLane = projectPrismFrameUpdateLaneMap.filter(
  (entry) => entry.lane === "scheduler-dispatcher"
);

function entry(
  id: string,
  sourceFile: string,
  lane: ProjectPrismFrameUpdateLane,
  targetOwner: ProjectPrismFrameUpdateTargetOwner,
  eligibleForRuntimeScheduler: boolean,
  stopCondition: string
): ProjectPrismFrameUpdateLaneEntry {
  return {
    id,
    sourceFile,
    lane,
    targetOwner,
    eligibleForRuntimeScheduler,
    stopCondition
  };
}

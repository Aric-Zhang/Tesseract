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
    "UpdateFrame remains the shared app-local frame tick contract until package ownership is finalized."
  ),
  entry(
    "runtime-ports-barrel",
    "./runtime/ports/index.ts",
    "barrel-export",
    "shared-contract",
    false,
    "Barrel exports only explicit frame/update contracts, not generic runtime object buses."
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
    "app-frame-orchestrator",
    "./app/app-frame-orchestrator.ts",
    "scheduler-dispatcher",
    "app-composition-delete-after-split",
    false,
    "App frame orchestrator remains explicit app composition ordering, not a generic RuntimeObject bus."
  ),
  entry(
    "ui-frame-scheduler",
    "./app/ui-frame-scheduler.ts",
    "scheduler-dispatcher",
    "ui-component-scheduler",
    false,
    "UI frame scheduler owns UI scheduled service ticks and is not registered into RuntimeScheduler."
  ),
  entry(
    "frame-update-attachment-runtime",
    "packages/ui-framework/src/ports/ui-frame-update-attachment-runtime.ts",
    "scheduler-dispatcher",
    "ui-component-scheduler",
    false,
    "FrameUpdateAttachmentRuntime is owned by ui-framework as a UI component tick dispatcher; it is not moved wholesale into RuntimeScheduler."
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
    "runtime-scheduler",
    false,
    "update-runtime barrel exports only runtime-work attachment debt until that bridge migrates."
  ),
  entry(
    "app-frame-state-controller",
    "packages/editor/src/app-state-controller.ts",
    "editor-state-flush",
    "editor-state-flush-scheduler",
    false,
    "AppFrameStateController remains editor/app state flush owner until it is moved behind an editor scheduler port."
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
    "tesseract4-runtime-renderable",
    "./tesseract4/tesseract4-runtime-renderable.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Tesseract4 runtime renderable moves toward runtime ownership and no longer implements app-local RuntimeObject."
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
    "packages/editor/src/debug/components/debug-log-content-component.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "Debug log refresh remains editor/UI tick and never enters RuntimeScheduler."
  ),
  entry(
    "debug-log-content-definition",
    "packages/editor/src/debug/components/debug-log-content-definition.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "Debug log frame-update attachment belongs to UI component tick until replaced by a UI scheduler."
  ),
  entry(
    "hierarchy-panel-component",
    "packages/editor/src/hierarchy/hierarchy-panel-component.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "Hierarchy panel refresh remains editor/UI tick and never enters RuntimeScheduler."
  ),
  entry(
    "hierarchy-panel-definition",
    "packages/editor/src/hierarchy/hierarchy-panel-definition.ts",
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

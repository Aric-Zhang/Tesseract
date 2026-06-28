export type ProjectPrismFrameUpdateLane =
  | "runtime-work"
  | "ui-component-tick"
  | "editor-state-flush"
  | "scheduler-dispatcher"
  | "barrel-export";

export type ProjectPrismFrameUpdateTargetOwner =
  | "runtime-scheduler"
  | "ui-component-scheduler"
  | "editor-state-flush-scheduler"
  | "app-composition-delete-after-split";

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
    "app-render-loop-dispatch",
    "./app/create-wallpaper-app.ts",
    "scheduler-dispatcher",
    "app-composition-delete-after-split",
    false,
    "App render loop calls explicit runtime, UI tick, and editor state flush schedulers instead of sceneRuntime.updateFrame."
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
    "packages/wallpaper-runtime/src/runtime-work-attachment-runtime.ts",
    "scheduler-dispatcher",
    "runtime-scheduler",
    false,
    "RuntimeWorkAttachmentRuntime is the runtime-owned binding bridge from actor/component lifecycle to RuntimeScheduler and is not itself runtime work."
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
    "runtime-three-camera-motion-controller",
    "packages/runtime-three/src/runtime-three-camera-motion-controller.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Runtime-three camera motion consumes RuntimeScheduler/RuntimeCamera commands rather than app-local RuntimeObject scheduling."
  ),
  entry(
    "camera3-motion-component",
    "packages/wallpaper-runtime/src/camera3/camera3-motion-component.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Camera3 runtime component binds editor commands to runtime camera state without owning scheduler dispatch."
  ),
  entry(
    "camera3-motion-definition",
    "packages/wallpaper-runtime/src/camera3/camera3-motion-definition.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Camera3 motion definition installs runtime-work attachment from the runtime owner."
  ),
  entry(
    "tesseract4-runtime-renderable",
    "packages/wallpaper-runtime/src/tesseract4/tesseract4-runtime-renderable.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Tesseract4 runtime renderable is owned by the runtime scene domain and no longer implements app-local RuntimeObject."
  ),
  entry(
    "tesseract4-component",
    "packages/wallpaper-runtime/src/tesseract4/tesseract4-component.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Tesseract4 component binds actor lifecycle to runtime world ownership without owning scheduler dispatch."
  ),
  entry(
    "tesseract4-definition",
    "packages/wallpaper-runtime/src/tesseract4/tesseract4-definition.ts",
    "runtime-work",
    "runtime-scheduler",
    true,
    "Tesseract4 definition installs runtime-work attachment from the runtime owner."
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
    "app-menu-adapter-component",
    "./features/app-menu/app-menu-adapter-component.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "App menu actor synchronization remains UI tick and never enters RuntimeScheduler."
  ),
  entry(
    "app-menu-adapter-definition",
    "./features/app-menu/app-menu-adapter-definition.ts",
    "ui-component-tick",
    "ui-component-scheduler",
    false,
    "App menu adapter frame-update attachment belongs to UI component tick until replaced by a UI scheduler."
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

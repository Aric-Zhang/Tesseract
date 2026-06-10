export type ProjectPrismStateDomain =
  | "runtime-scheduler"
  | "runtime-state"
  | "editor-state"
  | "ui-layout-state"
  | "mixed-state"
  | "shared-value";

export type ProjectPrismStateTargetOwner =
  | "runtime-core"
  | "runtime-production-ownership"
  | "editor"
  | "ui-framework"
  | "shared-contract"
  | "delete-after-split";

export interface ProjectPrismStateDomainEntry {
  readonly exportName: string;
  readonly sourceFile: string;
  readonly domain: ProjectPrismStateDomain;
  readonly targetOwner: ProjectPrismStateTargetOwner;
  readonly stopCondition: string;
}

export const projectPrismSceneRuntimeStateDomainMap = [
  entry("SceneFrameClock", "scene-frame.ts", "runtime-scheduler", "runtime-core", "Runtime frame clock is emitted by runtime-core/update scheduler, not scene-runtime."),
  entry("SceneFrame", "scene-frame.ts", "runtime-scheduler", "runtime-core", "SceneFrame alias is deleted after consumers use runtime-core RuntimeFrame or app-local adapter."),
  entry("FrameStateController", "frame-state-controller.ts", "mixed-state", "delete-after-split", "Controller is split into runtime/editor/ui state controllers; no mixed parameter bus remains."),
  entry("FrameStateControllerOptions", "frame-state-controller.ts", "mixed-state", "delete-after-split", "Options disappear with FrameStateController split."),
  entry("SceneParameterChange", "frame-state-controller.ts", "mixed-state", "delete-after-split", "Parameter change events become domain-specific state events."),
  entry("SceneStateChangedEvent", "frame-state-controller.ts", "mixed-state", "delete-after-split", "Scene-wide state event is replaced by runtime/editor/ui state event contracts."),
  entry("SceneStateObserver", "frame-state-controller.ts", "mixed-state", "delete-after-split", "Observer binding points at domain-specific state sources."),
  entry("SceneParameterStore", "scene-parameter-store.ts", "mixed-state", "delete-after-split", "Generic parameter store is split or replaced by domain-owned stores."),
  entry("SceneMergeStrategy", "scene-parameter-store.ts", "mixed-state", "delete-after-split", "Merge strategy is kept only where a domain store still needs it."),
  entry("SceneParameterDefinition", "scene-parameter-store.ts", "mixed-state", "delete-after-split", "Parameter definitions move to their owning state domain."),
  entry("SceneRuntime", "scene-runtime.ts", "runtime-scheduler", "runtime-production-ownership", "RuntimeScheduler owns runtime work; editor/UI services no longer register in SceneRuntime."),
  entry("FrameUpdatable", "runtime-object.ts", "runtime-scheduler", "runtime-core", "Runtime work consumes runtime-core RuntimeFrame contracts."),
  entry("RuntimeDisposable", "runtime-object.ts", "runtime-scheduler", "runtime-core", "Disposable contract comes from runtime-core or package-local lifecycle primitives."),
  entry("RuntimeObject", "runtime-object.ts", "runtime-scheduler", "runtime-production-ownership", "Current app-local object bus is deleted after runtime work is scheduled by runtime packages."),
  entry("RuntimeRegistration", "runtime-object.ts", "runtime-scheduler", "runtime-core", "Registration contract comes from runtime-core or package-local lifecycle primitives."),
  entry("parameterPath", "scene-update-command.ts", "mixed-state", "delete-after-split", "String path helper is deleted once state paths are domain-specific."),
  entry("ParameterPath", "scene-update-command.ts", "mixed-state", "delete-after-split", "State path identity is owned by runtime/editor/ui state domains separately."),
  entry("SceneCommandSink", "scene-update-command.ts", "mixed-state", "delete-after-split", "Command sinks split into runtime command ports, editor commands, and UI layout commands."),
  entry("SceneUpdateCommand", "scene-update-command.ts", "mixed-state", "delete-after-split", "Update commands split by state domain."),
  entry("SceneUpdateOperation", "scene-update-command.ts", "mixed-state", "delete-after-split", "Update operation vocabulary is no longer shared across all state domains."),
  entry("SceneUpdateSource", "scene-update-source.ts", "editor-state", "editor", "Source metadata moves to editor command/state layer."),
  entry("SceneUpdateSourceKind", "scene-update-source.ts", "editor-state", "editor", "Source kind vocabulary moves to editor command/state layer."),
  entry("sceneParameterPaths", "parameter-paths.ts", "mixed-state", "delete-after-split", "Runtime, editor, and UI layout state paths are owned by their packages/features."),
  entry("addVec2", "vec2.ts", "ui-layout-state", "ui-framework", "UI geometry/value helpers live in UI framework or a shared geometry contract."),
  entry("assertVec2", "vec2.ts", "ui-layout-state", "ui-framework", "UI geometry/value helpers live in UI framework or a shared geometry contract."),
  entry("cloneVec2", "vec2.ts", "ui-layout-state", "ui-framework", "UI geometry/value helpers live in UI framework or a shared geometry contract."),
  entry("equalsVec2", "vec2.ts", "ui-layout-state", "ui-framework", "UI geometry/value helpers live in UI framework or a shared geometry contract."),
  entry("vec2", "vec2.ts", "ui-layout-state", "ui-framework", "UI geometry/value helpers live in UI framework or a shared geometry contract."),
  entry("Vec2", "vec2.ts", "ui-layout-state", "ui-framework", "UI geometry/value helpers live in UI framework or a shared geometry contract.")
] as const satisfies readonly ProjectPrismStateDomainEntry[];

export const projectPrismRuntimeStateSurface = projectPrismSceneRuntimeStateDomainMap.filter(
  (entry) => entry.domain === "runtime-state" || entry.domain === "runtime-scheduler"
);

export const projectPrismEditorStateSurface = projectPrismSceneRuntimeStateDomainMap.filter(
  (entry) => entry.domain === "editor-state"
);

export const projectPrismUiLayoutStateSurface = projectPrismSceneRuntimeStateDomainMap.filter(
  (entry) => entry.domain === "ui-layout-state"
);

function entry(
  exportName: string,
  sourceFile: string,
  domain: ProjectPrismStateDomain,
  targetOwner: ProjectPrismStateTargetOwner,
  stopCondition: string
): ProjectPrismStateDomainEntry {
  return {
    exportName,
    sourceFile,
    domain,
    targetOwner,
    stopCondition
  };
}


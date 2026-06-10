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
  entry("SceneRuntime", "scene-runtime.ts", "mixed-state", "delete-after-split", "SceneRuntime is deleted after UI component tick and editor state flush stop sharing one generic app-local scheduler bus."),
  entry("FrameUpdatable", "runtime-object.ts", "runtime-scheduler", "runtime-core", "Runtime work consumes runtime-core RuntimeFrame contracts."),
  entry("RuntimeDisposable", "runtime-object.ts", "runtime-scheduler", "runtime-core", "Disposable contract comes from runtime-core or package-local lifecycle primitives."),
  entry("RuntimeObject", "runtime-object.ts", "mixed-state", "delete-after-split", "Current app-local object bus is deleted after UI tick and editor state flush no longer share RuntimeObject registration."),
  entry("RuntimeRegistration", "runtime-object.ts", "runtime-scheduler", "runtime-core", "Registration contract comes from runtime-core or package-local lifecycle primitives."),
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

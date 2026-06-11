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

export const projectPrismSceneRuntimeStateDomainMap: readonly ProjectPrismStateDomainEntry[] = [];

export const projectPrismRuntimeStateSurface = projectPrismSceneRuntimeStateDomainMap.filter(
  (entry) => entry.domain === "runtime-state" || entry.domain === "runtime-scheduler"
);

export const projectPrismEditorStateSurface = projectPrismSceneRuntimeStateDomainMap.filter(
  (entry) => entry.domain === "editor-state"
);

export const projectPrismUiLayoutStateSurface = projectPrismSceneRuntimeStateDomainMap.filter(
  (entry) => entry.domain === "ui-layout-state"
);

export function entry(
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

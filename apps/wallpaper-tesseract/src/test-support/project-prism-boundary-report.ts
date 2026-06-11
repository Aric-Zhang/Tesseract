import {
  createSourceZoneMap,
  evaluateZoneDependencyMatrix,
  listDynamicImports,
  type SourceZoneDefinition
} from "./architecture-boundaries";
import {
  projectPrismAppCompositionBlockers,
  projectPrismDebtBlockers,
  projectPrismPackageTargets,
  projectPrismPrePhase6UiFrameworkBlockers,
  projectPrismRuntimeExtractionBlockers,
  projectPrismSourceZones,
  projectPrismUiFrameworkExtractionBlockers,
  projectPrismZoneDependencyRules
} from "./project-prism-boundary-facts";

export interface ProjectPrismBoundarySummary {
  readonly status: "complete" | "incomplete";
  readonly verdict: string;
  readonly zones: {
    readonly candidates: readonly ProjectPrismZoneSummary[];
    readonly debt: readonly ProjectPrismZoneSummary[];
  };
  readonly packageTargets: readonly ProjectPrismPackageTargetSummary[];
  readonly dependencyMatrix: {
    readonly ruleCount: number;
    readonly violationCount: number;
    readonly violations: readonly string[];
  };
  readonly dynamicImports: readonly string[];
  readonly extractionBlockers: {
    readonly debt: readonly ProjectPrismDebtBlockerSummary[];
    readonly runtime: readonly ProjectPrismNamedBlockerSummary[];
    readonly uiFramework: readonly ProjectPrismNamedBlockerSummary[];
    readonly appComposition: readonly ProjectPrismNamedBlockerSummary[];
  };
}

export interface ProjectPrismZoneSummary {
  readonly id: string;
  readonly description: string;
  readonly fileCount: number;
}

export interface ProjectPrismPackageTargetSummary {
  readonly id: string;
  readonly status: "allowed" | "blocked" | "deferred";
  readonly phase: string;
  readonly cleanCandidateZones: readonly string[];
  readonly debtZones: readonly string[];
  readonly blockedBy: readonly string[];
}

export interface ProjectPrismDebtBlockerSummary {
  readonly zoneId: string;
  readonly blocks: readonly string[];
  readonly blocker: string;
  readonly deletionCondition: string;
}

export interface ProjectPrismNamedBlockerSummary {
  readonly id: string;
  readonly blocks: readonly string[];
  readonly files: readonly string[];
  readonly blocker: string;
  readonly deletionCondition: string;
  readonly requiredPort?: string;
}

export function createProjectPrismBoundarySummary(
  files: Record<string, string>,
  zones: readonly SourceZoneDefinition[] = projectPrismSourceZones
): ProjectPrismBoundarySummary {
  const zoneMap = createSourceZoneMap(files, zones);
  const dependencyViolations = evaluateZoneDependencyMatrix(files, zones, projectPrismZoneDependencyRules);
  const dynamicImports = listDynamicImports(files)
    .map((entry) => `${entry.fromFile}: ${entry.specifier ?? "<dynamic>"}`)
    .sort();
  const candidates = summarizeZones(zones.filter((zone) => zone.debt !== true), zoneMap.entries);
  const debt = summarizeZones(zones.filter((zone) => zone.debt === true), zoneMap.entries);
  const packageTargets = projectPrismPackageTargets
    .map((target) => ({
      id: target.id,
      status: target.extractionStatus,
      phase: target.extractionPhase,
      cleanCandidateZones: [...target.cleanCandidateZones],
      debtZones: [...target.debtZones],
      blockedBy: [...target.blockedBy]
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const hasMatrixDebt = dependencyViolations.length > 0 || dynamicImports.length > 0;
  const summary: ProjectPrismBoundarySummary = {
    status: hasMatrixDebt ? "incomplete" : "complete",
    verdict: hasMatrixDebt
      ? "Phase 0B still has dependency or dynamic-import boundary debt."
      : "Phase 0B boundary matrix is generated and clean; package extraction remains blocked only by the listed target blockers.",
    zones: { candidates, debt },
    packageTargets,
    dependencyMatrix: {
      ruleCount: projectPrismZoneDependencyRules.length,
      violationCount: dependencyViolations.length,
      violations: dependencyViolations
        .map((violation) => `${violation.fromFile} [${violation.sourceZone}] -> ${violation.toFile} [${violation.targetZone}] via ${violation.specifier}`)
        .sort()
    },
    dynamicImports,
    extractionBlockers: {
      debt: projectPrismDebtBlockers.map((blocker) => ({ ...blocker })),
      runtime: projectPrismRuntimeExtractionBlockers.map((blocker) => ({ ...blocker })),
      uiFramework: [
        ...projectPrismUiFrameworkExtractionBlockers,
        ...projectPrismPrePhase6UiFrameworkBlockers
      ].map((blocker) => ({ ...blocker })),
      appComposition: projectPrismAppCompositionBlockers.map((blocker) => ({ ...blocker }))
    }
  };
  return summary;
}

export function renderProjectPrismBoundarySummaryMarkdown(summary: ProjectPrismBoundarySummary): string {
  return `${[
    "# Project Prism Phase 0B Boundary Summary",
    "",
    `Status: ${summary.status}`,
    "",
    `Verdict: ${summary.verdict}`,
    "",
    "## Package Targets",
    "",
    "| Target | Status | Phase | Clean Candidate Zones | Debt Zones | Blocked By |",
    "| --- | --- | --- | --- | --- | --- |",
    ...summary.packageTargets.map((target) => (
      `| ${target.id} | ${target.status} | ${target.phase} | ${formatList(target.cleanCandidateZones)} | ${formatList(target.debtZones)} | ${formatList(target.blockedBy)} |`
    )),
    "",
    "## Candidate Zones",
    "",
    ...summary.zones.candidates.map((zone) => `- ${zone.id}: ${zone.fileCount} files. ${zone.description}`),
    "",
    "## Debt Zones",
    "",
    ...summary.zones.debt.map((zone) => `- ${zone.id}: ${zone.fileCount} files. ${zone.description}`),
    "",
    "## Dependency Matrix",
    "",
    `- Rules: ${summary.dependencyMatrix.ruleCount}`,
    `- Violations: ${summary.dependencyMatrix.violationCount}`,
    ...formatOptionalLines(summary.dependencyMatrix.violations),
    "",
    "## Dynamic Imports",
    "",
    ...formatOptionalLines(summary.dynamicImports),
    "",
    "## Debt Blockers",
    "",
    ...summary.extractionBlockers.debt.map((blocker) => `- ${blocker.zoneId}: blocks ${formatList(blocker.blocks)}. Delete when: ${blocker.deletionCondition}`),
    "",
    "## Runtime Extraction Blockers",
    "",
    ...summary.extractionBlockers.runtime.map((blocker) => `- ${blocker.id}: ${blocker.blocker} Required port: ${blocker.requiredPort}.`),
    "",
    "## UI Framework Extraction Blockers",
    "",
    ...summary.extractionBlockers.uiFramework.map((blocker) => `- ${blocker.id}: ${blocker.blocker} Required port: ${blocker.requiredPort}.`),
    "",
    "## App Composition Blockers",
    "",
    ...summary.extractionBlockers.appComposition.map((blocker) => `- ${blocker.id}: ${blocker.blocker}`),
    ""
  ].join("\n")}\n`;
}

export function serializeProjectPrismBoundarySummary(summary: ProjectPrismBoundarySummary): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}

function summarizeZones(
  zones: readonly SourceZoneDefinition[],
  entries: ReturnType<typeof createSourceZoneMap>["entries"]
): ProjectPrismZoneSummary[] {
  return zones
    .map((zone) => ({
      id: zone.id,
      description: zone.description,
      fileCount: entries.filter((entry) => entry.zones.some((entryZone) => entryZone.id === zone.id)).length
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function formatList(values: readonly string[]): string {
  return values.length === 0 ? "(none)" : values.join(", ");
}

function formatOptionalLines(values: readonly string[]): string[] {
  return values.length === 0 ? ["- none"] : values.map((value) => `- ${value}`);
}

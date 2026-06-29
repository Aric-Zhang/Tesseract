import { describe, expect, it } from "vitest";
import { sourceFiles } from "./architecture-boundaries";
import {
  createProjectPrismBoundarySummary,
  renderProjectPrismBoundarySummaryMarkdown,
  serializeProjectPrismBoundarySummary
} from "./project-prism-boundary-report";
import {
  projectPrismAppCompositionBlockers,
  projectPrismDebtBlockers,
  projectPrismPackageTargets,
  projectPrismPrePhase6UiFrameworkBlockers,
  projectPrismRuntimeExtractionBlockers,
  projectPrismUiFrameworkExtractionBlockers
} from "./project-prism-boundary-facts";

describe("Project Prism boundary report", () => {
  it("creates a boundary summary from the same facts used by architecture tests", () => {
    const summary = createProjectPrismBoundarySummary(sourceFiles);

    expect(summary.status).toBe("complete");
    expect(summary.verdict).toContain("Phase 0B boundary matrix is generated and clean");
    expect(summary.dependencyMatrix.violationCount).toBe(0);
    expect(summary.dynamicImports).toEqual([]);
    expect(summary.zones.debt.map((zone) => zone.id)).toEqual(expect.arrayContaining(
      projectPrismDebtBlockers.map((blocker) => blocker.zoneId)
    ));
  });

  it("distinguishes clean candidates from candidate zones that are still extraction-blocked by debt", () => {
    const summary = createProjectPrismBoundarySummary(sourceFiles);
    const targetsById = new Map(summary.packageTargets.map((target) => [target.id, target]));

    expect(targetsById.get("actor-system/core")).toMatchObject({
      status: "allowed",
      cleanCandidateZones: ["actor-core-candidate"],
      blockedBy: []
    });
    expect(targetsById.get("actor-system/input")).toMatchObject({
      status: "allowed",
      cleanCandidateZones: ["actor-input-candidate"],
      blockedBy: []
    });
    expect(targetsById.get("runtime-core-contracts")).toMatchObject({
      status: "allowed",
      cleanCandidateZones: ["runtime-core-candidate"],
      blockedBy: []
    });
    expect(targetsById.get("runtime-production-ownership")).toMatchObject({
      status: "allowed",
      cleanCandidateZones: ["wallpaper-runtime-candidate"],
      blockedBy: []
    });
    expect(targetsById.get("runtime-three-backend")).toMatchObject({
      status: "allowed",
      cleanCandidateZones: ["runtime-three-candidate"],
      blockedBy: []
    });
    expect(targetsById.get("runtime-render-production-ownership")).toMatchObject({
      status: "allowed",
      blockedBy: []
    });
    expect(targetsById.get("wallpaper-runtime")).toMatchObject({
      status: "allowed",
      cleanCandidateZones: ["wallpaper-runtime-candidate"],
      debtZones: [],
      blockedBy: []
    });
    expect(targetsById.get("ui-framework")).toMatchObject({
      status: "allowed",
      blockedBy: []
    });
    expect(targetsById.get("editor")).toMatchObject({
      status: "allowed",
      cleanCandidateZones: ["editor-candidate"],
      blockedBy: []
    });
  });

  it("does not allow a package target to be marked allowed while blockers are still listed", () => {
    const packageTargets: readonly {
      readonly id: string;
      readonly extractionStatus: "allowed" | "blocked" | "deferred";
      readonly blockedBy: readonly string[];
    }[] = projectPrismPackageTargets;
    const incorrectlyAllowedTargets = packageTargets
      .filter((target) => target.extractionStatus === "allowed" && target.blockedBy.length > 0)
      .map((target) => target.id);

    expect(incorrectlyAllowedTargets).toEqual([]);
  });

  it("renders markdown and JSON from the same blocker facts", () => {
    const summary = createProjectPrismBoundarySummary(sourceFiles);
    const markdown = renderProjectPrismBoundarySummaryMarkdown(summary);
    const json = JSON.parse(serializeProjectPrismBoundarySummary(summary)) as typeof summary;

    for (const target of projectPrismPackageTargets) {
      expect(markdown).toContain(`| ${target.id} | ${target.extractionStatus} |`);
      expect(json.packageTargets.find((item) => item.id === target.id)?.status).toBe(target.extractionStatus);
    }
    for (const blocker of [
      ...projectPrismRuntimeExtractionBlockers,
      ...projectPrismUiFrameworkExtractionBlockers,
      ...projectPrismPrePhase6UiFrameworkBlockers,
      ...projectPrismAppCompositionBlockers
    ]) {
      expect(markdown).toContain(blocker.id);
      expect(serializeProjectPrismBoundarySummary(summary)).toContain(blocker.id);
    }
  });
});

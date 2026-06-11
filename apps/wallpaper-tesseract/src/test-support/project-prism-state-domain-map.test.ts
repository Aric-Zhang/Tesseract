import { describe, expect, it } from "vitest";
import { sourceFiles } from "./architecture-boundaries";
import {
  projectPrismEditorStateSurface,
  projectPrismRuntimeStateSurface,
  projectPrismSceneRuntimeStateDomainMap,
  projectPrismUiLayoutStateSurface
} from "./project-prism-state-domain-map";

describe("Project Prism state domain map", () => {
  it("keeps deleted scene-runtime compatibility surface out of production sources", () => {
    const sceneRuntimeFiles = Object.keys(sourceFiles)
      .filter((file) => file.startsWith("./scene-runtime/"))
      .sort();

    expect(sceneRuntimeFiles).toEqual([]);
    expect(projectPrismSceneRuntimeStateDomainMap).toEqual([]);
  });

  it("keeps runtime-state surface free of deleted scene-runtime compatibility facts", () => {
    expect(projectPrismRuntimeStateSurface).toEqual([]);
  });

  it("keeps editor-state and UI layout-state ownership separate from runtime-core", () => {
    expect(projectPrismEditorStateSurface.map((entry) => entry.exportName)).toEqual([]);
    expect(projectPrismEditorStateSurface.every((entry) => entry.targetOwner === "editor")).toBe(true);

    expect(projectPrismUiLayoutStateSurface.map((entry) => entry.exportName)).toEqual([]);
    expect(projectPrismUiLayoutStateSurface.every((entry) => entry.targetOwner === "ui-framework")).toBe(true);
  });

  it("records stop conditions for every mixed scene-runtime export", () => {
    const missingStopConditions = projectPrismSceneRuntimeStateDomainMap
      .filter((entry) => entry.domain === "mixed-state")
      .filter((entry) => entry.stopCondition.trim().length === 0)
      .map((entry) => entry.exportName);

    expect(missingStopConditions).toEqual([]);
  });
});

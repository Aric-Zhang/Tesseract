import { describe, expect, it } from "vitest";
import { readSourceFile } from "./architecture-boundaries";
import {
  projectPrismEditorStateSurface,
  projectPrismRuntimeStateSurface,
  projectPrismSceneRuntimeStateDomainMap,
  projectPrismUiLayoutStateSurface
} from "./project-prism-state-domain-map";

describe("Project Prism state domain map", () => {
  it("classifies every public scene-runtime barrel export exactly once", () => {
    const sceneRuntimeIndex = readSourceFile("./scene-runtime/index.ts");
    const exportedNames = listSceneRuntimeBarrelExports(sceneRuntimeIndex);
    const mappedNames = projectPrismSceneRuntimeStateDomainMap.map((entry) => entry.exportName).sort();

    expect(mappedNames).toEqual(exportedNames);
  });

  it("keeps runtime-state surface free of editor, UI layout, and mixed scene path facts", () => {
    const runtimeNames = projectPrismRuntimeStateSurface.map((entry) => entry.exportName);

    expect(runtimeNames).toEqual(expect.arrayContaining([
      "SceneFrame",
      "SceneFrameClock",
      "FrameUpdatable",
      "RuntimeDisposable",
      "RuntimeRegistration"
    ]));
    expect(runtimeNames).not.toEqual(expect.arrayContaining([
      "Vec2",
    ]));
  });

  it("keeps editor-state and UI layout-state ownership separate from runtime-core", () => {
    expect(projectPrismEditorStateSurface.map((entry) => entry.exportName)).toEqual([]);
    expect(projectPrismEditorStateSurface.every((entry) => entry.targetOwner === "editor")).toBe(true);

    expect(projectPrismUiLayoutStateSurface.map((entry) => entry.exportName)).toEqual([
      "addVec2",
      "assertVec2",
      "cloneVec2",
      "equalsVec2",
      "vec2",
      "Vec2"
    ]);
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

function listSceneRuntimeBarrelExports(source: string): string[] {
  const names = new Set<string>();
  const namedExportPattern = /export\s+(?:type\s+)?{([^}]+)}/g;
  for (const match of source.matchAll(namedExportPattern)) {
    for (const rawName of match[1].split(",")) {
      const name = rawName.trim().replace(/\s+as\s+.+$/, "");
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

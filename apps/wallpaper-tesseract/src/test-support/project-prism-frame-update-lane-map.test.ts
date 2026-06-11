import { describe, expect, it } from "vitest";
import { sourceFiles } from "./architecture-boundaries";
import {
  projectPrismEditorStateFlushLane,
  projectPrismFrameUpdateLaneMap,
  projectPrismRuntimeWorkLane,
  projectPrismSchedulerDispatcherLane,
  projectPrismUiComponentTickLane
} from "./project-prism-frame-update-lane-map";

const productionSchedulerSurfacePattern =
  /\bupdateFrame\s*\(|\bframeUpdateAttachment\b|\bruntimeWorkAttachment\b/;

describe("Project Prism frame update lane map", () => {
  it("classifies every current production frame-update surface before scheduler migration", () => {
    const classifiedFiles = new Set(projectPrismFrameUpdateLaneMap.map((entry) => entry.sourceFile));
    const unclassifiedFiles = Object.entries(sourceFiles)
      .filter(([file]) => isProductionSource(file))
      .filter(([, source]) => productionSchedulerSurfacePattern.test(source))
      .map(([file]) => file)
      .filter((file) => !classifiedFiles.has(file));

    expect(unclassifiedFiles).toEqual([]);
  });

  it("allows only runtime work entries to move to RuntimeScheduler", () => {
    const runtimeEligibleEntries = projectPrismFrameUpdateLaneMap.filter(
      (entry) => entry.eligibleForRuntimeScheduler
    );

    expect(runtimeEligibleEntries.map((entry) => entry.lane)).toEqual(
      runtimeEligibleEntries.map(() => "runtime-work")
    );
    expect(projectPrismRuntimeWorkLane.map((entry) => entry.sourceFile)).toEqual(expect.arrayContaining([
      "./features/camera3/components/camera3-motion-component.ts",
      "./tesseract4/components/tesseract4-component.ts"
    ]));
  });

  it("keeps UI component tick and editor state flush out of runtime scheduler ownership", () => {
    const nonRuntimeLanes = [
      ...projectPrismUiComponentTickLane,
      ...projectPrismEditorStateFlushLane,
      ...projectPrismSchedulerDispatcherLane
    ];

    expect(nonRuntimeLanes.some((entry) => entry.eligibleForRuntimeScheduler)).toBe(false);
    expect(projectPrismUiComponentTickLane.map((entry) => entry.sourceFile)).toEqual(expect.arrayContaining([
      "./debug/components/debug-log-content-component.ts",
      "./features/app-menu/app-menu-bar-component.ts",
      "./hierarchy/hierarchy-panel-component.ts"
    ]));
    expect(projectPrismEditorStateFlushLane.map((entry) => entry.sourceFile)).toEqual([
      "./editor/app-state-controller.ts"
    ]);
  });

  it("marks current dispatchers as split debt instead of pure runtime work", () => {
    expect(projectPrismSchedulerDispatcherLane.map((entry) => entry.sourceFile)).toEqual(expect.arrayContaining([
      "./update-runtime/frame-update-attachment-runtime.ts",
      "./app/app-frame-orchestrator.ts",
      "./app/ui-frame-scheduler.ts",
      "./app/create-wallpaper-app.ts"
    ]));
    expect(projectPrismSchedulerDispatcherLane.map((entry) => entry.stopCondition).join("\n")).toContain(
      "explicit runtime, UI tick, and editor state flush schedulers"
    );
  });
});

function isProductionSource(file: string): boolean {
  return !file.endsWith(".test.ts")
    && !file.includes("/test-support/");
}

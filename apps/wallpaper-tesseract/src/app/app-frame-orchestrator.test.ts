import { describe, expect, it } from "vitest";
import { AppFrameOrchestrator } from "./app-frame-orchestrator";

describe("AppFrameOrchestrator", () => {
  it("runs frame lanes in explicit runtime/ui/state/render order", () => {
    const calls: string[] = [];
    const orchestrator = new AppFrameOrchestrator({
      updateRuntimeWork(frame) {
        calls.push(`runtime:${frame.frameIndex}`);
      },
      tickUiComponents(frame) {
        calls.push(`components:${frame.frameIndex}`);
      },
      tickUiServices(frame) {
        calls.push(`ui:${frame.frameIndex}`);
      },
      flushEditorState(frame) {
        calls.push(`state:${frame.frameIndex}`);
      },
      renderFrameSources(frame) {
        calls.push(`render:${frame.frameIndex}`);
      }
    });

    orchestrator.updateFrame({ timeMs: 100, deltaMs: 16, frameIndex: 3 });

    expect(calls).toEqual([
      "runtime:3",
      "components:3",
      "ui:3",
      "state:3",
      "render:3"
    ]);
  });
});


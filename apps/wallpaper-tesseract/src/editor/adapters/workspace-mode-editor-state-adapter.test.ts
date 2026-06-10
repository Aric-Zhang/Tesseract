import { describe, expect, it } from "vitest";
import { AppFrameStateController } from "../app-state-controller";
import { AppStateParameterStore } from "../app-state-store";
import { editorStatePaths } from "../editor-state";
import {
  createEditorBackedWorkspaceCommandSink,
  registerWorkspaceModeParameters
} from "./workspace-mode-editor-state-adapter";

describe("workspace mode editor state adapter", () => {
  it("registers workspace mode idempotently", () => {
    const store = new AppStateParameterStore();

    registerWorkspaceModeParameters(store);
    registerWorkspaceModeParameters(store);

    expect(store.get(editorStatePaths.workspace.mode)).toBe("develop");
  });

  it("submits editor workspace commands to the app state controller", () => {
    const store = new AppStateParameterStore();
    registerWorkspaceModeParameters(store);
    const controller = new AppFrameStateController({ store });
    const sink = createEditorBackedWorkspaceCommandSink(controller);

    sink.submit({
      source: { id: "test", kind: "script" },
      target: editorStatePaths.workspace.mode,
      operation: "set",
      value: "run"
    });
    controller.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(store.get(editorStatePaths.workspace.mode)).toBe("run");
  });
});

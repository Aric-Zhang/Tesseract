import type { RuntimeFrame } from "runtime-core";
import type { UiFrame } from "ui-framework";

export interface AppFrameOrchestratorOptions {
  readonly updateRuntimeWork: (frame: RuntimeFrame) => void;
  readonly tickUiComponents: (frame: UiFrame) => void;
  readonly tickUiServices: (frame: UiFrame) => void;
  readonly flushEditorState: (frame: RuntimeFrame) => void;
  readonly renderFrameSources: (frame: RuntimeFrame) => void;
}

export class AppFrameOrchestrator {
  readonly #updateRuntimeWork: (frame: RuntimeFrame) => void;
  readonly #tickUiComponents: (frame: UiFrame) => void;
  readonly #tickUiServices: (frame: UiFrame) => void;
  readonly #flushEditorState: (frame: RuntimeFrame) => void;
  readonly #renderFrameSources: (frame: RuntimeFrame) => void;

  constructor(options: AppFrameOrchestratorOptions) {
    this.#updateRuntimeWork = options.updateRuntimeWork;
    this.#tickUiComponents = options.tickUiComponents;
    this.#tickUiServices = options.tickUiServices;
    this.#flushEditorState = options.flushEditorState;
    this.#renderFrameSources = options.renderFrameSources;
  }

  updateFrame(frame: RuntimeFrame): void {
    this.#updateRuntimeWork(frame);
    this.#tickUiComponents(frame);
    this.#tickUiServices(frame);
    this.#flushEditorState(frame);
    this.#renderFrameSources(frame);
  }
}

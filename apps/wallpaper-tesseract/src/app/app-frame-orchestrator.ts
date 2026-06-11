import type { UpdateFrame } from "../runtime/ports";

export interface AppFrameOrchestratorOptions {
  readonly updateRuntimeWork: (frame: UpdateFrame) => void;
  readonly tickUiComponents: (frame: UpdateFrame) => void;
  readonly tickUiServices: (frame: UpdateFrame) => void;
  readonly flushEditorState: (frame: UpdateFrame) => void;
  readonly renderFrameSources: (frame: UpdateFrame) => void;
}

export class AppFrameOrchestrator {
  readonly #updateRuntimeWork: (frame: UpdateFrame) => void;
  readonly #tickUiComponents: (frame: UpdateFrame) => void;
  readonly #tickUiServices: (frame: UpdateFrame) => void;
  readonly #flushEditorState: (frame: UpdateFrame) => void;
  readonly #renderFrameSources: (frame: UpdateFrame) => void;

  constructor(options: AppFrameOrchestratorOptions) {
    this.#updateRuntimeWork = options.updateRuntimeWork;
    this.#tickUiComponents = options.tickUiComponents;
    this.#tickUiServices = options.tickUiServices;
    this.#flushEditorState = options.flushEditorState;
    this.#renderFrameSources = options.renderFrameSources;
  }

  updateFrame(frame: UpdateFrame): void {
    this.#updateRuntimeWork(frame);
    this.#tickUiComponents(frame);
    this.#tickUiServices(frame);
    this.#flushEditorState(frame);
    this.#renderFrameSources(frame);
  }
}


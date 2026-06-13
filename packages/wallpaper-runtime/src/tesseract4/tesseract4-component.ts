import type { RuntimeFrame, RuntimeRegistration, RuntimeWork } from "runtime-core";
import type { Actor, Component, ComponentType } from "actor-core";
import {
  Tesseract4RuntimeRenderable,
  type RuntimeSceneObjectHost,
  type Tesseract4RuntimeRenderableOptions
} from "./tesseract4-runtime-renderable";

export const tesseract4ComponentType =
  "tesseract4-component" as ComponentType<Tesseract4Component>;

export type Tesseract4RuntimeRenderableFactory =
  (options: Tesseract4RuntimeRenderableOptions) => Tesseract4RuntimeRenderable;

export interface Tesseract4ComponentOptions extends Tesseract4RuntimeRenderableOptions {
  createRenderable?: Tesseract4RuntimeRenderableFactory;
}

export class Tesseract4Component implements Component, RuntimeWork {
  readonly id: string;
  readonly type = tesseract4ComponentType;
  readonly actor: Actor;
  enabled = true;
  readonly runtimeRenderable: Tesseract4RuntimeRenderable;
  readonly #sceneAttachments: RuntimeRegistration[] = [];

  constructor(actor: Actor, options: Tesseract4ComponentOptions = {}) {
    this.actor = actor;
    this.runtimeRenderable = (options.createRenderable ?? ((objectOptions) => new Tesseract4RuntimeRenderable(objectOptions)))(options);
    this.id = this.runtimeRenderable.id;
  }

  updateRuntimeFrame(frame: RuntimeFrame): void {
    this.runtimeRenderable.updateRuntimeFrame(frame);
  }

  attachToScene(scene: RuntimeSceneObjectHost): RuntimeRegistration {
    const registration = this.runtimeRenderable.attachToScene(scene);
    this.#sceneAttachments.push(registration);
    return {
      dispose: () => {
        const index = this.#sceneAttachments.indexOf(registration);
        if (index >= 0) {
          this.#sceneAttachments.splice(index, 1);
        }
        registration.dispose();
      }
    };
  }

  dispose(): void {
    this.enabled = false;
    for (const registration of [...this.#sceneAttachments].reverse()) {
      registration.dispose();
    }
    this.#sceneAttachments.length = 0;
    this.runtimeRenderable.dispose();
  }
}

import type { RuntimeFrame, RuntimeWorldDescriptor } from "runtime-core";
import { RuntimeThreeLineRenderable, type RuntimeThreeSceneRenderOutput } from "runtime-three";
import { Tesseract4RuntimeWorld, type Tesseract4RuntimeWorldOptions } from "../runtime/tesseract4-runtime-world";
import type { RuntimeRegistration } from "../runtime/ports";

export interface Tesseract4RuntimeRenderableOptions extends Tesseract4RuntimeWorldOptions {}

export class Tesseract4RuntimeRenderable {
  readonly id: string;
  readonly world: Tesseract4RuntimeWorld;
  readonly #renderable: RuntimeThreeLineRenderable;

  constructor(options: Tesseract4RuntimeRenderableOptions = {}) {
    this.id = options.id ?? "tesseract4";
    this.world = new Tesseract4RuntimeWorld(options);
    this.#renderable = new RuntimeThreeLineRenderable({
      id: this.world.id,
      maxSegmentCount: this.world.maxSegmentCount,
      adapterOptions: { boundsMode: "none" }
    });
  }

  get worldDescriptor(): RuntimeWorldDescriptor {
    return this.world.descriptor;
  }

  updateRuntimeFrame(frame: RuntimeFrame): void {
    this.#renderable.update(this.world.updateRuntimeFrame(frame));
  }

  attachToOutput(output: RuntimeThreeSceneRenderOutput): RuntimeRegistration {
    return output.attachObject(this.#renderable.object);
  }

  dispose(): void {
    this.#renderable.dispose();
  }
}

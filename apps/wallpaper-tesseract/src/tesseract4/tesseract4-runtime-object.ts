import * as THREE from "three";
import type { RuntimeWorldDescriptor } from "runtime-core";
import { RuntimeThreeLineRenderable } from "runtime-three";
import { Tesseract4RuntimeWorld, type Tesseract4RuntimeWorldOptions } from "../runtime/tesseract4-runtime-world";
import type { RuntimeObject, UpdateFrame } from "../runtime/ports";

export interface Tesseract4RuntimeObjectOptions extends Tesseract4RuntimeWorldOptions {}

export class Tesseract4RuntimeObject implements RuntimeObject {
  readonly id: string;
  readonly priority = 0;
  enabled = true;
  readonly object: THREE.LineSegments;
  readonly world: Tesseract4RuntimeWorld;
  private readonly renderable: RuntimeThreeLineRenderable;

  constructor(options: Tesseract4RuntimeObjectOptions = {}) {
    this.id = options.id ?? "tesseract4";
    this.world = new Tesseract4RuntimeWorld(options);
    this.renderable = new RuntimeThreeLineRenderable({
      id: this.world.id,
      maxSegmentCount: this.world.maxSegmentCount,
      adapterOptions: { boundsMode: "none" }
    });
    this.object = this.renderable.object;
  }

  get worldDescriptor(): RuntimeWorldDescriptor {
    return this.world.descriptor;
  }

  updateFrame(frame: UpdateFrame): void {
    this.renderable.update(this.world.updateRuntimeFrame(frame));
  }

  dispose(): void {
    this.renderable.dispose();
  }
}

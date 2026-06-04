import type * as THREE from "three";
import type { Actor, Component, ComponentType } from "../../actor-runtime";
import type { SceneFrame } from "../../scene-runtime";
import {
  Tesseract4RuntimeObject,
  type Tesseract4RuntimeObjectOptions
} from "../tesseract4-runtime-object";

export const tesseract4ComponentType =
  "tesseract4-component" as ComponentType<Tesseract4Component>;

export type Tesseract4RuntimeObjectFactory =
  (options: Tesseract4RuntimeObjectOptions) => Tesseract4RuntimeObject;

export interface Tesseract4ComponentOptions extends Tesseract4RuntimeObjectOptions {
  createObject?: Tesseract4RuntimeObjectFactory;
  scene?: THREE.Scene;
}

export class Tesseract4Component implements Component {
  readonly id: string;
  readonly type = tesseract4ComponentType;
  readonly actor: Actor;
  enabled = true;
  readonly runtimeObject: Tesseract4RuntimeObject;
  readonly #scene: THREE.Scene | null;

  constructor(actor: Actor, options: Tesseract4ComponentOptions = {}) {
    this.actor = actor;
    this.#scene = options.scene ?? null;
    this.runtimeObject = (options.createObject ?? ((objectOptions) => new Tesseract4RuntimeObject(objectOptions)))(options);
    this.id = this.runtimeObject.id;
    this.#scene?.add(this.object);
  }

  get object(): THREE.LineSegments {
    return this.runtimeObject.object;
  }

  updateFrame(frame: SceneFrame): void {
    this.runtimeObject.updateFrame(frame);
  }

  dispose(): void {
    this.enabled = false;
    this.#scene?.remove(this.object);
    this.runtimeObject.dispose();
  }
}

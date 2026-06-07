import * as THREE from "three";
import { Camera4D, CPUProjector4D, createTesseract4D } from "four-camera";
import { ThreeLineAdapter } from "four-camera-three";
import {
  identityTransform4D,
  multiplyTransform4D,
  rotateXU,
  rotateYZ,
  rotateZU
} from "four-rotation";
import type { RuntimeObject, UpdateFrame } from "../runtime/ports";

export interface Tesseract4RuntimeObjectOptions {
  id?: string;
  size?: number;
}

export class Tesseract4RuntimeObject implements RuntimeObject {
  readonly id: string;
  readonly priority = 0;
  enabled = true;
  readonly object: THREE.LineSegments;
  private readonly geometry4;
  private readonly camera4: Camera4D;
  private readonly projector: CPUProjector4D;
  private readonly lineResult;
  private readonly lineAdapter: ThreeLineAdapter;
  private readonly rXU = identityTransform4D();
  private readonly rYZ = identityTransform4D();
  private readonly rZU = identityTransform4D();
  private readonly tmp = identityTransform4D();
  private readonly model4 = identityTransform4D();

  constructor(options: Tesseract4RuntimeObjectOptions = {}) {
    this.id = options.id ?? "tesseract4";
    this.geometry4 = createTesseract4D({ size: options.size ?? 2 });
    this.camera4 = new Camera4D({
      position: [0, 0, 0, -5.5],
      focalScale: [1.45, 1.45, 1.45],
      near: 0.05,
      far: 20,
      viewBoxScale: [2.4, 2.4, 2.4]
    });
    this.projector = new CPUProjector4D({ clipping: "near-far" });
    this.lineResult = this.projector.createLineResult(this.geometry4);
    this.lineAdapter = new ThreeLineAdapter({
      maxSegmentCount: this.geometry4.edgeCount ?? 0,
      boundsMode: "none"
    });
    this.object = this.lineAdapter.object;
  }

  updateFrame(frame: UpdateFrame): void {
    const t = frame.timeMs * 0.001;
    rotateXU(t * 0.45, this.rXU);
    rotateYZ(t * 0.31, this.rYZ);
    rotateZU(t * 0.22, this.rZU);
    multiplyTransform4D(this.rYZ, this.rXU, this.tmp);
    multiplyTransform4D(this.rZU, this.tmp, this.model4);

    this.projector.projectLines({
      geometry: this.geometry4,
      model: this.model4,
      camera: this.camera4,
      out: this.lineResult
    });
    this.lineAdapter.update(this.lineResult);
  }

  dispose(): void {
    this.lineAdapter.dispose();
  }
}

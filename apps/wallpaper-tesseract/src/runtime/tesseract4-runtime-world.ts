import {
  Camera4D,
  CPUProjector4D,
  createTesseract4D,
  type LineProjectionResult
} from "four-camera";
import {
  identityTransform4D,
  multiplyTransform4D,
  rotateXU,
  rotateYZ,
  rotateZU
} from "four-rotation";
import {
  runtimeWorldId,
  type RuntimeFrame,
  type RuntimeWorldDescriptor,
  type RuntimeWorldId
} from "runtime-core";

export interface Tesseract4RuntimeWorldOptions {
  readonly id?: string;
  readonly worldId?: RuntimeWorldId | string;
  readonly label?: string;
  readonly size?: number;
}

export class Tesseract4RuntimeWorld {
  readonly id: RuntimeWorldId;
  readonly descriptor: RuntimeWorldDescriptor;
  readonly maxSegmentCount: number;
  readonly #geometry4;
  readonly #camera4: Camera4D;
  readonly #projector: CPUProjector4D;
  readonly #lineResult: LineProjectionResult;
  readonly #rXU = identityTransform4D();
  readonly #rYZ = identityTransform4D();
  readonly #rZU = identityTransform4D();
  readonly #tmp = identityTransform4D();
  readonly #model4 = identityTransform4D();

  constructor(options: Tesseract4RuntimeWorldOptions = {}) {
    this.id = normalizeWorldId(options.worldId ?? options.id ?? "tesseract4-world");
    this.descriptor = {
      id: this.id,
      kind: "world-4d",
      label: options.label ?? "Tesseract4"
    };
    this.#geometry4 = createTesseract4D({ size: options.size ?? 2 });
    this.maxSegmentCount = this.#geometry4.edgeCount ?? 0;
    this.#camera4 = new Camera4D({
      position: [0, 0, 0, -5.5],
      focalScale: [1.45, 1.45, 1.45],
      near: 0.05,
      far: 20,
      viewBoxScale: [2.4, 2.4, 2.4]
    });
    this.#projector = new CPUProjector4D({ clipping: "near-far" });
    this.#lineResult = this.#projector.createLineResult(this.#geometry4);
  }

  get lineProjection(): LineProjectionResult {
    return this.#lineResult;
  }

  updateRuntimeFrame(frame: RuntimeFrame): LineProjectionResult {
    const t = frame.timeMs * 0.001;
    rotateXU(t * 0.45, this.#rXU);
    rotateYZ(t * 0.31, this.#rYZ);
    rotateZU(t * 0.22, this.#rZU);
    multiplyTransform4D(this.#rYZ, this.#rXU, this.#tmp);
    multiplyTransform4D(this.#rZU, this.#tmp, this.#model4);

    return this.#projector.projectLines({
      geometry: this.#geometry4,
      model: this.#model4,
      camera: this.#camera4,
      out: this.#lineResult
    });
  }
}

function normalizeWorldId(id: RuntimeWorldId | string): RuntimeWorldId {
  return typeof id === "string" ? runtimeWorldId(id) : id;
}

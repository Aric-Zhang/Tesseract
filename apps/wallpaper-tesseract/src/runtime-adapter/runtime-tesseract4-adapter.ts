import {
  runtimeWorldId,
  type RuntimeWorldDescriptor,
  type RuntimeWorldId
} from "runtime-core";
import type { Tesseract4RuntimeObjectOptions } from "../tesseract4";

export interface Tesseract4RuntimeWorldAdapterOptions extends Tesseract4RuntimeObjectOptions {
  readonly worldId?: RuntimeWorldId | string;
  readonly label?: string;
}

// Phase 4D bridge. Delete once Tesseract4 is a native runtime world producer.
export function createTesseract4RuntimeWorldDescriptor(
  options: Tesseract4RuntimeWorldAdapterOptions = {}
): RuntimeWorldDescriptor {
  return {
    id: typeof options.worldId === "string"
      ? runtimeWorldId(options.worldId)
      : options.worldId ?? runtimeWorldId(options.id ?? "tesseract4-world"),
    kind: "world-4d",
    label: options.label ?? "Tesseract4"
  };
}


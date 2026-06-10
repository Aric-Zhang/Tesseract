import { describe, expect, it } from "vitest";
import { runtimeWorldId } from "runtime-core";
import { createTesseract4RuntimeWorldDescriptor } from "./runtime-tesseract4-adapter";

describe("runtime Tesseract4 adapter", () => {
  it("maps existing Tesseract runtime options to a renderer-agnostic 4D world descriptor", () => {
    expect(createTesseract4RuntimeWorldDescriptor({
      id: "tesseract-object",
      label: "Main Tesseract"
    })).toEqual({
      id: runtimeWorldId("tesseract-object"),
      kind: "world-4d",
      label: "Main Tesseract"
    });
  });

  it("accepts an explicit runtime world id so actor/runtime ids do not need to match", () => {
    expect(createTesseract4RuntimeWorldDescriptor({
      id: "legacy-object",
      worldId: runtimeWorldId("world:main")
    })).toMatchObject({
      id: runtimeWorldId("world:main"),
      kind: "world-4d"
    });
  });
});


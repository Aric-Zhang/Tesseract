import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createRuntimeSceneRenderOutput } from "../runtime/scene-render-output";
import { Tesseract4RuntimeRenderable } from "./tesseract4-runtime-renderable";

describe("Tesseract4RuntimeRenderable", () => {
  it("owns a headless runtime world descriptor", () => {
    const tesseract = new Tesseract4RuntimeRenderable({
      id: "tesseract4",
      label: "Tesseract 4D"
    });

    expect(tesseract.id).toBe("tesseract4");
    expect(tesseract.worldDescriptor).toMatchObject({
      kind: "world-4d",
      label: "Tesseract 4D"
    });
  });

  it("updates the runtime-three renderable from runtime frame data", () => {
    const tesseract = new Tesseract4RuntimeRenderable();
    const renderCalls: THREE.Scene[] = [];
    const output = createRuntimeSceneRenderOutput({
      createRenderer: () => ({
        domElement: {} as HTMLElement,
        setClearColor() {},
        setPixelRatio() {},
        setSize() {},
        render(scene) {
          renderCalls.push(scene);
        },
        dispose() {}
      })
    });
    const registration = tesseract.attachToOutput(output);
    output.render(new THREE.PerspectiveCamera());
    const [object] = renderCalls[0]?.children ?? [];
    if (!(object instanceof THREE.LineSegments)) {
      throw new Error("Expected runtime-three line renderable.");
    }

    tesseract.updateRuntimeFrame({ timeMs: 1000, deltaMs: 16, frameIndex: 1 });

    expect(object.geometry.drawRange.count).toBeGreaterThan(0);
    expect(object.frustumCulled).toBe(false);

    registration.dispose();
    output.render(new THREE.PerspectiveCamera());
    expect(renderCalls.at(-1)?.children).not.toContain(object);
    tesseract.dispose();
    output.dispose();
  });
});

import { describe, expect, it } from "vitest";
import {
  createRuntimeThreeSceneRenderOutput,
  type RuntimeThreeSceneRenderer
} from "runtime-three";
import { Tesseract4RuntimeRenderable } from "./tesseract4-runtime-renderable";

describe("Tesseract4RuntimeRenderable", () => {
  it("attaches through the runtime Scene object host", () => {
    const calls: string[] = [];
    const tesseract = new Tesseract4RuntimeRenderable();
    const renderOutput = createRuntimeThreeSceneRenderOutput({
      createRenderer: () => ({
        domElement: {} as RuntimeThreeSceneRenderer["domElement"],
        setClearColor() {},
        setPixelRatio() {},
        setSize() {},
        render(scene) {
          calls.push(`render:${scene.children.length}`);
        },
        dispose() {}
      })
    });

    const registration = tesseract.attachToScene(renderOutput);
    renderOutput.render({} as never);
    registration.dispose();
    renderOutput.render({} as never);

    expect(calls).toEqual(["render:1", "render:0"]);
  });
});

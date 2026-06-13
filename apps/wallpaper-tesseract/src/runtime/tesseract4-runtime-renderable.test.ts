import { describe, expect, it } from "vitest";
import { createRuntimeSceneSession } from "./runtime-scene-session";
import { Tesseract4RuntimeRenderable } from "./tesseract4-runtime-renderable";

describe("Tesseract4RuntimeRenderable", () => {
  it("attaches through the runtime Scene object host", () => {
    const calls: string[] = [];
    const tesseract = new Tesseract4RuntimeRenderable();
    const session = createRuntimeSceneSession({
      createRenderer: () => ({
        domElement: {} as HTMLElement,
        setClearColor() {},
        setPixelRatio() {},
        setSize() {},
        render(scene) {
          calls.push(`render:${scene.children.length}`);
        },
        dispose() {}
      })
    });

    const registration = tesseract.attachToScene(session);
    session.render({} as never);
    registration.dispose();
    session.render({} as never);

    expect(calls).toEqual(["render:1", "render:0"]);
  });
});

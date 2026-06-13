import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { RuntimeThreeSceneRenderer } from "runtime-three";
import { createRuntimeSceneSession } from "./runtime-scene-session";

describe("RuntimeSceneSession", () => {
  it("owns render output creation and disposal", () => {
    const calls: string[] = [];
    const session = createRuntimeSceneSession({
      id: "scene",
      createRenderer: () => createRenderer(calls)
    });

    session.render(new THREE.PerspectiveCamera());
    session.dispose();
    session.render(new THREE.PerspectiveCamera());

    expect(session.renderTarget).toBe(session.renderOutput);
    expect(calls).toEqual([
      "clear:461069:1",
      "render",
      "dispose"
    ]);
  });
});

function createRenderer(calls: string[]): RuntimeThreeSceneRenderer {
  return {
    domElement: {} as HTMLElement,
    setClearColor(color, alpha) {
      calls.push(`clear:${color}:${alpha}`);
    },
    setPixelRatio() {},
    setSize() {},
    render() {
      calls.push("render");
    },
    dispose() {
      calls.push("dispose");
    }
  };
}

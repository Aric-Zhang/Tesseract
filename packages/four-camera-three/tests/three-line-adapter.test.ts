import * as THREE from "three";
import { createBounds3, type LineProjectionResult } from "four-camera";
import { ThreeLineAdapter } from "../src";

function createLineResult(segmentCount: number): LineProjectionResult {
  return {
    positions3: new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      1, 1, 0
    ]),
    depths4: new Float32Array([1, 1, 2, 2]),
    segmentCount,
    bounds3: createBounds3()
  };
}

describe("ThreeLineAdapter", () => {
  it("updates a preallocated LineSegments geometry", () => {
    const adapter = new ThreeLineAdapter({ maxSegmentCount: 2 });
    const result = createLineResult(2);

    adapter.update(result);

    expect(adapter.object).toBeInstanceOf(THREE.LineSegments);
    expect(adapter.object.frustumCulled).toBe(false);
    expect(adapter.geometry.drawRange.count).toBe(4);
    const position = adapter.geometry.getAttribute("position") as THREE.BufferAttribute;
    expect(position.array[0]).toBe(0);
    expect(position.array[3]).toBe(1);

    adapter.dispose();
  });

  it("requires vertexColors to be enabled before consuming colors", () => {
    const adapter = new ThreeLineAdapter({ maxSegmentCount: 1 });
    const result = createLineResult(1);
    result.colors = new Float32Array(6);

    expect(() => adapter.update(result)).toThrow(/vertexColors/);
    adapter.dispose();
  });

  it("copies color buffers when vertexColors is enabled", () => {
    const adapter = new ThreeLineAdapter({ maxSegmentCount: 1, vertexColors: true });
    const result = createLineResult(1);
    result.colors = new Float32Array([1, 0, 0, 0, 1, 0]);

    adapter.update(result);

    const color = adapter.geometry.getAttribute("color") as THREE.BufferAttribute;
    expect(color.array[0]).toBe(1);
    expect(color.array[4]).toBe(1);
    adapter.dispose();
  });
});

import { clipSegmentByURange, clipSegmentNearFar } from "../src";

describe("4D edge clipping helpers", () => {
  it("keeps segments already inside the range", () => {
    expect(clipSegmentNearFar(2, 3, 1, 4)).toEqual({ t0: 0, t1: 1 });
  });

  it("rejects segments outside the range", () => {
    expect(clipSegmentNearFar(0, 0.5, 1, 4)).toBeNull();
    expect(clipSegmentNearFar(5, 6, 1, 4)).toBeNull();
  });

  it("clips segments crossing near and far planes", () => {
    const clip = clipSegmentNearFar(0, 4, 1, 3);
    expect(clip?.t0).toBeCloseTo(0.25, 5);
    expect(clip?.t1).toBeCloseTo(0.75, 5);
  });

  it("clips to a singularity-only lower bound", () => {
    const clip = clipSegmentByURange(0, 2, 1);
    expect(clip?.t0).toBeCloseTo(0.5, 5);
    expect(clip?.t1).toBe(1);
  });
});

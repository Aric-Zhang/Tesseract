import { mat4Index } from "../src";

describe("conventions", () => {
  it("uses column-major mat4 indices", () => {
    expect(mat4Index(0, 0)).toBe(0);
    expect(mat4Index(1, 0)).toBe(1);
    expect(mat4Index(0, 1)).toBe(4);
    expect(mat4Index(3, 3)).toBe(15);
  });
});


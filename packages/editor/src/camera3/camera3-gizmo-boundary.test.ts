import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Camera3Gizmo control boundary", () => {
  it("submits camera commands instead of directly mutating Camera3Rig", () => {
    const source = readFileSync(new URL("./camera3-gizmo.ts", import.meta.url), "utf8");

    expect(source).not.toContain("Camera3Rig");
    expect(source).not.toMatch(/\.orbit\(/);
    expect(source).not.toMatch(/\.snapToAxis\(/);
    expect(source).not.toMatch(/\.updateCamera\(/);
    expect(source).not.toMatch(/\.toggle\(/);
    expect(source).toContain("commandSink.submit");
  });
});

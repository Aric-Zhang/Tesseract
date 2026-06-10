import { describe, expect, it } from "vitest";
import { runtimeWorldId } from "./runtime-id";
import { RuntimeWorldRegistry } from "./runtime-world";

describe("RuntimeWorldRegistry", () => {
  it("tracks multiple worlds without global singleton state", () => {
    const registry = new RuntimeWorldRegistry();
    registry.add({ id: runtimeWorldId("world-4d:a"), kind: "world-4d" });
    registry.add({ id: runtimeWorldId("world-4d:b"), kind: "world-4d" });
    registry.add({ id: runtimeWorldId("world-3d:a"), kind: "world-3d" });

    expect(registry.list().map((world) => world.id)).toEqual([
      "world-4d:a",
      "world-4d:b",
      "world-3d:a"
    ]);
    expect(() => registry.add({ id: runtimeWorldId("world-4d:a"), kind: "world-4d" })).toThrow(/already contains/);
  });
});

import { describe, expect, it } from "vitest";
import { createStaticHierarchyObjectSource } from "./hierarchy-object-source";

describe("HierarchyObjectSource", () => {
  it("returns object snapshots with parentId preserved", () => {
    const source = createStaticHierarchyObjectSource([
      { id: "root", label: "Root" },
      { id: "child", label: "Child", parentId: "root" }
    ]);

    expect(source.listObjects()).toEqual([
      { id: "root", label: "Root" },
      { id: "child", label: "Child", parentId: "root" }
    ]);
  });

  it("does not expose mutable internal item references", () => {
    const source = createStaticHierarchyObjectSource([
      { id: "camera", label: "Camera3" }
    ]);
    const first = source.listObjects();
    (first as unknown as Array<{ label: string }>)[0].label = "Changed";

    expect(source.listObjects()).toEqual([
      { id: "camera", label: "Camera3" }
    ]);
  });
});

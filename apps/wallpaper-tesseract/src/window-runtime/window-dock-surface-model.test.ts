import { describe, expect, it } from "vitest";
import { WindowDockSurfaceModel } from "./window-dock-surface-model";

describe("WindowDockSurfaceModel", () => {
  it("tracks tabs, active tab, and runtime root", () => {
    const model = new WindowDockSurfaceModel({
      tabs: [{ viewActorId: "debug-view", viewKey: "debug", title: "Debug" }]
    });

    expect(model.focusedViewActorId).toBe("debug-view");
    expect(model.listActiveViewActorIds()).toEqual(["debug-view"]);
    expect(model.getRuntimeDockRoot()).toMatchObject({
      kind: "tabset",
      tabs: ["debug-view"],
      activeViewActorId: "debug-view"
    });

    const add = model.addTab(
      { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" },
      { active: true }
    );

    expect(add.activeViewActorChanged).toBe(true);
    expect(model.focusedViewActorId).toBe("hierarchy-view");
    expect(model.listActiveViewActorIds()).toEqual(["hierarchy-view"]);
    expect(model.listTabs().map((tab) => tab.viewActorId)).toEqual(["debug-view", "hierarchy-view"]);
  });

  it("splits tabs and reports the tabsets", () => {
    const model = new WindowDockSurfaceModel({
      tabs: [{ viewActorId: "debug-view", viewKey: "debug", title: "Debug" }]
    });
    const targetTabsetId = model.getRuntimeDockRoot().id;

    model.splitTab(
      { viewActorId: "scene-view", viewKey: "scene", title: "Scene" },
      { targetTabsetId, placement: "left", active: true }
    );

    const root = model.getRuntimeDockRoot();
    expect(root.kind).toBe("split");
    expect(model.isViewActorIdActiveInItsTabset("scene-view")).toBe(true);
    expect(model.findTabsetContaining("debug-view")).toBeTruthy();
    expect(model.findTabsetContaining("scene-view")).toBeTruthy();
  });

  it("removes tabs and collapses to an empty tabset when the last tab is removed", () => {
    const model = new WindowDockSurfaceModel({
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ],
      activeViewActorId: "hierarchy-view"
    });

    expect(model.removeTab("hierarchy-view")).toBe(true);
    expect(model.focusedViewActorId).toBe("debug-view");
    expect(model.removeTab("debug-view")).toBe(true);

    expect(model.listTabs()).toEqual([]);
    expect(model.focusedViewActorId).toBeNull();
    expect(model.getRuntimeDockRoot()).toMatchObject({
      kind: "tabset",
      tabs: [],
      activeViewActorId: null
    });
  });

  it("keeps split tabset active state independent from focused view", () => {
    const model = new WindowDockSurfaceModel({
      tabs: [{ viewActorId: "debug-view", viewKey: "debug", title: "Debug" }]
    });
    const targetTabsetId = model.getRuntimeDockRoot().id;
    model.splitTab(
      { viewActorId: "scene-view", viewKey: "scene", title: "Scene" },
      { targetTabsetId, placement: "right", active: true }
    );
    const root = model.getRuntimeDockRoot();
    if (root.kind !== "split" || root.second.kind !== "tabset") {
      throw new Error("Expected split with target tabset.");
    }
    model.addTab(
      { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" },
      { targetTabsetId: root.second.id, active: false }
    );

    expect([...model.listActiveViewActorIds()].sort()).toEqual(["debug-view", "scene-view"]);
    expect(model.focusedViewActorId).toBe("scene-view");

    model.activateTab("hierarchy-view");

    expect(model.isViewActorIdActiveInItsTabset("hierarchy-view")).toBe(true);
    expect(model.isViewActorIdActiveInItsTabset("scene-view")).toBe(false);
    expect(model.isViewActorIdActiveInItsTabset("debug-view")).toBe(true);
    expect([...model.listActiveViewActorIds()].sort()).toEqual(["debug-view", "hierarchy-view"]);
    expect(model.focusedViewActorId).toBe("hierarchy-view");
  });
});

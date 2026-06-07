import { describe, expect, it } from "vitest";
import { createBrowserWindowWorkspaceFrameLayoutStorage } from "./browser-window-workspace-layout-storage";
import type { WindowWorkspaceFrameLayoutStorage } from "../../window-runtime";

describe("createBrowserWindowWorkspaceFrameLayoutStorage", () => {
  it("uses localStorage when it is available", () => {
    const localStorage = createMemoryStorage();
    const target = {
      localStorage,
      name: ""
    };

    const storage = createBrowserWindowWorkspaceFrameLayoutStorage(target);

    storage?.setItem("layout", "local");
    expect(localStorage.getItem("layout")).toBe("local");
    expect(target.name).toBe("");
  });

  it("falls back to window.name storage when Web Storage is unavailable", () => {
    const target = { name: "" };
    const storage = createBrowserWindowWorkspaceFrameLayoutStorage(target);

    storage?.setItem("layout", "persisted");

    expect(storage?.getItem("layout")).toBe("persisted");
    expect(target.name).toContain("wallpaper-tesseract.windowWorkspaceLayoutStorage");
    expect(createBrowserWindowWorkspaceFrameLayoutStorage(target)?.getItem("layout"))
      .toBe("persisted");
  });

  it("resets selected keys before returning browser storage", () => {
    const localStorage = createMemoryStorage();
    localStorage.setItem("layout", "old");
    localStorage.setItem("other", "kept");

    const storage = createBrowserWindowWorkspaceFrameLayoutStorage(
      { localStorage, name: "" },
      { resetKeys: ["layout"] }
    );

    expect(storage?.getItem("layout")).toBeNull();
    expect(storage?.getItem("other")).toBe("kept");
    storage?.setItem("layout", "new");
    expect(localStorage.getItem("layout")).toBe("new");
  });

  it("resets selected keys in the window.name fallback store", () => {
    const target = { name: "" };
    const firstStorage = createBrowserWindowWorkspaceFrameLayoutStorage(target);
    firstStorage?.setItem("layout", "old");
    firstStorage?.setItem("other", "kept");

    const storage = createBrowserWindowWorkspaceFrameLayoutStorage(
      target,
      { resetKeys: ["layout"] }
    );

    expect(storage?.getItem("layout")).toBeNull();
    expect(storage?.getItem("other")).toBe("kept");
  });

  it("falls back to window.name when storage accessors throw", () => {
    const target = {
      get localStorage(): WindowWorkspaceFrameLayoutStorage {
        throw new Error("storage blocked");
      },
      get sessionStorage(): WindowWorkspaceFrameLayoutStorage {
        throw new Error("storage blocked");
      },
      name: ""
    };

    const storage = createBrowserWindowWorkspaceFrameLayoutStorage(target);

    storage?.setItem("layout", "fallback");
    expect(storage?.getItem("layout")).toBe("fallback");
  });

  it("treats malformed window.name data as an empty namespaced store", () => {
    const target = { name: "not json" };
    const storage = createBrowserWindowWorkspaceFrameLayoutStorage(target);

    expect(storage?.getItem("layout")).toBeNull();
    storage?.setItem("layout", "new");
    expect(storage?.getItem("layout")).toBe("new");
  });
});

function createMemoryStorage(): WindowWorkspaceFrameLayoutStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

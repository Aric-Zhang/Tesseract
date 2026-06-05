import { describe, expect, it } from "vitest";
import { createWindowWorkspaceFrameLayout } from "./window-workspace-layout";
import {
  loadPersistedWindowWorkspaceFrameLayout,
  WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY,
  WindowWorkspaceFrameLayoutPersistenceController,
  type WindowWorkspaceFrameLayoutStorage
} from "./window-workspace-layout-persistence-controller";

describe("WindowWorkspaceFrameLayoutPersistenceController", () => {
  it("persists layout snapshots only when the serialized logical layout changes", () => {
    const storage = createStorage();
    let offset = 0;
    const controller = new WindowWorkspaceFrameLayoutPersistenceController({
      storage,
      source: {
        createFrameLayoutSnapshot: () => createWindowWorkspaceFrameLayout({
          views: [{ viewKey: "debug", actorId: `debug-view-${offset}`, title: "Debug Log" }],
          frames: [{
            frameId: `debug-frame-${offset}`,
            bounds: {
              position: { x: offset, y: 20 },
              size: { x: 300, y: 180 },
              visible: true
            },
            presentation: "windowed",
            root: {
              kind: "tabset",
              id: "debug-tabset",
              tabs: ["debug"],
              activeTabId: "debug"
            }
          }]
        })
      }
    });

    expect(controller.persistNow()).toBe(true);
    expect(controller.persistNow()).toBe(false);
    offset = 10;
    expect(controller.persistNow()).toBe(true);

    expect(storage.setCalls).toHaveLength(2);
    const persisted = loadPersistedWindowWorkspaceFrameLayout(storage);
    expect(persisted?.frames[0]?.bounds.position.x).toBe(10);
    expect(JSON.stringify(persisted)).not.toContain("debug-view-10");
  });

  it("is a no-op without storage and reports snapshot/storage failures", () => {
    const errors: unknown[] = [];
    const controller = new WindowWorkspaceFrameLayoutPersistenceController({
      storage: null,
      source: {
        createFrameLayoutSnapshot: () => {
          throw new Error("not called");
        }
      },
      onError: (error) => errors.push(error)
    });

    expect(controller.persistNow()).toBe(false);
    expect(errors).toEqual([]);

    const failingController = new WindowWorkspaceFrameLayoutPersistenceController({
      storage: createStorage({ throwOnSet: true }),
      source: {
        createFrameLayoutSnapshot: () => createWindowWorkspaceFrameLayout({
          views: [{ viewKey: "debug", actorId: "debug-view", title: "Debug Log" }]
        })
      },
      onError: (error) => errors.push(error)
    });

    expect(failingController.persistNow()).toBe(false);
    expect(errors[0]).toBeInstanceOf(Error);
  });

  it("loads valid persisted layout and rejects malformed storage values", () => {
    const storage = createStorage();
    storage.setItem(WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY, "{ nope");
    expect(loadPersistedWindowWorkspaceFrameLayout(storage)).toBeNull();
    expect(storage.getItem(WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY)).toBe("{ nope");
    expect(storage.removeCalls).toEqual([]);

    storage.setItem(WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY, JSON.stringify({
      version: 999,
      views: [],
      frames: [],
      hiddenViewKeys: []
    }));
    expect(loadPersistedWindowWorkspaceFrameLayout(storage)).toBeNull();
    expect(storage.getItem(WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY)).toBe(JSON.stringify({
      version: 999,
      views: [],
      frames: [],
      hiddenViewKeys: []
    }));
    expect(storage.removeCalls).toEqual([]);
  });

  it("loads partially recoverable top-level-valid storage without cleaning the key", () => {
    const storage = createStorage();
    storage.setItem(WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY, JSON.stringify({
      version: 1,
      views: [
        { viewKey: "scene", title: "Scene" },
        { viewKey: "" }
      ],
      frames: [
        {
          frameId: "scene-frame",
          bounds: {
            position: { x: 10, y: 20 },
            size: { x: 500, y: 320 },
            visible: true
          },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "scene-tabset",
            tabs: ["scene"],
            activeTabId: "scene"
          }
        },
        {
          frameId: "",
          bounds: {
            position: { x: 0, y: 0 },
            size: { x: 100, y: 100 },
            visible: true
          },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "bad-frame",
            tabs: ["scene"],
            activeTabId: "scene"
          }
        }
      ],
      hiddenViewKeys: ["debug", ""]
    }));

    const loaded = loadPersistedWindowWorkspaceFrameLayout(storage);

    expect(loaded?.views.map((view) => view.viewKey)).toEqual(["scene"]);
    expect(loaded?.frames.map((frame) => frame.frameId)).toEqual(["scene-frame"]);
    expect(loaded?.hiddenViewKeys).toEqual(["debug"]);
    expect(storage.removeCalls).toEqual([]);
  });
});

function createStorage(options: { readonly throwOnSet?: boolean } = {}): WindowWorkspaceFrameLayoutStorage & {
  readonly setCalls: readonly string[];
  readonly removeCalls: readonly string[];
} {
  const values = new Map<string, string>();
  const setCalls: string[] = [];
  const removeCalls: string[] = [];
  return {
    setCalls,
    removeCalls,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (options.throwOnSet) throw new Error("set failed");
      setCalls.push(value);
      values.set(key, value);
    },
    removeItem: (key) => {
      removeCalls.push(key);
      values.delete(key);
    }
  };
}

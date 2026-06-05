import { describe, expect, it } from "vitest";
import { createWindowWorkspaceFrameLayout } from "./window-workspace-layout";
import {
  loadPersistedWindowWorkspaceFrameLayout,
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
    storage.setItem("wallpaper-tesseract.windowWorkspaceFrameLayout.v1", "{ nope");
    expect(loadPersistedWindowWorkspaceFrameLayout(storage)).toBeNull();

    storage.setItem("wallpaper-tesseract.windowWorkspaceFrameLayout.v1", JSON.stringify({
      version: 999,
      views: [],
      frames: [],
      hiddenViewKeys: []
    }));
    expect(loadPersistedWindowWorkspaceFrameLayout(storage)).toBeNull();
  });
});

function createStorage(options: { readonly throwOnSet?: boolean } = {}): WindowWorkspaceFrameLayoutStorage & {
  readonly setCalls: readonly string[];
} {
  const values = new Map<string, string>();
  const setCalls: string[] = [];
  return {
    setCalls,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (options.throwOnSet) throw new Error("set failed");
      setCalls.push(value);
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    }
  };
}

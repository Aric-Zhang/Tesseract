import { describe, expect, it } from "vitest";
import {
  createSingletonWindowViewIdentity,
  type WindowWorkspaceViewEntry
} from "../../window-runtime";
import { createWindowMenuItem, createWindowMenuItems } from "./app-menu-model";

function createViewEntry(options: {
  readonly viewKey: string;
  readonly viewActorId?: string | null;
  readonly ownerFrameActorId?: string | null;
  readonly label?: string;
  readonly order?: number;
  readonly sourceIndex?: number;
  readonly enabled?: boolean;
  readonly live?: boolean;
  readonly activeSelf?: boolean;
  readonly activeInHierarchy?: boolean;
}): WindowWorkspaceViewEntry {
  return {
    identity: createSingletonWindowViewIdentity(options.viewKey),
    viewKey: options.viewKey,
    viewActorId: options.viewActorId ?? null,
    ownerFrameActorId: options.ownerFrameActorId ?? null,
    label: options.label ?? options.viewKey,
    order: options.order ?? 0,
    sourceIndex: options.sourceIndex ?? 0,
    group: null,
    enabled: options.enabled ?? true,
    live: options.live ?? true,
    activeInFrame: options.activeSelf ?? true,
    visibleInFrame: true,
    ownerFrameVisible: true,
    ownerFrameActiveInHierarchy: options.activeInHierarchy ?? options.activeSelf ?? true,
    presentation: options.live === false ? null : "windowed"
  };
}

describe("app menu model", () => {
  it("maps live catalog entries to enabled open-view items", () => {
    const item = createWindowMenuItem(createViewEntry({
      viewKey: "debug",
      viewActorId: "debug-log-view",
      label: "Debug Log"
    }));

    expect(item).toEqual({
      kind: "open-view",
      id: "debug",
      viewKey: "debug",
      actorId: "debug-log-view",
      label: "Debug Log",
      enabled: true,
      live: true,
      leading: { kind: "none" }
    });
    expect("data" in item).toBe(false);
    expect("checked" in item).toBe(false);
  });

  it("maps factory-only entries as not-live open-view items", () => {
    const item = createWindowMenuItem(createViewEntry({
      viewKey: "hierarchy",
      viewActorId: null,
      label: "Hierarchy",
      live: false
    }));

    expect(item).toMatchObject({
      id: "hierarchy",
      viewKey: "hierarchy",
      actorId: null,
      label: "Hierarchy",
      enabled: true,
      live: false,
      leading: { kind: "none" }
    });
    expect("checked" in item).toBe(false);
  });

  it("uses catalog enabled state without deriving disabled from active state", () => {
    const disabled = createWindowMenuItem(createViewEntry({
      viewKey: "scene",
      viewActorId: "scene-view",
      label: "Scene",
      enabled: false
    }));
    const liveButInactive = createWindowMenuItem(createViewEntry({
      viewKey: "debug",
      viewActorId: "debug-log-view",
      label: "Debug Log",
      activeSelf: false,
      activeInHierarchy: false
    }));

    expect(disabled.enabled).toBe(false);
    expect(disabled.live).toBe(true);
    expect(liveButInactive.enabled).toBe(true);
    expect(liveButInactive.live).toBe(true);
  });

  it("orders menu items by catalog order and source index", () => {
    const items = createWindowMenuItems([
      createViewEntry({
        viewKey: "hierarchy",
        viewActorId: "hierarchy-view",
        label: "Hierarchy",
        order: 20,
        sourceIndex: 1
      }),
      createViewEntry({ viewKey: "scene", viewActorId: null, label: "Scene", order: 0, live: false }),
      createViewEntry({ viewKey: "debug", viewActorId: "debug-view", label: "Debug Log", order: 20, sourceIndex: 0 })
    ]);

    expect(items.map((item) => item.viewKey)).toEqual(["scene", "debug", "hierarchy"]);
    expect(items.map((item) => item.kind)).toEqual(["open-view", "open-view", "open-view"]);
  });

  it("uses viewKey as the menu action identity instead of frame actor ids", () => {
    const items = createWindowMenuItems([
      createViewEntry({
        viewKey: "scene",
        viewActorId: "scene-view-42",
        ownerFrameActorId: "scene-frame-runtime-42",
        label: "Scene"
      })
    ]);

    expect(items[0]).toMatchObject({
      kind: "open-view",
      id: "scene",
      viewKey: "scene",
      actorId: "scene-view-42"
    });
  });
});

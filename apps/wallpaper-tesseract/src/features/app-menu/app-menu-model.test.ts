import { describe, expect, it } from "vitest";
import {
  createWindowViewIdentity,
  createSingletonWindowViewIdentity,
  windowViewInstanceId,
  windowViewTypeKey,
  type WindowViewMultiplicity,
  type WindowViewTypeKey,
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
  readonly typeKey?: WindowViewTypeKey;
  readonly instanceId?: string;
  readonly multiplicity?: WindowViewMultiplicity;
  readonly activationSequence?: number;
}): WindowWorkspaceViewEntry {
  const typeKey = options.typeKey ?? windowViewTypeKey(options.viewKey);
  const instanceId = options.instanceId ? windowViewInstanceId(options.instanceId) : undefined;
  return {
    identity: options.typeKey || instanceId || options.multiplicity
      ? createWindowViewIdentity({
          viewKey: options.viewKey,
          typeKey,
          instanceId,
          multiplicity: options.multiplicity
        })
      : createSingletonWindowViewIdentity(options.viewKey),
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
    presentation: options.live === false ? null : "windowed",
    activationSequence: options.activationSequence ?? 0
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
      kind: "window-command",
      id: "type:debug",
      action: { kind: "open-or-focus-type", typeKey: "debug" },
      typeKey: "debug",
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
      id: "type:hierarchy",
      action: { kind: "open-or-focus-type", typeKey: "hierarchy" },
      typeKey: "hierarchy",
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
    expect(items.map((item) => item.kind)).toEqual(["window-command", "window-command", "window-command"]);
  });

  it("uses type action identity instead of frame actor ids", () => {
    const items = createWindowMenuItems([
      createViewEntry({
        viewKey: "scene",
        viewActorId: "scene-view-42",
        ownerFrameActorId: "scene-frame-runtime-42",
        label: "Scene"
      })
    ]);

    expect(items[0]).toMatchObject({
      kind: "window-command",
      id: "type:scene",
      action: { kind: "open-or-focus-type", typeKey: "scene" },
      viewKey: "scene",
      actorId: "scene-view-42"
    });
  });

  it("groups multi-instance entries by type and picks the most recently activated representative", () => {
    const inspectorType = windowViewTypeKey("inspector");
    const items = createWindowMenuItems([
      createViewEntry({
        viewKey: "inspector:a",
        typeKey: inspectorType,
        instanceId: "inspector:a",
        multiplicity: "multi-instance",
        viewActorId: "inspector-a-view",
        label: "Inspector",
        order: 30,
        activationSequence: 1
      }),
      createViewEntry({
        viewKey: "inspector:b",
        typeKey: inspectorType,
        instanceId: "inspector:b",
        multiplicity: "multi-instance",
        viewActorId: "inspector-b-view",
        label: "Inspector",
        order: 30,
        activationSequence: 4
      })
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "type:inspector",
      action: { kind: "open-or-focus-type", typeKey: "inspector" },
      viewKey: "inspector:b",
      actorId: "inspector-b-view"
    });
    expect(items[1]).toMatchObject({
      id: "new:inspector",
      action: { kind: "new-instance", typeKey: "inspector" },
      label: "New Inspector"
    });
  });
});

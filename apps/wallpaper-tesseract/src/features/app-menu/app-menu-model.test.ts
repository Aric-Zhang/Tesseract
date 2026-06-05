import { describe, expect, it } from "vitest";
import { ActorSystem } from "../../actor-runtime";
import { parameterPath, type ParameterPath } from "../../scene-runtime";
import type { WindowControlItem, WindowViewFactory } from "../../window-runtime";
import { createWindowMenuItem, createWindowMenuItems } from "./app-menu-model";

function createWindowItem(options: {
  readonly viewKey?: string;
  readonly actorId: string;
  readonly label?: string;
  readonly visible: boolean;
  readonly activeSelf?: boolean;
  readonly activeInHierarchy?: boolean;
  readonly canToggle?: boolean;
  readonly visiblePath?: ParameterPath<boolean>;
}): WindowControlItem {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: options.actorId, name: options.label ?? options.actorId });
  return {
    actor,
    viewKey: options.viewKey ?? options.actorId,
    actorId: options.actorId,
    componentId: `floating-window:${options.actorId}`,
    label: options.label ?? options.actorId,
    order: 0,
    group: null,
    visible: options.visible,
    activeSelf: options.activeSelf ?? true,
    activeInHierarchy: options.activeInHierarchy ?? options.activeSelf ?? true,
    activationMode: "visible",
    canToggle: options.canToggle ?? true,
    visiblePath: options.visiblePath ?? parameterPath<boolean>(`${options.actorId}.visible`)
  };
}

describe("app menu model", () => {
  it("maps visible windows to enabled open-view items", () => {
    const item = createWindowMenuItem(createWindowItem({
      viewKey: "debug",
      actorId: "debug-log-window",
      label: "Debug Log",
      visible: true
    }));

    expect(item).toEqual({
      kind: "open-view",
      id: "debug",
      viewKey: "debug",
      actorId: "debug-log-window",
      label: "Debug Log",
      enabled: true,
      live: true,
      leading: { kind: "none" }
    });
    expect("data" in item).toBe(false);
    expect("checked" in item).toBe(false);
  });

  it("maps hidden existing windows to open-view items without checkbox state", () => {
    const item = createWindowMenuItem(createWindowItem({
      actorId: "hierarchy-panel",
      label: "Hierarchy",
      visible: false
    }));

    expect(item.enabled).toBe(true);
    expect(item.live).toBe(true);
    expect(item.leading).toEqual({ kind: "none" });
    expect("checked" in item).toBe(false);
  });

  it("uses canToggle as disabled state without deriving disabled from active state", () => {
    const disabled = createWindowMenuItem(createWindowItem({
      actorId: "scene-window",
      label: "Scene",
      visible: true,
      canToggle: false
    }));
    const visibleButInactive = createWindowMenuItem(createWindowItem({
      actorId: "debug-log-window",
      label: "Debug Log",
      visible: true,
      activeSelf: false,
      activeInHierarchy: false
    }));

    expect(disabled.enabled).toBe(false);
    expect(disabled.live).toBe(true);
    expect(visibleButInactive.enabled).toBe(true);
    expect(visibleButInactive.live).toBe(true);
  });

  it("maps window items in source order", () => {
    const items = createWindowMenuItems([
      createWindowItem({ viewKey: "debug", actorId: "debug-log-window", label: "Debug Log", visible: true }),
      createWindowItem({ viewKey: "hierarchy", actorId: "hierarchy-panel", label: "Hierarchy", visible: false })
    ]);

    expect(items.map((item) => item.actorId)).toEqual(["debug-log-window", "hierarchy-panel"]);
    expect(items.map((item) => item.viewKey)).toEqual(["debug", "hierarchy"]);
    expect(items.map((item) => item.id)).toEqual(["debug", "hierarchy"]);
    expect(items.map((item) => item.kind)).toEqual(["open-view", "open-view"]);
  });

  it("adds missing registered factories as not-live open-view items", () => {
    const factories: WindowViewFactory[] = [
      {
        viewKey: "scene",
        label: "Scene",
        order: 0,
        create: () => {
          throw new Error("not used");
        }
      },
      {
        viewKey: "debug",
        label: "Debug Log",
        order: 10,
        create: () => {
          throw new Error("not used");
        }
      }
    ];

    const items = createWindowMenuItems([
      createWindowItem({ viewKey: "debug", actorId: "debug-log-window", label: "Debug Log", visible: true })
    ], { factories });

    expect(items).toMatchObject([
      {
        id: "scene",
        viewKey: "scene",
        actorId: null,
        label: "Scene",
        enabled: true,
        live: false
      },
      {
        id: "debug",
        viewKey: "debug",
        actorId: "debug-log-window",
        label: "Debug Log",
        enabled: true,
        live: true
      }
    ]);
  });

  it("derives live state from view existence instead of visible state", () => {
    const items = createWindowMenuItems([
      createWindowItem({
        viewKey: "debug",
        actorId: "debug-log-window",
        label: "Debug Log",
        visible: false
      })
    ]);

    expect(items[0]).toMatchObject({
      viewKey: "debug",
      actorId: "debug-log-window",
      live: true,
      enabled: true
    });
    expect("checked" in items[0]).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { ActorSystem } from "../../actor-runtime";
import { parameterPath, type ParameterPath } from "../../scene-runtime";
import type { WindowControlItem } from "../../window-runtime";
import { createWindowMenuItem, createWindowMenuItems } from "./app-menu-model";

function createWindowItem(options: {
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
  it("maps visible windows to checked enabled window toggle items", () => {
    const item = createWindowMenuItem(createWindowItem({
      actorId: "debug-log-window",
      label: "Debug Log",
      visible: true
    }));

    expect(item).toEqual({
      kind: "window-toggle",
      id: "debug-log-window",
      actorId: "debug-log-window",
      label: "Debug Log",
      enabled: true,
      checked: true,
      leading: { kind: "checkbox" }
    });
    expect("data" in item).toBe(false);
  });

  it("maps hidden windows to unchecked enabled window toggle items", () => {
    const item = createWindowMenuItem(createWindowItem({
      actorId: "hierarchy-panel",
      label: "Hierarchy",
      visible: false
    }));

    expect(item.checked).toBe(false);
    expect(item.enabled).toBe(true);
    expect(item.leading).toEqual({ kind: "checkbox" });
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
    expect(disabled.checked).toBe(true);
    expect(visibleButInactive.enabled).toBe(true);
    expect(visibleButInactive.checked).toBe(true);
  });

  it("maps window items in source order", () => {
    const items = createWindowMenuItems([
      createWindowItem({ actorId: "debug-log-window", label: "Debug Log", visible: true }),
      createWindowItem({ actorId: "hierarchy-panel", label: "Hierarchy", visible: false })
    ]);

    expect(items.map((item) => item.actorId)).toEqual(["debug-log-window", "hierarchy-panel"]);
    expect(items.map((item) => item.kind)).toEqual(["window-toggle", "window-toggle"]);
  });
});

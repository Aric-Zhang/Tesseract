import { describe, expect, it } from "vitest";
import {
  createWindowViewIdentity,
  createSingletonWindowViewIdentity,
  windowViewInstanceId,
  windowViewKey,
  windowViewTypeKey,
  type WindowViewMultiplicity,
  type WindowWorkspaceViewEntry
} from "../../window-runtime";
import { createWindowMenuItem, createWindowMenuItems } from "./window-menu-items";

function createViewEntry(options: {
  readonly viewKey: string;
  readonly viewActorId: string | null;
  readonly label: string;
  readonly order: number;
  readonly sourceIndex?: number;
  readonly enabled?: boolean;
  readonly live?: boolean;
  readonly typeKey?: string;
  readonly instanceId?: string;
  readonly multiplicity?: WindowViewMultiplicity;
  readonly activationSequence?: number;
}): WindowWorkspaceViewEntry {
  const typeKey = windowViewTypeKey(options.typeKey ?? options.viewKey);
  const instanceId = options.instanceId ? windowViewInstanceId(options.instanceId) : undefined;
  return {
    identity: options.typeKey || instanceId || options.multiplicity
      ? createWindowViewIdentity({
          viewKey: windowViewKey(options.viewKey),
          typeKey,
          instanceId,
          multiplicity: options.multiplicity
        })
      : createSingletonWindowViewIdentity(windowViewKey(options.viewKey)),
    viewKey: windowViewKey(options.viewKey),
    viewActorId: options.viewActorId,
    ownerFrameActorId: options.viewActorId ? `${options.viewKey}-frame` : null,
    label: options.label,
    order: options.order,
    sourceIndex: options.sourceIndex ?? options.order,
    group: null,
    enabled: options.enabled ?? true,
    live: options.live ?? true,
    activeInFrame: true,
    visibleInFrame: true,
    ownerFrameVisible: true,
    ownerFrameActiveInHierarchy: true,
    presentation: options.live === false ? null : "windowed",
    activationSequence: options.activationSequence ?? 0
  };
}

describe("window menu items", () => {
  it("maps a workspace view entry to a generic menu descriptor with app-local payload", () => {
    const item = createWindowMenuItem(createViewEntry({
      viewKey: "scene",
      viewActorId: "scene-view",
      label: "Scene",
      order: 0
    }));

    expect(item).toMatchObject({
      id: "type:scene",
      label: "Scene",
      enabled: true,
      leading: { kind: "none" },
      payload: {
        action: { kind: "open-or-focus-type", typeKey: "scene" },
        viewKey: "scene",
        actorId: "scene-view"
      }
    });
  });

  it("orders representative type rows and adds a new-instance command for multi-instance types", () => {
    const inspectorType = "inspector";
    const items = createWindowMenuItems([
      createViewEntry({
        viewKey: "debug",
        viewActorId: "debug-view",
        label: "Debug",
        order: 20
      }),
      createViewEntry({
        viewKey: "inspector:a",
        typeKey: inspectorType,
        instanceId: "inspector:a",
        multiplicity: "multi-instance",
        viewActorId: "inspector-a",
        label: "Inspector",
        order: 10,
        activationSequence: 1
      }),
      createViewEntry({
        viewKey: "inspector:b",
        typeKey: inspectorType,
        instanceId: "inspector:b",
        multiplicity: "multi-instance",
        viewActorId: "inspector-b",
        label: "Inspector",
        order: 10,
        activationSequence: 4
      })
    ]);

    expect(items.map((item) => item.id)).toEqual([
      "type:inspector",
      "new:inspector",
      "type:debug"
    ]);
    expect(items[0].payload?.actorId).toBe("inspector-b");
    expect(items[1]).toMatchObject({
      id: "new:inspector",
      label: "New Inspector",
      payload: {
        action: { kind: "new-instance", typeKey: "inspector" },
        viewKey: null,
        actorId: null
      }
    });
  });
});

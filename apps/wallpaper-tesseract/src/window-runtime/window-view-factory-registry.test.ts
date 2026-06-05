import { describe, expect, it } from "vitest";
import { ActorSystem } from "../actor-runtime";
import { WindowViewFactoryRegistry } from "./window-view-factory-registry";

describe("WindowViewFactoryRegistry", () => {
  it("registers factories by stable view key and disposes registrations", () => {
    const actorSystem = new ActorSystem();
    const registry = new WindowViewFactoryRegistry();
    const registration = registry.register({
      viewKey: "debug",
      label: "Debug Log",
      create: () => {
        const frameActor = actorSystem.createActor({ id: "debug-frame" });
        const viewActor = actorSystem.createActor({ id: "debug-view", parent: frameActor });
        return { frameActor, viewActor };
      }
    });

    const created = registry.create("debug", { reason: "menu" });

    expect(registry.list().map((factory) => factory.viewKey)).toEqual(["debug"]);
    expect(created.frameActor.id).toBe("debug-frame");
    expect(created.viewActor.id).toBe("debug-view");
    registration.dispose();
    expect(registry.get("debug")).toBeNull();
  });

  it("rejects duplicate and missing view keys", () => {
    const registry = new WindowViewFactoryRegistry();
    const factory = {
      viewKey: "debug",
      label: "Debug Log",
      create: () => {
        throw new Error("not used");
      }
    };

    registry.register(factory);

    expect(() => registry.register(factory)).toThrow(/already registered/);
    expect(() => registry.create("hierarchy", { reason: "menu" })).toThrow(/not registered/);
  });
});

import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-system/core";

import { createActorSystemInspectorActorDisplaySource } from "./inspector-actor-display-source";

describe("InspectorActorDisplaySource", () => {
  it("returns actor names without exposing mutable actor objects", () => {
    const actorSystem = new ActorSystem();
    actorSystem.createActor({ id: "scene", name: "Scene View" });
    const source = createActorSystemInspectorActorDisplaySource(actorSystem);

    expect(source.getActorDisplayName("scene")).toBe("Scene View");
    expect(source.getActorDisplayName("missing")).toBeNull();
    expect(Object.keys(source).sort()).toEqual(["getActorDisplayName"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  createSingletonWindowViewIdentity,
  createWindowViewKeyFromTypeAndInstance,
  windowViewInstanceId,
  windowViewTypeKey
} from "./window-view-identity";

describe("window view identity", () => {
  it("keeps singleton identity on the current stable view key", () => {
    expect(createSingletonWindowViewIdentity("scene")).toEqual({
      viewKey: "scene",
      typeKey: "scene",
      instanceId: "scene:default",
      multiplicity: "singleton"
    });
  });

  it("keeps instance id opaque when creating compatibility view keys", () => {
    const typeKey = windowViewTypeKey("inspector");
    const instanceId = windowViewInstanceId("inspector:1");

    expect(createWindowViewKeyFromTypeAndInstance(typeKey, instanceId)).toBe("inspector:1");
  });
});

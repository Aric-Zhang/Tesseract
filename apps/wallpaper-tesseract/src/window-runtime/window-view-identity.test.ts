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
      instanceId: null,
      multiplicity: "singleton"
    });
  });

  it("can describe a future instance id without changing current singleton format", () => {
    const typeKey = windowViewTypeKey("inspector");
    const instanceId = windowViewInstanceId("1");

    expect(createWindowViewKeyFromTypeAndInstance(typeKey, instanceId)).toBe("inspector:1");
  });
});

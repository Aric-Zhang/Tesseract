import { describe, expect, it } from "vitest";
import {
  runtimeCameraId,
  runtimeFrameSourceId,
  runtimeProjectionId,
  runtimeWorldId
} from "./runtime-id";

describe("runtime ids", () => {
  it("creates stable opaque string ids", () => {
    expect(runtimeWorldId("world-4d:a")).toBe("world-4d:a");
    expect(runtimeCameraId("camera:a")).toBe("camera:a");
    expect(runtimeProjectionId("projection:a")).toBe("projection:a");
    expect(runtimeFrameSourceId("frame-source:a")).toBe("frame-source:a");
  });

  it("rejects empty ids and editor UI-derived identity names", () => {
    expect(() => runtimeWorldId(" ")).toThrow(/non-empty/);
    expect(() => runtimeCameraId("viewActorId:camera")).toThrow(/editor UI identity/);
    expect(() => runtimeFrameSourceId("window-tab-source")).toThrow(/editor UI identity/);
  });
});

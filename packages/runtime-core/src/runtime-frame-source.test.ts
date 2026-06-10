import { describe, expect, it } from "vitest";
import { runtimeFrameSourceId } from "./runtime-id";
import { RuntimeFrameSourceRegistry, RuntimeMutableFrameSource } from "./runtime-frame-source";

describe("runtime frame sources", () => {
  it("publishes cacheable revision snapshots and disposable subscriptions", () => {
    const source = new RuntimeMutableFrameSource<{ readonly value: number }>({
      id: runtimeFrameSourceId("frame-source:a")
    });
    const calls: number[] = [];
    const subscription = source.subscribe({
      onFrameSourceChanged(snapshot) {
        calls.push(snapshot.revision);
      }
    });

    const first = source.publish({ status: "ready", payload: { value: 1 } });
    const cached = source.getSnapshot();
    subscription.dispose();
    source.publish({ status: "ready", payload: { value: 2 } });

    expect(first.revision).toBe(1);
    expect(cached).toBe(first);
    expect(calls).toEqual([1]);
  });

  it("tracks concurrent frame sources and failure states", () => {
    const registry = new RuntimeFrameSourceRegistry();
    const sourceA = new RuntimeMutableFrameSource({ id: runtimeFrameSourceId("frame-source:a") });
    const sourceB = new RuntimeMutableFrameSource({ id: runtimeFrameSourceId("frame-source:b") });

    registry.add(sourceA);
    registry.add(sourceB);
    sourceB.publish({ status: "failed", error: { message: "backend unavailable", code: "backend" } });

    expect(registry.list().map((source) => source.descriptor.id)).toEqual(["frame-source:a", "frame-source:b"]);
    expect(registry.get(runtimeFrameSourceId("frame-source:b"))?.getSnapshot()).toMatchObject({
      revision: 1,
      status: "failed",
      error: { message: "backend unavailable" }
    });
    expect(registry.remove(runtimeFrameSourceId("frame-source:a"))).toBe(true);
  });
});

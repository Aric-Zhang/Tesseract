import { describe, expect, it } from "vitest";
import { ImmediateUpdateScheduler } from "./immediate-update-scheduler";

describe("ImmediateUpdateScheduler", () => {
  it("queues a microtask update with the submitted timestamp", () => {
    const updates: number[] = [];
    const microtasks: Array<() => void> = [];
    const scheduler = new ImmediateUpdateScheduler({
      update: (timeMs) => updates.push(timeMs),
      isUpdatingFrame: () => false,
      enqueueMicrotask: (callback) => microtasks.push(callback)
    });

    scheduler.requestUpdate(42);

    expect(updates).toEqual([]);
    expect(microtasks).toHaveLength(1);

    microtasks[0]();

    expect(updates).toEqual([42]);
  });

  it("coalesces multiple requests while a microtask is queued", () => {
    const updates: number[] = [];
    const microtasks: Array<() => void> = [];
    const scheduler = new ImmediateUpdateScheduler({
      update: (timeMs) => updates.push(timeMs),
      isUpdatingFrame: () => false,
      enqueueMicrotask: (callback) => microtasks.push(callback)
    });

    scheduler.requestUpdate(1);
    scheduler.requestUpdate(2);

    expect(microtasks).toHaveLength(1);
    microtasks[0]();
    expect(updates).toEqual([1]);
  });

  it("uses the monotonic performance clock for default immediate updates", () => {
    const updates: number[] = [];
    const microtasks: Array<() => void> = [];
    const scheduler = new ImmediateUpdateScheduler({
      update: (timeMs) => updates.push(timeMs),
      isUpdatingFrame: () => false,
      enqueueMicrotask: (callback) => microtasks.push(callback)
    });

    scheduler.requestUpdate();
    microtasks[0]();

    expect(updates).toHaveLength(1);
    expect(updates[0]).toBeGreaterThanOrEqual(0);
    expect(updates[0]).toBeLessThan(Date.now());
  });

  it("does not queue while the normal frame update is running", () => {
    const updates: number[] = [];
    const microtasks: Array<() => void> = [];
    const scheduler = new ImmediateUpdateScheduler({
      update: (timeMs) => updates.push(timeMs),
      isUpdatingFrame: () => true,
      enqueueMicrotask: (callback) => microtasks.push(callback)
    });

    scheduler.requestUpdate(7);

    expect(microtasks).toEqual([]);
    expect(updates).toEqual([]);
  });

  it("ignores queued work after dispose", () => {
    const updates: number[] = [];
    const microtasks: Array<() => void> = [];
    const scheduler = new ImmediateUpdateScheduler({
      update: (timeMs) => updates.push(timeMs),
      isUpdatingFrame: () => false,
      enqueueMicrotask: (callback) => microtasks.push(callback)
    });

    scheduler.requestUpdate(9);
    scheduler.dispose();
    microtasks[0]();

    expect(updates).toEqual([]);
  });
});

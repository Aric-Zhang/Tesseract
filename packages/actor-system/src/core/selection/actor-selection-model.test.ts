import { describe, expect, it } from "vitest";

import {
  ActorSelectionModel,
  areActorSelectionSnapshotsEqual,
  assertActorSelectionSnapshot,
  createEmptyActorSelectionSnapshot,
  normalizeActorSelectionSnapshot
} from "./actor-selection-model";

describe("ActorSelectionModel", () => {
  it("normalizes an empty snapshot", () => {
    expect(createEmptyActorSelectionSnapshot()).toEqual({
      selectedActorIds: [],
      activeActorId: null
    });
    expect(new ActorSelectionModel().snapshot).toEqual({
      selectedActorIds: [],
      activeActorId: null
    });
  });

  it("deduplicates selected ids in first-seen order", () => {
    const snapshot = normalizeActorSelectionSnapshot({
      selectedActorIds: ["scene", "camera", "scene", "tesseract"],
      activeActorId: "scene"
    });

    expect(snapshot).toEqual({
      selectedActorIds: ["scene", "camera", "tesseract"],
      activeActorId: "scene"
    });
  });

  it("chooses the last selected id when replace has no active id", () => {
    const model = new ActorSelectionModel();

    expect(model.replace(["scene", "camera"])).toEqual({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "camera"
    });
  });

  it("repairs a missing active id deterministically", () => {
    const model = new ActorSelectionModel();

    expect(model.replace(["scene", "camera"], "missing")).toEqual({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "camera"
    });
  });

  it("toggles actors and repairs active id", () => {
    const model = new ActorSelectionModel({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "camera"
    });

    expect(model.toggle("camera")).toEqual({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });
    expect(model.toggle("tesseract")).toEqual({
      selectedActorIds: ["scene", "tesseract"],
      activeActorId: "tesseract"
    });
  });

  it("adds only new actors and makes the last selected id active", () => {
    const model = new ActorSelectionModel({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });

    expect(model.add(["scene", "camera", "tesseract"])).toEqual({
      selectedActorIds: ["scene", "camera", "tesseract"],
      activeActorId: "tesseract"
    });
  });

  it("keeps the active actor when add does not add any new ids", () => {
    const model = new ActorSelectionModel({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "scene"
    });

    expect(model.add([])).toEqual({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "scene"
    });
    expect(model.add(["camera", "scene"])).toEqual({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "scene"
    });
  });

  it("removes actors and repairs active id", () => {
    const model = new ActorSelectionModel({
      selectedActorIds: ["scene", "camera", "tesseract"],
      activeActorId: "camera"
    });

    expect(model.remove(["camera"])).toEqual({
      selectedActorIds: ["scene", "tesseract"],
      activeActorId: "tesseract"
    });
  });

  it("prunes missing actors and repairs active id", () => {
    const model = new ActorSelectionModel({
      selectedActorIds: ["scene", "camera", "tesseract"],
      activeActorId: "tesseract"
    });

    expect(model.prune(new Set(["scene", "camera"]))).toEqual({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "camera"
    });
  });

  it("normalizes stale active ids to the latest selected id instead of rejecting them", () => {
    expect(normalizeActorSelectionSnapshot({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "deleted"
    })).toEqual({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "camera"
    });
  });

  it("does not let callers mutate input arrays or returned snapshots", () => {
    const selectedActorIds = ["scene", "camera"];
    const model = new ActorSelectionModel({ selectedActorIds });
    selectedActorIds.push("external");
    const snapshot = model.snapshot;

    expect(snapshot.selectedActorIds).toEqual(["scene", "camera"]);
    expect(() => {
      (snapshot.selectedActorIds as string[]).push("mutated");
    }).toThrow();
    expect(() => {
      (snapshot as { activeActorId: string | null }).activeActorId = "mutated";
    }).toThrow();
    expect(model.snapshot).toEqual({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "camera"
    });
  });

  it("rejects invalid actor ids and snapshots", () => {
    expect(() => new ActorSelectionModel({ selectedActorIds: [""] })).toThrow(/non-empty actor id/);
    expect(() => assertActorSelectionSnapshot({ selectedActorIds: [""], activeActorId: null }))
      .toThrow(/non-empty actor id/);
    expect(() => assertActorSelectionSnapshot({ selectedActorIds: ["scene"], activeActorId: 42 }))
      .toThrow(/string or null/);
  });

  it("compares selection snapshots by ids and active id", () => {
    expect(areActorSelectionSnapshotsEqual(
      { selectedActorIds: ["scene"], activeActorId: "scene" },
      { selectedActorIds: ["scene"], activeActorId: "scene" }
    )).toBe(true);
    expect(areActorSelectionSnapshotsEqual(
      { selectedActorIds: ["scene"], activeActorId: "scene" },
      { selectedActorIds: ["scene"], activeActorId: null }
    )).toBe(false);
  });
});

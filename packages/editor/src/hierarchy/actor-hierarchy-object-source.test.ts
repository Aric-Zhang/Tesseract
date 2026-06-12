import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-core";
import { createActorHierarchyObjectSource } from "./actor-hierarchy-object-source";

describe("ActorHierarchyObjectSource", () => {
  it("lists current actors using actor id and name", () => {
    const actorSystem = new ActorSystem();
    actorSystem.createActor({ id: "scene-window", name: "Scene" });
    actorSystem.createActor({ id: "camera-3", name: "Camera3" });
    const source = createActorHierarchyObjectSource({ actorSystem });

    expect(source.listObjects()).toEqual([
      { id: "scene-window", label: "Scene", parentId: null },
      { id: "camera-3", label: "Camera3", parentId: null }
    ]);
  });

  it("reads a live actor snapshot on each listObjects call", () => {
    const actorSystem = new ActorSystem();
    const sceneActor = actorSystem.createActor({ id: "scene-window", name: "Scene" });
    const source = createActorHierarchyObjectSource({ actorSystem });

    actorSystem.createActor({ id: "debug-log-window", name: "Debug Log Window" });
    expect(source.listObjects().map((item) => item.id)).toEqual(["scene-window", "debug-log-window"]);

    actorSystem.destroyActor(sceneActor);
    expect(source.listObjects().map((item) => item.id)).toEqual(["debug-log-window"]);
  });

  it("uses metadata labels and parent ids without hiding disabled actors", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "camera-3", name: "Camera" });
    actor.enabled = false;
    const source = createActorHierarchyObjectSource({
      actorSystem,
      metadataByActorId: {
        "camera-3": {
          label: "Camera3",
          parentId: "scene-window"
        }
      }
    });

    expect(source.listObjects()).toEqual([
      {
        id: "camera-3",
        label: "Camera3",
        parentId: "scene-window",
        activeSelf: false,
        activeInHierarchy: false
      }
    ]);
  });

  it("reports inherited inactive state without marking activeSelf false", () => {
    const actorSystem = new ActorSystem();
    const scene = actorSystem.createActor({ id: "scene-window", name: "Scene", enabled: false });
    actorSystem.createActor({ id: "camera-3", name: "Camera3", parent: scene });
    const source = createActorHierarchyObjectSource({ actorSystem });

    expect(source.listObjects()).toEqual([
      {
        id: "scene-window",
        label: "Scene",
        parentId: null,
        activeSelf: false,
        activeInHierarchy: false
      },
      {
        id: "camera-3",
        label: "Camera3",
        parentId: "scene-window",
        activeInHierarchy: false
      }
    ]);
  });

  it("prefers runtime parent ids over metadata parent ids", () => {
    const actorSystem = new ActorSystem();
    const scene = actorSystem.createActor({ id: "scene-window", name: "Scene" });
    actorSystem.createActor({ id: "camera-3", name: "Camera3", parent: scene });
    const source = createActorHierarchyObjectSource({
      actorSystem,
      metadataByActorId: {
        "camera-3": {
          parentId: "metadata-parent"
        }
      }
    });

    expect(source.listObjects().find((item) => item.id === "camera-3")?.parentId).toBe("scene-window");
  });

  it("updates runtime parent ids after reparent", () => {
    const actorSystem = new ActorSystem();
    const sceneA = actorSystem.createActor({ id: "scene-a", name: "Scene A" });
    const sceneB = actorSystem.createActor({ id: "scene-b", name: "Scene B" });
    const camera = actorSystem.createActor({ id: "camera-3", name: "Camera3", parent: sceneA });
    const source = createActorHierarchyObjectSource({ actorSystem });

    expect(source.listObjects().find((item) => item.id === "camera-3")?.parentId).toBe("scene-a");

    actorSystem.setParent(camera, sceneB);
    expect(source.listObjects().find((item) => item.id === "camera-3")?.parentId).toBe("scene-b");
  });

  it("keeps runtime parents before children even when metadata order is wrong", () => {
    const actorSystem = new ActorSystem();
    const scene = actorSystem.createActor({ id: "scene-window", name: "Scene" });
    actorSystem.createActor({ id: "camera-3", name: "Camera3", parent: scene });
    const source = createActorHierarchyObjectSource({
      actorSystem,
      metadataByActorId: {
        "scene-window": { order: 100 },
        "camera-3": { order: 0 }
      }
    });

    expect(source.listObjects().map((item) => item.id)).toEqual(["scene-window", "camera-3"]);
  });

  it("sorts siblings by metadata order while preserving tree structure", () => {
    const actorSystem = new ActorSystem();
    const scene = actorSystem.createActor({ id: "scene-window", name: "Scene" });
    actorSystem.createActor({ id: "camera-3", name: "Camera3", parent: scene });
    actorSystem.createActor({ id: "tesseract-4", name: "Tesseract4", parent: scene });
    actorSystem.createActor({ id: "debug-log-window", name: "Debug Log Window" });
    const source = createActorHierarchyObjectSource({
      actorSystem,
      metadataByActorId: {
        "scene-window": { order: 0 },
        "debug-log-window": { order: 10 },
        "camera-3": { order: 20 },
        "tesseract-4": { order: 10 }
      }
    });

    expect(source.listObjects().map((item) => item.id)).toEqual([
      "scene-window",
      "tesseract-4",
      "camera-3",
      "debug-log-window"
    ]);
  });

  it("removes child items when a parent actor is destroyed", () => {
    const actorSystem = new ActorSystem();
    const scene = actorSystem.createActor({ id: "scene-window", name: "Scene" });
    actorSystem.createActor({ id: "camera-3", name: "Camera3", parent: scene });
    const source = createActorHierarchyObjectSource({ actorSystem });

    actorSystem.destroyActor(scene);

    expect(source.listObjects()).toEqual([]);
  });

  it("sorts ordered actors before unordered actors and keeps unordered creation order", () => {
    const actorSystem = new ActorSystem();
    actorSystem.createActor({ id: "debug-log-window", name: "Debug Log Window" });
    actorSystem.createActor({ id: "scene-window", name: "Scene" });
    actorSystem.createActor({ id: "hierarchy-panel", name: "Hierarchy Panel" });
    actorSystem.createActor({ id: "camera-3", name: "Camera3" });
    const source = createActorHierarchyObjectSource({
      actorSystem,
      metadataByActorId: {
        "camera-3": { order: 20 },
        "scene-window": { order: 0 }
      }
    });

    expect(source.listObjects().map((item) => item.id)).toEqual([
      "scene-window",
      "camera-3",
      "debug-log-window",
      "hierarchy-panel"
    ]);
  });

  it("uses creation order as a tie breaker for equal metadata order values", () => {
    const actorSystem = new ActorSystem();
    actorSystem.createActor({ id: "camera-3", name: "Camera3" });
    actorSystem.createActor({ id: "tesseract-4", name: "Tesseract4" });
    const source = createActorHierarchyObjectSource({
      actorSystem,
      metadataByActorId: new Map([
        ["camera-3", { order: 10 }],
        ["tesseract-4", { order: 10 }]
      ])
    });

    expect(source.listObjects().map((item) => item.id)).toEqual(["camera-3", "tesseract-4"]);
  });

  it("can explicitly filter actors", () => {
    const actorSystem = new ActorSystem();
    actorSystem.createActor({ id: "scene-window", name: "Scene" });
    actorSystem.createActor({ id: "test-helper", name: "Test Helper" });
    const source = createActorHierarchyObjectSource({
      actorSystem,
      includeActor: (actor) => actor.id !== "test-helper"
    });

    expect(source.listObjects().map((item) => item.id)).toEqual(["scene-window"]);
  });

  it("does not expose mutable item references", () => {
    const actorSystem = new ActorSystem();
    actorSystem.createActor({ id: "camera-3", name: "Camera3" });
    const source = createActorHierarchyObjectSource({ actorSystem });
    const first = source.listObjects();
    (first as unknown as Array<{ label: string }>)[0].label = "Changed";

    expect(source.listObjects()).toEqual([
      { id: "camera-3", label: "Camera3", parentId: null }
    ]);
  });
});

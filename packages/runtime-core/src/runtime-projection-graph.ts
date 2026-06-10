import type { RuntimeCameraDescriptor } from "./runtime-camera";
import type { RuntimeFrameSourceDescriptor } from "./runtime-frame-source";
import type { RuntimeCameraId, RuntimeFrameSourceId, RuntimeProjectionId, RuntimeWorldId } from "./runtime-id";
import type { RuntimeWorldDescriptor, RuntimeWorldKind } from "./runtime-world";

export type RuntimeProjectionKind = "4d-to-3d" | "3d-to-2d";

export type RuntimeProjectionDescriptor =
  | {
      readonly id: RuntimeProjectionId;
      readonly kind: "4d-to-3d";
      readonly sourceWorldId: RuntimeWorldId;
      readonly cameraId: RuntimeCameraId;
      readonly targetWorldId: RuntimeWorldId;
    }
  | {
      readonly id: RuntimeProjectionId;
      readonly kind: "3d-to-2d";
      readonly sourceWorldId: RuntimeWorldId;
      readonly cameraId: RuntimeCameraId;
      readonly targetFrameSourceId: RuntimeFrameSourceId;
    };

export interface RuntimeProjectionValidationError {
  readonly projectionId: RuntimeProjectionId;
  readonly message: string;
}

export class RuntimeProjectionGraph {
  readonly #worlds = new Map<RuntimeWorldId, RuntimeWorldDescriptor>();
  readonly #cameras = new Map<RuntimeCameraId, RuntimeCameraDescriptor>();
  readonly #frameSources = new Map<RuntimeFrameSourceId, RuntimeFrameSourceDescriptor>();
  readonly #projections = new Map<RuntimeProjectionId, RuntimeProjectionDescriptor>();

  addWorld(world: RuntimeWorldDescriptor): void {
    assertUnique(this.#worlds, world.id, "world");
    this.#worlds.set(world.id, world);
  }

  removeWorld(worldId: RuntimeWorldId): void {
    this.#worlds.delete(worldId);
    for (const [cameraId, camera] of this.#cameras) {
      if (camera.sourceWorldId === worldId) {
        this.removeCamera(cameraId);
      }
    }
    for (const [projectionId, projection] of this.#projections) {
      if (projection.sourceWorldId === worldId ||
        (projection.kind === "4d-to-3d" && projection.targetWorldId === worldId)) {
        this.#projections.delete(projectionId);
      }
    }
  }

  addCamera(camera: RuntimeCameraDescriptor): void {
    assertUnique(this.#cameras, camera.id, "camera");
    const sourceWorld = this.#worlds.get(camera.sourceWorldId);
    if (!sourceWorld) throw new Error(`Camera ${camera.id} references missing world ${camera.sourceWorldId}.`);
    if (!cameraKindMatchesWorld(camera.kind, sourceWorld.kind)) {
      throw new Error(`Camera ${camera.id} kind ${camera.kind} cannot project from ${sourceWorld.kind}.`);
    }
    this.#cameras.set(camera.id, camera);
  }

  removeCamera(cameraId: RuntimeCameraId): void {
    this.#cameras.delete(cameraId);
    for (const [projectionId, projection] of this.#projections) {
      if (projection.cameraId === cameraId) {
        this.#projections.delete(projectionId);
      }
    }
  }

  addFrameSource(source: RuntimeFrameSourceDescriptor): void {
    assertUnique(this.#frameSources, source.id, "frame source");
    this.#frameSources.set(source.id, source);
  }

  removeFrameSource(sourceId: RuntimeFrameSourceId): void {
    this.#frameSources.delete(sourceId);
    for (const [projectionId, projection] of this.#projections) {
      if (projection.kind === "3d-to-2d" && projection.targetFrameSourceId === sourceId) {
        this.#projections.delete(projectionId);
      }
    }
  }

  addProjection(projection: RuntimeProjectionDescriptor): void {
    assertUnique(this.#projections, projection.id, "projection");
    const error = this.validateProjection(projection);
    if (error) throw new Error(error.message);
    this.#projections.set(projection.id, projection);
  }

  removeProjection(projectionId: RuntimeProjectionId): void {
    this.#projections.delete(projectionId);
  }

  getWorld(worldId: RuntimeWorldId): RuntimeWorldDescriptor | null {
    return this.#worlds.get(worldId) ?? null;
  }

  getCamera(cameraId: RuntimeCameraId): RuntimeCameraDescriptor | null {
    return this.#cameras.get(cameraId) ?? null;
  }

  getProjection(projectionId: RuntimeProjectionId): RuntimeProjectionDescriptor | null {
    return this.#projections.get(projectionId) ?? null;
  }

  listWorlds(): readonly RuntimeWorldDescriptor[] {
    return [...this.#worlds.values()];
  }

  listCameras(): readonly RuntimeCameraDescriptor[] {
    return [...this.#cameras.values()];
  }

  listFrameSources(): readonly RuntimeFrameSourceDescriptor[] {
    return [...this.#frameSources.values()];
  }

  listProjections(): readonly RuntimeProjectionDescriptor[] {
    return [...this.#projections.values()];
  }

  validate(): readonly RuntimeProjectionValidationError[] {
    return [...this.#projections.values()]
      .map((projection) => this.validateProjection(projection))
      .filter((error): error is RuntimeProjectionValidationError => error !== null);
  }

  private validateProjection(projection: RuntimeProjectionDescriptor): RuntimeProjectionValidationError | null {
    const sourceWorld = this.#worlds.get(projection.sourceWorldId);
    const camera = this.#cameras.get(projection.cameraId);
    if (!sourceWorld) return error(projection, `Projection ${projection.id} references missing source world ${projection.sourceWorldId}.`);
    if (!camera) return error(projection, `Projection ${projection.id} references missing camera ${projection.cameraId}.`);
    if (camera.sourceWorldId !== projection.sourceWorldId) {
      return error(projection, `Projection ${projection.id} camera ${camera.id} belongs to a different source world.`);
    }
    if (projection.kind === "4d-to-3d") {
      return validateWorldProjection(projection, sourceWorld, camera, this.#worlds.get(projection.targetWorldId) ?? null);
    }
    return validateFrameProjection(projection, sourceWorld, camera, this.#frameSources.has(projection.targetFrameSourceId));
  }
}

function validateWorldProjection(
  projection: Extract<RuntimeProjectionDescriptor, { readonly kind: "4d-to-3d" }>,
  sourceWorld: RuntimeWorldDescriptor,
  camera: RuntimeCameraDescriptor,
  targetWorld: RuntimeWorldDescriptor | null
): RuntimeProjectionValidationError | null {
  if (sourceWorld.kind !== "world-4d") return error(projection, `Projection ${projection.id} requires a 4D source world.`);
  if (camera.kind !== "camera-4d") return error(projection, `Projection ${projection.id} requires a 4D camera.`);
  if (!targetWorld) return error(projection, `Projection ${projection.id} references missing target world ${projection.targetWorldId}.`);
  if (targetWorld.kind !== "world-3d") return error(projection, `Projection ${projection.id} requires a 3D target world.`);
  return null;
}

function validateFrameProjection(
  projection: Extract<RuntimeProjectionDescriptor, { readonly kind: "3d-to-2d" }>,
  sourceWorld: RuntimeWorldDescriptor,
  camera: RuntimeCameraDescriptor,
  hasTargetFrameSource: boolean
): RuntimeProjectionValidationError | null {
  if (sourceWorld.kind !== "world-3d") return error(projection, `Projection ${projection.id} requires a 3D source world.`);
  if (camera.kind !== "camera-3d") return error(projection, `Projection ${projection.id} requires a 3D camera.`);
  if (!hasTargetFrameSource) return error(projection, `Projection ${projection.id} references missing frame source ${projection.targetFrameSourceId}.`);
  return null;
}

function cameraKindMatchesWorld(cameraKind: "camera-4d" | "camera-3d", worldKind: RuntimeWorldKind): boolean {
  return (cameraKind === "camera-4d" && worldKind === "world-4d") ||
    (cameraKind === "camera-3d" && worldKind === "world-3d");
}

function assertUnique<T>(map: ReadonlyMap<T, unknown>, id: T, label: string): void {
  if (map.has(id)) {
    throw new Error(`RuntimeProjectionGraph already contains ${label} ${String(id)}.`);
  }
}

function error(
  projection: RuntimeProjectionDescriptor,
  message: string
): RuntimeProjectionValidationError {
  return { projectionId: projection.id, message };
}

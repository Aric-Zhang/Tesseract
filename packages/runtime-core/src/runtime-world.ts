import type { RuntimeWorldId } from "./runtime-id";

export type RuntimeWorldKind = "world-4d" | "world-3d" | "world-2d";

export interface RuntimeWorldDescriptor {
  readonly id: RuntimeWorldId;
  readonly kind: RuntimeWorldKind;
  readonly label?: string;
}

export class RuntimeWorldRegistry {
  readonly #worlds = new Map<RuntimeWorldId, RuntimeWorldDescriptor>();

  add(world: RuntimeWorldDescriptor): void {
    if (this.#worlds.has(world.id)) {
      throw new Error(`RuntimeWorldRegistry already contains world ${world.id}.`);
    }
    this.#worlds.set(world.id, world);
  }

  remove(worldId: RuntimeWorldId): boolean {
    return this.#worlds.delete(worldId);
  }

  get(worldId: RuntimeWorldId): RuntimeWorldDescriptor | null {
    return this.#worlds.get(worldId) ?? null;
  }

  list(): readonly RuntimeWorldDescriptor[] {
    return [...this.#worlds.values()];
  }
}

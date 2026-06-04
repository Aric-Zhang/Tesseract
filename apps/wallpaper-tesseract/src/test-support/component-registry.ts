import {
  ActorSystem,
  ComponentRegistry,
  type ComponentRegistryOptions
} from "../actor-runtime";

export interface TestComponentRegistrySetup {
  readonly actorSystem: ActorSystem;
  readonly registry: ComponentRegistry;
}

export type TestComponentRegistryOptions =
  Omit<ComponentRegistryOptions, "actorSystem"> & {
    readonly actorSystem?: ActorSystem;
  };

export function createTestComponentRegistry(
  options: TestComponentRegistryOptions = {}
): TestComponentRegistrySetup {
  const actorSystem = options.actorSystem ?? new ActorSystem();
  const registry = new ComponentRegistry({
    ...options,
    actorSystem
  });
  return { actorSystem, registry };
}

import type { InspectorComponentDescriptor } from "./inspector-component-descriptor";

export class InspectorComponentDescriptorRegistry {
  readonly #descriptorsByType = new Map<string, InspectorComponentDescriptor>();

  register(descriptor: InspectorComponentDescriptor): void {
    if (this.#descriptorsByType.has(descriptor.componentType)) {
      throw new Error(`Inspector descriptor already registered for ${descriptor.componentType}.`);
    }
    this.#descriptorsByType.set(descriptor.componentType, Object.freeze({ ...descriptor }));
  }

  get(componentType: string): InspectorComponentDescriptor | null {
    return this.#descriptorsByType.get(componentType) ?? null;
  }

  list(): readonly InspectorComponentDescriptor[] {
    return Object.freeze([...this.#descriptorsByType.values()]);
  }
}

export function createInspectorComponentDescriptorRegistry(): InspectorComponentDescriptorRegistry {
  return new InspectorComponentDescriptorRegistry();
}

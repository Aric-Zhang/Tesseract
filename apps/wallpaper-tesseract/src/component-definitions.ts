import type { ComponentDefinition, ComponentRegistry } from "./actor-runtime";

export function installComponentDefinition(
  componentRegistry: ComponentRegistry,
  definition: ComponentDefinition
): void {
  const existing = getExistingDefinition(componentRegistry, definition);
  if (!existing) {
    componentRegistry.registerDefinition(definition);
    return;
  }
  if (isSameDefinition(existing, definition)) return;
  throw new Error(`Component definition type is already installed with a different definition: ${definition.type}`);
}

function getExistingDefinition(
  componentRegistry: ComponentRegistry,
  definition: ComponentDefinition
): ComponentDefinition | null {
  try {
    return componentRegistry.getDefinition(definition.type);
  } catch (error) {
    if (error instanceof Error && /is not registered/.test(error.message)) {
      return null;
    }
    throw error;
  }
}

function isSameDefinition(existing: ComponentDefinition, candidate: ComponentDefinition): boolean {
  return (
    existing.type === candidate.type &&
    existing.kind === (candidate.kind ?? "business") &&
    existing.singleton === (candidate.singleton ?? false) &&
    existing.create === candidate.create &&
    existing.createId === candidate.createId &&
    sameAttachmentArray(existing.attachments ?? [], candidate.attachments ?? []) &&
    sameArray(existing.requires ?? [], candidate.requires ?? [])
  );
}

function sameArray<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameAttachmentArray(
  a: NonNullable<ComponentDefinition["attachments"]>,
  b: NonNullable<ComponentDefinition["attachments"]>
): boolean {
  return (
    a.length === b.length &&
    a.every((attachment, index) => (
      attachment.kind === b[index].kind &&
      attachment.options === b[index].options
    ))
  );
}

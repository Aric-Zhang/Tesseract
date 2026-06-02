export function assertFiniteVec3(values: ArrayLike<number>, label: string): void {
  assertMinLength(values, 3, label);
  for (let i = 0; i < 3; i++) {
    if (!Number.isFinite(values[i])) {
      throw new Error(`${label} must contain only finite values.`);
    }
  }
}

export function assertFiniteVec4(values: ArrayLike<number>, label: string): void {
  assertMinLength(values, 4, label);
  for (let i = 0; i < 4; i++) {
    if (!Number.isFinite(values[i])) {
      throw new Error(`${label} must contain only finite values.`);
    }
  }
}

export function assertEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): asserts value is T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  }
}

export function assertMinLength(values: ArrayLike<unknown>, required: number, label: string): void {
  if (values.length < required) {
    throw new Error(`${label} length must be at least ${required}.`);
  }
}

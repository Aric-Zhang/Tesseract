export interface NumberFieldDescriptor {
  readonly id: string;
  readonly value: number;
  readonly label?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
}

export interface NormalizedNumberFieldDescriptor {
  readonly id: string;
  readonly value: number;
  readonly label: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled: boolean;
  readonly readOnly: boolean;
}

export function normalizeNumberFieldDescriptor(
  descriptor: NumberFieldDescriptor
): NormalizedNumberFieldDescriptor {
  assertFinite(descriptor.value, "value");
  if (descriptor.min !== undefined) assertFinite(descriptor.min, "min");
  if (descriptor.max !== undefined) assertFinite(descriptor.max, "max");
  if (descriptor.step !== undefined) {
    assertFinite(descriptor.step, "step");
    if (descriptor.step <= 0) {
      throw new Error("NumberField descriptor step must be greater than zero.");
    }
  }
  if (descriptor.min !== undefined && descriptor.max !== undefined && descriptor.min > descriptor.max) {
    throw new Error("NumberField descriptor min cannot be greater than max.");
  }
  return Object.freeze({
    id: descriptor.id,
    value: descriptor.value,
    label: descriptor.label ?? descriptor.id,
    min: descriptor.min,
    max: descriptor.max,
    step: descriptor.step,
    disabled: descriptor.disabled ?? false,
    readOnly: descriptor.readOnly ?? false
  });
}

export function isNumberFieldValueInRange(
  value: number,
  descriptor: Pick<NormalizedNumberFieldDescriptor, "min" | "max">
): boolean {
  if (!Number.isFinite(value)) return false;
  if (descriptor.min !== undefined && value < descriptor.min) return false;
  if (descriptor.max !== undefined && value > descriptor.max) return false;
  return true;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`NumberField descriptor ${label} must be finite.`);
  }
}

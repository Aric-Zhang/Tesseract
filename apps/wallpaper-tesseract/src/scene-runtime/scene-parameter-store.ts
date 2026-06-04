import type { ParameterPath, SceneUpdateCommand, SceneUpdateOperation } from "./scene-update-command";

export type SceneMergeStrategy = "last-write-wins" | "additive" | "set-then-add";

export interface SceneParameterDefinition<TValue = unknown, TDelta = TValue> {
  path: ParameterPath;
  initialValue: TValue;
  allowedOperations: readonly SceneUpdateOperation[];
  merge: SceneMergeStrategy;
  validateValue?: (value: unknown) => asserts value is TValue;
  validateDelta?: (delta: unknown) => asserts delta is TDelta;
  add?: (value: TValue, delta: TDelta) => TValue;
  constrain?: (value: TValue) => TValue;
  equals?: (a: TValue, b: TValue) => boolean;
  clone?: (value: TValue) => TValue;
}

interface SceneParameterEntry<TValue = unknown, TDelta = TValue> {
  definition: SceneParameterDefinition<TValue, TDelta>;
  value: TValue;
}

export class SceneParameterStore {
  private readonly entries = new Map<ParameterPath, SceneParameterEntry<any, any>>();

  register<TValue, TDelta = TValue>(definition: SceneParameterDefinition<TValue, TDelta>): void {
    if (this.entries.has(definition.path)) {
      throw new Error(`SceneParameterStore path is already registered: ${definition.path}`);
    }
    if (definition.allowedOperations.length === 0) {
      throw new Error(`SceneParameterStore parameter must allow at least one operation: ${definition.path}`);
    }
    if (definition.allowedOperations.includes("add") && !definition.add) {
      throw new Error(`SceneParameterStore parameter allows add but does not define add(): ${definition.path}`);
    }
    definition.validateValue?.(definition.initialValue);
    const initialValue = definition.constrain?.(definition.initialValue) ?? definition.initialValue;
    definition.validateValue?.(initialValue);
    this.entries.set(definition.path, {
      definition,
      value: cloneValue(definition, initialValue)
    });
  }

  has(path: ParameterPath): boolean {
    return this.entries.has(path);
  }

  get<TValue = unknown>(path: ParameterPath): TValue {
    const entry = this.getEntry<TValue>(path);
    return cloneValue(entry.definition, entry.value);
  }

  getDefinition<TValue = unknown, TDelta = TValue>(
    path: ParameterPath
  ): SceneParameterDefinition<TValue, TDelta> {
    return this.getEntry<TValue, TDelta>(path).definition;
  }

  validateCommand(command: SceneUpdateCommand): void {
    const entry = this.getEntry(command.target);
    const definition = entry.definition;
    if (!definition.allowedOperations.includes(command.operation)) {
      throw new Error(`SceneParameterStore operation "${command.operation}" is not allowed for ${command.target}.`);
    }
    switch (command.operation) {
      case "set":
        definition.validateValue?.(command.value);
        return;
      case "add":
        definition.validateDelta?.(command.delta);
        return;
      case "reset":
        return;
    }
  }

  commit<TValue = unknown>(path: ParameterPath, value: TValue): boolean {
    const entry = this.getEntry<TValue>(path);
    const definition = entry.definition;
    definition.validateValue?.(value);
    const constrained = definition.constrain?.(value) ?? value;
    definition.validateValue?.(constrained);
    if (equalsValue(definition, entry.value, constrained)) {
      return false;
    }
    entry.value = cloneValue(definition, constrained);
    return true;
  }

  getInitialValue<TValue = unknown>(path: ParameterPath): TValue {
    const entry = this.getEntry<TValue>(path);
    return cloneValue(entry.definition, entry.definition.initialValue);
  }

  private getEntry<TValue = unknown, TDelta = TValue>(path: ParameterPath): SceneParameterEntry<TValue, TDelta> {
    const entry = this.entries.get(path);
    if (!entry) {
      throw new Error(`SceneParameterStore path is not registered: ${path}`);
    }
    return entry as SceneParameterEntry<TValue, TDelta>;
  }
}

function cloneValue<TValue, TDelta>(definition: SceneParameterDefinition<TValue, TDelta>, value: TValue): TValue {
  return definition.clone ? definition.clone(value) : value;
}

function equalsValue<TValue, TDelta>(
  definition: SceneParameterDefinition<TValue, TDelta>,
  a: TValue,
  b: TValue
): boolean {
  return definition.equals ? definition.equals(a, b) : Object.is(a, b);
}

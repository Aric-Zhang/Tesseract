import type { AppStateCommand, AppStateCommandOperation } from "./app-state";

export type AppStateMergeStrategy = "last-write-wins" | "additive" | "set-then-add";

export interface AppStateParameterDefinition<TValue = unknown, TDelta = TValue> {
  path: string;
  initialValue: TValue;
  allowedOperations: readonly AppStateCommandOperation[];
  merge: AppStateMergeStrategy;
  validateValue?: (value: unknown) => asserts value is TValue;
  validateDelta?: (delta: unknown) => asserts delta is TDelta;
  add?: (value: TValue, delta: TDelta) => TValue;
  constrain?: (value: TValue) => TValue;
  equals?: (a: TValue, b: TValue) => boolean;
  clone?: (value: TValue) => TValue;
}

interface AppStateParameterEntry<TValue = unknown, TDelta = TValue> {
  definition: AppStateParameterDefinition<TValue, TDelta>;
  value: TValue;
}

export class AppStateParameterStore {
  readonly #entries = new Map<string, AppStateParameterEntry<any, any>>();

  register<TValue, TDelta = TValue>(definition: AppStateParameterDefinition<TValue, TDelta>): void {
    if (this.#entries.has(definition.path)) {
      throw new Error(`AppStateParameterStore path is already registered: ${definition.path}`);
    }
    if (definition.allowedOperations.length === 0) {
      throw new Error(`AppStateParameterStore parameter must allow at least one operation: ${definition.path}`);
    }
    if (definition.allowedOperations.includes("add") && !definition.add) {
      throw new Error(`AppStateParameterStore parameter allows add but does not define add(): ${definition.path}`);
    }
    definition.validateValue?.(definition.initialValue);
    const initialValue = definition.constrain?.(definition.initialValue) ?? definition.initialValue;
    definition.validateValue?.(initialValue);
    this.#entries.set(definition.path, {
      definition,
      value: cloneValue(definition, initialValue)
    });
  }

  has(path: string): boolean {
    return this.#entries.has(path);
  }

  get<TValue = unknown>(path: string): TValue {
    const entry = this.#getEntry<TValue>(path);
    return cloneValue(entry.definition, entry.value);
  }

  getDefinition<TValue = unknown, TDelta = TValue>(
    path: string
  ): AppStateParameterDefinition<TValue, TDelta> {
    return this.#getEntry<TValue, TDelta>(path).definition;
  }

  validateCommand(command: AppStateCommand): void {
    const entry = this.#getEntry(command.target);
    const definition = entry.definition;
    if (!definition.allowedOperations.includes(command.operation)) {
      throw new Error(`AppStateParameterStore operation "${command.operation}" is not allowed for ${command.target}.`);
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

  commit<TValue = unknown>(path: string, value: TValue): boolean {
    const entry = this.#getEntry<TValue>(path);
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

  getInitialValue<TValue = unknown>(path: string): TValue {
    const entry = this.#getEntry<TValue>(path);
    return cloneValue(entry.definition, entry.definition.initialValue);
  }

  #getEntry<TValue = unknown, TDelta = TValue>(path: string): AppStateParameterEntry<TValue, TDelta> {
    const entry = this.#entries.get(path);
    if (!entry) {
      throw new Error(`AppStateParameterStore path is not registered: ${path}`);
    }
    return entry as AppStateParameterEntry<TValue, TDelta>;
  }
}

function cloneValue<TValue, TDelta>(definition: AppStateParameterDefinition<TValue, TDelta>, value: TValue): TValue {
  return definition.clone ? definition.clone(value) : value;
}

function equalsValue<TValue, TDelta>(
  definition: AppStateParameterDefinition<TValue, TDelta>,
  a: TValue,
  b: TValue
): boolean {
  return definition.equals ? definition.equals(a, b) : Object.is(a, b);
}

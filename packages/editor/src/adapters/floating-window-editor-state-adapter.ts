import type { AppStateParameterStore } from "../app-state-store";
import {
  addUiVec2,
  assertUiVec2,
  cloneUiVec2,
  DEFAULT_FLOATING_WINDOW_MIN_SIZE,
  equalsUiVec2,
  type FloatingWindowParameterPaths,
  type FloatingWindowState,
  type UiLayoutPath,
  type UiVec2
} from "ui-framework";
import type { AppStatePath } from "../app-state";

export interface RegisterFloatingWindowParametersOptions {
  paths: FloatingWindowParameterPaths;
  initialState: FloatingWindowState;
  minSize?: UiVec2;
}

type FloatingWindowParameterKind = "position" | "size" | "visible";

interface FloatingWindowParameterRegistration {
  kind: FloatingWindowParameterKind;
  initialValue: UiVec2 | boolean;
  minSize?: UiVec2;
}

const registeredWindowParameters =
  new WeakMap<AppStateParameterStore, Map<UiLayoutPath, FloatingWindowParameterRegistration>>();

export function registerFloatingWindowParameters(
  store: AppStateParameterStore,
  options: RegisterFloatingWindowParametersOptions
): void {
  const minSize = options.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE;
  const records = new Map<UiLayoutPath, FloatingWindowParameterRegistration>([
    [options.paths.position, {
      kind: "position",
      initialValue: cloneUiVec2(options.initialState.position)
    }],
    [options.paths.size, {
      kind: "size",
      initialValue: cloneUiVec2(options.initialState.size),
      minSize: cloneUiVec2(minSize)
    }],
    [options.paths.visible, {
      kind: "visible",
      initialValue: options.initialState.visible
    }]
  ]);

  if (records.size !== 3) {
    throw new Error("Floating window parameter paths must be distinct.");
  }

  const storeRecords = getStoreRecords(store);
  for (const [path, record] of records) {
    const existing = storeRecords.get(path);
    if (existing) {
      assertSameRegistration(path, existing, record);
    } else if (store.has(toAppStatePath(path))) {
      throw new Error(`Floating window parameter path is already registered outside editor state: ${path}`);
    }
  }

  for (const [path, record] of records) {
    if (storeRecords.has(path)) continue;
    registerFloatingWindowParameter(store, path, record);
    storeRecords.set(path, cloneRegistration(record));
  }
}

function registerFloatingWindowParameter(
  store: AppStateParameterStore,
  path: UiLayoutPath,
  record: FloatingWindowParameterRegistration
): void {
  if (record.kind === "position") {
    assertUiVec2(record.initialValue);
    store.register({
      path: toAppStatePath(path),
      initialValue: record.initialValue,
      allowedOperations: ["set", "add", "reset"],
      merge: "set-then-add",
      validateValue: assertUiVec2,
      validateDelta: assertUiVec2,
      add: addUiVec2,
      clone: cloneUiVec2,
      equals: equalsUiVec2
    });
    return;
  }

  if (record.kind === "size") {
    assertUiVec2(record.initialValue);
    const minSize = record.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE;
    store.register({
      path: toAppStatePath(path),
      initialValue: record.initialValue,
      allowedOperations: ["set", "add", "reset"],
      merge: "set-then-add",
      validateValue: assertUiVec2,
      validateDelta: assertUiVec2,
      add: addUiVec2,
      constrain: (value) => constrainSize(value, minSize),
      clone: cloneUiVec2,
      equals: equalsUiVec2
    });
    return;
  }

  assertBoolean(record.initialValue);
  store.register({
    path: toAppStatePath(path),
    initialValue: record.initialValue,
    allowedOperations: ["set", "reset"],
    merge: "last-write-wins",
    validateValue: assertBoolean
  });
}

function getStoreRecords(store: AppStateParameterStore): Map<UiLayoutPath, FloatingWindowParameterRegistration> {
  const existing = registeredWindowParameters.get(store);
  if (existing) return existing;
  const records = new Map<UiLayoutPath, FloatingWindowParameterRegistration>();
  registeredWindowParameters.set(store, records);
  return records;
}

function assertSameRegistration(
  path: UiLayoutPath,
  existing: FloatingWindowParameterRegistration,
  next: FloatingWindowParameterRegistration
): void {
  if (!isSameRegistration(existing, next)) {
    throw new Error(`Floating window parameter path is already registered with a different definition: ${path}`);
  }
}

function isSameRegistration(
  existing: FloatingWindowParameterRegistration,
  next: FloatingWindowParameterRegistration
): boolean {
  if (existing.kind !== next.kind) return false;
  if (!isSameInitialValue(existing.initialValue, next.initialValue)) return false;
  if (existing.kind !== "size") return true;
  return equalsUiVec2(
    existing.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE,
    next.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE
  );
}

function isSameInitialValue(a: UiVec2 | boolean, b: UiVec2 | boolean): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") {
    return a === b;
  }
  return equalsUiVec2(a, b);
}

function cloneRegistration(record: FloatingWindowParameterRegistration): FloatingWindowParameterRegistration {
  return {
    kind: record.kind,
    initialValue: typeof record.initialValue === "boolean" ? record.initialValue : cloneUiVec2(record.initialValue),
    minSize: record.minSize ? cloneUiVec2(record.minSize) : undefined
  };
}

function constrainSize(value: UiVec2, minSize: UiVec2): UiVec2 {
  return {
    x: Math.max(minSize.x, value.x),
    y: Math.max(minSize.y, value.y)
  };
}

function assertBoolean(value: unknown): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error("Expected a boolean value.");
  }
}

function toAppStatePath<TValue>(path: string): AppStatePath<TValue> {
  return path as AppStatePath<TValue>;
}

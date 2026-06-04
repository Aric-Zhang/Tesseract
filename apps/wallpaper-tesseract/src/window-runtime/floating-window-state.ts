import {
  addVec2,
  assertVec2,
  cloneVec2,
  equalsVec2,
  vec2,
  type ParameterPath,
  type SceneParameterStore,
  type Vec2
} from "../scene-runtime";

export interface FloatingWindowState {
  position: Vec2;
  size: Vec2;
  visible: boolean;
}

export interface FloatingWindowParameterPaths {
  position: ParameterPath<Vec2>;
  size: ParameterPath<Vec2>;
  visible: ParameterPath<boolean>;
}

export interface FloatingWindowStateOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  width?: number;
  height?: number;
  minSize?: Vec2;
  maxSize?: Vec2;
  margin?: number;
  visible?: boolean;
}

export interface RegisterFloatingWindowParametersOptions {
  paths: FloatingWindowParameterPaths;
  initialState: FloatingWindowState;
  minSize?: Vec2;
}

type FloatingWindowParameterKind = "position" | "size" | "visible";

interface FloatingWindowParameterRegistration {
  kind: FloatingWindowParameterKind;
  initialValue: Vec2 | boolean;
  minSize?: Vec2;
}

const registeredWindowParameters =
  new WeakMap<SceneParameterStore, Map<ParameterPath, FloatingWindowParameterRegistration>>();

export const DEFAULT_FLOATING_WINDOW_MIN_SIZE = vec2(240, 120);

export function createDefaultFloatingWindowState(options: FloatingWindowStateOptions = {}): FloatingWindowState {
  const viewportWidth = options.viewportWidth ?? getViewportWidth();
  const viewportHeight = options.viewportHeight ?? getViewportHeight();
  const margin = options.margin ?? 14;
  const minSize = options.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE;
  const maxSize = options.maxSize ?? vec2(720, 240);
  const width = constrainDimension(
    options.width ?? Math.min(maxSize.x, Math.max(minSize.x, viewportWidth - margin * 2)),
    minSize.x,
    maxSize.x
  );
  const height = constrainDimension(
    options.height ?? Math.min(maxSize.y, Math.max(minSize.y, viewportHeight * 0.38)),
    minSize.y,
    maxSize.y
  );
  return {
    position: vec2(margin, Math.max(margin, viewportHeight - height - margin)),
    size: vec2(width, height),
    visible: options.visible ?? true
  };
}

export function registerFloatingWindowParameters(
  store: SceneParameterStore,
  options: RegisterFloatingWindowParametersOptions
): void {
  const minSize = options.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE;
  const records = new Map<ParameterPath, FloatingWindowParameterRegistration>([
    [options.paths.position, {
      kind: "position",
      initialValue: cloneVec2(options.initialState.position)
    }],
    [options.paths.size, {
      kind: "size",
      initialValue: cloneVec2(options.initialState.size),
      minSize: cloneVec2(minSize)
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
    } else if (store.has(path)) {
      throw new Error(`Floating window parameter path is already registered outside window-runtime: ${path}`);
    }
  }

  for (const [path, record] of records) {
    if (storeRecords.has(path)) continue;
    registerFloatingWindowParameter(store, path, record);
    storeRecords.set(path, cloneRegistration(record));
  }
}

export function cloneFloatingWindowState(state: FloatingWindowState): FloatingWindowState {
  return {
    position: cloneVec2(state.position),
    size: cloneVec2(state.size),
    visible: state.visible
  };
}

function registerFloatingWindowParameter(
  store: SceneParameterStore,
  path: ParameterPath,
  record: FloatingWindowParameterRegistration
): void {
  if (record.kind === "position") {
    assertVec2(record.initialValue);
    store.register({
      path,
      initialValue: record.initialValue,
      allowedOperations: ["set", "add", "reset"],
      merge: "set-then-add",
      validateValue: assertVec2,
      validateDelta: assertVec2,
      add: addVec2,
      clone: cloneVec2,
      equals: equalsVec2
    });
    return;
  }

  if (record.kind === "size") {
    assertVec2(record.initialValue);
    const minSize = record.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE;
    store.register({
      path,
      initialValue: record.initialValue,
      allowedOperations: ["set", "add", "reset"],
      merge: "set-then-add",
      validateValue: assertVec2,
      validateDelta: assertVec2,
      add: addVec2,
      constrain: (value) => constrainSize(value, minSize),
      clone: cloneVec2,
      equals: equalsVec2
    });
    return;
  }

  assertBoolean(record.initialValue);
  store.register({
    path,
    initialValue: record.initialValue,
    allowedOperations: ["set", "reset"],
    merge: "last-write-wins",
    validateValue: assertBoolean
  });
}

function getStoreRecords(store: SceneParameterStore): Map<ParameterPath, FloatingWindowParameterRegistration> {
  const existing = registeredWindowParameters.get(store);
  if (existing) return existing;
  const records = new Map<ParameterPath, FloatingWindowParameterRegistration>();
  registeredWindowParameters.set(store, records);
  return records;
}

function assertSameRegistration(
  path: ParameterPath,
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
  return equalsVec2(
    existing.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE,
    next.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE
  );
}

function isSameInitialValue(a: Vec2 | boolean, b: Vec2 | boolean): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") {
    return a === b;
  }
  return equalsVec2(a, b);
}

function cloneRegistration(record: FloatingWindowParameterRegistration): FloatingWindowParameterRegistration {
  return {
    kind: record.kind,
    initialValue: typeof record.initialValue === "boolean" ? record.initialValue : cloneVec2(record.initialValue),
    minSize: record.minSize ? cloneVec2(record.minSize) : undefined
  };
}

function constrainSize(value: Vec2, minSize: Vec2): Vec2 {
  return {
    x: Math.max(minSize.x, value.x),
    y: Math.max(minSize.y, value.y)
  };
}

function constrainDimension(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function assertBoolean(value: unknown): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error("Expected a boolean value.");
  }
}

function getViewportWidth(): number {
  return typeof window === "undefined" ? 720 : window.innerWidth;
}

function getViewportHeight(): number {
  return typeof window === "undefined" ? 720 : window.innerHeight;
}

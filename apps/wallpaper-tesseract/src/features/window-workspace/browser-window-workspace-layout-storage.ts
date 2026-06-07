import type { WindowWorkspaceFrameLayoutStorage } from "../../window-runtime";

const WINDOW_NAME_STORAGE_MARKER = "wallpaper-tesseract.windowWorkspaceLayoutStorage";

interface BrowserWindowWorkspaceLayoutStorageTarget {
  localStorage?: WindowWorkspaceFrameLayoutStorage;
  sessionStorage?: WindowWorkspaceFrameLayoutStorage;
  name?: string;
}

export interface BrowserWindowWorkspaceLayoutStorageOptions {
  readonly resetKeys?: readonly string[];
}

interface WindowNameStorageEnvelope {
  readonly marker: typeof WINDOW_NAME_STORAGE_MARKER;
  readonly items: Record<string, string>;
}

export function createBrowserWindowWorkspaceFrameLayoutStorage(
  target: BrowserWindowWorkspaceLayoutStorageTarget,
  options: BrowserWindowWorkspaceLayoutStorageOptions = {}
): WindowWorkspaceFrameLayoutStorage | null {
  const storage = readBrowserStorage(target, "localStorage") ??
    readBrowserStorage(target, "sessionStorage") ??
    createWindowNameStorage(target);
  if (storage) {
    resetStorageKeys(storage, options.resetKeys ?? []);
  }
  return storage;
}

function readBrowserStorage(
  target: BrowserWindowWorkspaceLayoutStorageTarget,
  property: "localStorage" | "sessionStorage"
): WindowWorkspaceFrameLayoutStorage | null {
  try {
    return target[property] ?? null;
  } catch {
    return null;
  }
}

function createWindowNameStorage(
  target: BrowserWindowWorkspaceLayoutStorageTarget
): WindowWorkspaceFrameLayoutStorage | null {
  if (typeof target.name !== "string") return null;
  return {
    getItem(key) {
      return readWindowNameItems(target)[key] ?? null;
    },
    setItem(key, value) {
      writeWindowNameItems(target, {
        ...readWindowNameItems(target),
        [key]: value
      });
    },
    removeItem(key) {
      const items = { ...readWindowNameItems(target) };
      delete items[key];
      writeWindowNameItems(target, items);
    }
  };
}

function resetStorageKeys(
  storage: WindowWorkspaceFrameLayoutStorage,
  keys: readonly string[]
): void {
  if (!storage.removeItem) return;
  for (const key of keys) {
    storage.removeItem(key);
  }
}

function readWindowNameItems(target: BrowserWindowWorkspaceLayoutStorageTarget): Record<string, string> {
  const raw = target.name;
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<WindowNameStorageEnvelope>;
    if (parsed.marker !== WINDOW_NAME_STORAGE_MARKER || !isRecord(parsed.items)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed.items)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}

function writeWindowNameItems(
  target: BrowserWindowWorkspaceLayoutStorageTarget,
  items: Record<string, string>
): void {
  target.name = JSON.stringify({
    marker: WINDOW_NAME_STORAGE_MARKER,
    items
  } satisfies WindowNameStorageEnvelope);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

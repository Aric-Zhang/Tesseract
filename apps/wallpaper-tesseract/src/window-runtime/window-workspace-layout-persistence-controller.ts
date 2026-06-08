import type { UiScheduledService } from "ui-framework";
import type { WindowFrameLayoutSnapshotSource } from "./window-frame-lifecycle";
import {
  parsePersistedWindowWorkspaceFrameLayout,
  serializeWindowWorkspaceFrameLayout,
  type PersistedWindowWorkspaceFrameLayout
} from "./window-workspace-layout-persistence";

export const WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY =
  "wallpaper-tesseract.windowWorkspaceFrameLayout.v1";

export const WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_CONTROLLER_ID =
  "window-workspace-frame-layout-persistence-controller";

export interface WindowWorkspaceFrameLayoutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface WindowWorkspaceFrameLayoutPersistenceControllerOptions {
  readonly source: WindowFrameLayoutSnapshotSource;
  readonly storage: WindowWorkspaceFrameLayoutStorage | null;
  readonly key?: string;
  readonly onError?: (error: unknown) => void;
}

export class WindowWorkspaceFrameLayoutPersistenceController implements UiScheduledService {
  readonly id = WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_CONTROLLER_ID;
  readonly priority = 10_000;
  enabled = true;

  readonly #source: WindowFrameLayoutSnapshotSource;
  readonly #storage: WindowWorkspaceFrameLayoutStorage | null;
  readonly #key: string;
  readonly #onError?: (error: unknown) => void;
  #lastSerialized: string | null = null;

  constructor(options: WindowWorkspaceFrameLayoutPersistenceControllerOptions) {
    this.#source = options.source;
    this.#storage = options.storage;
    this.#key = options.key ?? WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY;
    this.#onError = options.onError;
  }

  updateFrame(): void {
    this.persistNow();
  }

  persistNow(): boolean {
    if (!this.enabled || !this.#storage) return false;
    try {
      const serialized = JSON.stringify(serializeWindowWorkspaceFrameLayout(
        this.#source.createFrameLayoutSnapshot()
      ));
      if (serialized === this.#lastSerialized) return false;
      this.#storage.setItem(this.#key, serialized);
      this.#lastSerialized = serialized;
      return true;
    } catch (error) {
      this.#onError?.(error);
      return false;
    }
  }

  dispose(): void {
    this.enabled = false;
  }
}

export function loadPersistedWindowWorkspaceFrameLayout(
  storage: WindowWorkspaceFrameLayoutStorage | null,
  key = WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY
): PersistedWindowWorkspaceFrameLayout | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return parsePersistedWindowWorkspaceFrameLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

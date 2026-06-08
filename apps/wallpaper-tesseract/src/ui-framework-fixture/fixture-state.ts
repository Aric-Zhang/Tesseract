import type {
  UiFrame,
  UiLayoutStateReader,
  UiScheduledService,
  UiSchedulerRegistration
} from "../window-runtime";

export class UiFixtureLayoutState implements UiLayoutStateReader {
  readonly #values = new Map<string, unknown>();

  constructor(initialValues: Readonly<Record<string, unknown>> = {}) {
    for (const [path, value] of Object.entries(initialValues)) {
      this.#values.set(path, value);
    }
  }

  get<TValue = unknown>(path: string): TValue {
    return this.#values.get(path) as TValue;
  }

  set(path: string, value: unknown): void {
    this.#values.set(path, value);
  }
}

export class UiFixtureScheduler {
  readonly #services: UiScheduledService[] = [];
  #frameIndex = 0;

  register(service: UiScheduledService): UiSchedulerRegistration {
    this.#services.push(service);
    return {
      dispose: () => {
        const index = this.#services.indexOf(service);
        if (index >= 0) {
          this.#services.splice(index, 1);
        }
      }
    };
  }

  tick(frame: Partial<UiFrame> = {}): void {
    const nextFrame: UiFrame = {
      timeMs: frame.timeMs ?? this.#frameIndex * 16,
      deltaMs: frame.deltaMs ?? 16,
      frameIndex: frame.frameIndex ?? this.#frameIndex
    };
    this.#frameIndex += 1;
    for (const service of [...this.#services].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))) {
      if (service.enabled === false) continue;
      service.updateFrame?.(nextFrame);
    }
  }

  dispose(): void {
    this.#services.length = 0;
  }
}

export class UiFixtureLayoutStorage {
  readonly #values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }
}

export class UiFixtureBrowserLayoutStorage {
  readonly #storage: Storage;
  readonly #mirrorDocument: Document | null;

  constructor(storage: Storage, options: {
    readonly mirrorDocument?: Document | null;
    readonly resetKeys?: readonly string[];
  } = {}) {
    this.#storage = storage;
    this.#mirrorDocument = options.mirrorDocument ?? null;
    for (const key of options.resetKeys ?? []) {
      this.#storage.removeItem(key);
    }
  }

  getItem(key: string): string | null {
    return this.#storage.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.#storage.setItem(key, value);
    this.mirror(key, value);
  }

  removeItem(key: string): void {
    this.#storage.removeItem(key);
    this.mirror(key, null);
  }

  private mirror(key: string, value: string | null): void {
    if (!this.#mirrorDocument) return;
    this.#mirrorDocument.documentElement.dataset.uiFixtureStorageKey = key;
    if (value === null) {
      delete this.#mirrorDocument.documentElement.dataset.uiFixtureStoredLayout;
    } else {
      this.#mirrorDocument.documentElement.dataset.uiFixtureStoredLayout = value;
    }
  }
}

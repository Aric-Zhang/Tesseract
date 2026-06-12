import type { Actor } from "actor-core";
import type {
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "./window-content-registry";
import {
  createWindowViewIdentity,
  type WindowViewIdentity,
  type WindowViewInstanceId,
  type WindowViewMultiplicity,
  type WindowViewTypeKey
} from "../model/window-view-identity";
import type { WindowViewKey } from "../model/window-view-key";

export interface WindowViewFactoryCreateOptions {
  readonly reason: "menu" | "programmatic";
}

export interface WindowViewRuntimeCreateRequest extends WindowViewFactoryCreateOptions {
  readonly parentFrameActor: Actor;
}

export interface WindowViewRuntimeCreateOptions extends WindowViewRuntimeCreateRequest {
  readonly identity: WindowViewIdentity;
  readonly contentRegistration: WindowContentRegistrationPort;
}

export interface WindowViewRuntimeFactoryResult {
  readonly viewActor: Actor;
  readonly content: WindowRegisteredContent;
  readonly title?: string;
  disposeViewRuntime(): void;
}

export interface WindowViewFactory {
  readonly viewKey: WindowViewKey;
  readonly typeKey?: WindowViewTypeKey;
  readonly instanceId?: WindowViewInstanceId | null;
  readonly multiplicity?: WindowViewMultiplicity;
  readonly label: string;
  readonly order?: number;
  readonly group?: string | null;
  readonly enabled?: boolean;
  createViewRuntime(options: WindowViewRuntimeCreateOptions): WindowViewRuntimeFactoryResult;
}

export interface WindowViewTypeRegistration extends WindowViewFactory {
  readonly typeKey: WindowViewTypeKey;
}

export function getWindowViewFactoryIdentity(factory: WindowViewFactory): WindowViewIdentity {
  return createWindowViewIdentity({
    viewKey: factory.viewKey,
    typeKey: factory.typeKey,
    instanceId: factory.instanceId,
    multiplicity: factory.multiplicity
  });
}

export class WindowViewFactoryRegistry {
  readonly #factories = new Map<WindowViewKey, WindowViewFactory>();
  readonly #factoriesByType = new Map<WindowViewTypeKey, WindowViewFactory[]>();

  register(factory: WindowViewFactory): { dispose(): void } {
    if (this.#factories.has(factory.viewKey)) {
      throw new Error(`Window view factory is already registered: ${factory.viewKey}.`);
    }
    const typeKey = getWindowViewFactoryIdentity(factory).typeKey;
    this.#factories.set(factory.viewKey, factory);
    this.#factoriesByType.set(typeKey, [
      ...(this.#factoriesByType.get(typeKey) ?? []),
      factory
    ]);
    return {
      dispose: () => {
        if (this.#factories.get(factory.viewKey) === factory) {
          this.#factories.delete(factory.viewKey);
          const remaining = (this.#factoriesByType.get(typeKey) ?? [])
            .filter((candidate) => candidate !== factory);
          if (remaining.length > 0) {
            this.#factoriesByType.set(typeKey, remaining);
          } else {
            this.#factoriesByType.delete(typeKey);
          }
        }
      }
    };
  }

  get(viewKey: WindowViewKey): WindowViewFactory | null {
    return this.#factories.get(viewKey) ?? null;
  }

  getIdentity(viewKey: WindowViewKey): WindowViewIdentity {
    const factory = this.get(viewKey);
    if (!factory) {
      throw new Error(`Window view factory is not registered: ${viewKey}.`);
    }
    return getWindowViewFactoryIdentity(factory);
  }

  listByType(typeKey: WindowViewTypeKey): readonly WindowViewFactory[] {
    return [...(this.#factoriesByType.get(typeKey) ?? [])];
  }

  list(): readonly WindowViewFactory[] {
    return [...this.#factories.values()];
  }

  createViewRuntime(
    viewKey: WindowViewKey,
    options: WindowViewRuntimeCreateRequest & {
      readonly contentRegistration: WindowContentRegistrationPort;
    }
  ): WindowViewRuntimeFactoryResult {
    const factory = this.get(viewKey);
    if (!factory) {
      throw new Error(`Window view factory is not registered: ${viewKey}.`);
    }
    return factory.createViewRuntime({
      ...options,
      identity: getWindowViewFactoryIdentity(factory)
    });
  }
}

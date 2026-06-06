import type { Actor } from "../actor-runtime";
import type { WindowContentRehostable } from "./floating-window-host";
import {
  createWindowViewIdentity,
  type WindowViewIdentity,
  type WindowViewInstanceId,
  type WindowViewMultiplicity,
  type WindowViewTypeKey
} from "./window-view-identity";
import type { WindowViewKey } from "./window-view-key";

export interface WindowViewFactoryCreateOptions {
  readonly reason: "menu" | "programmatic";
}

export interface WindowViewRuntimeCreateRequest extends WindowViewFactoryCreateOptions {
  readonly parentFrameActor: Actor;
}

export interface WindowViewRuntimeCreateOptions extends WindowViewRuntimeCreateRequest {
  readonly identity: WindowViewIdentity;
}

export interface WindowViewRuntimeFactoryResult {
  readonly viewActor: Actor;
  readonly content: WindowContentRehostable;
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

  register(factory: WindowViewFactory): { dispose(): void } {
    if (this.#factories.has(factory.viewKey)) {
      throw new Error(`Window view factory is already registered: ${factory.viewKey}.`);
    }
    this.#factories.set(factory.viewKey, factory);
    return {
      dispose: () => {
        if (this.#factories.get(factory.viewKey) === factory) {
          this.#factories.delete(factory.viewKey);
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

  list(): readonly WindowViewFactory[] {
    return [...this.#factories.values()];
  }

  createViewRuntime(
    viewKey: WindowViewKey,
    options: WindowViewRuntimeCreateRequest
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

import type { Actor } from "../actor-runtime";
import type { WindowContentRehostable } from "./floating-window-host";
import type { WindowFramePort } from "./window-frame-port";
import {
  createSingletonWindowViewIdentity,
  type WindowViewIdentity,
  type WindowViewMultiplicity,
  type WindowViewTypeKey
} from "./window-view-identity";
import type { WindowViewKey } from "./window-view-key";

export interface WindowViewFactoryCreateOptions {
  readonly reason: "menu" | "programmatic";
}

export interface WindowViewFactoryResult {
  readonly frameActor: Actor;
  readonly framePort: WindowFramePort;
  readonly viewActor: Actor;
  readonly content: WindowContentRehostable;
  dispose?(): void;
}

export interface WindowViewFactory {
  readonly viewKey: WindowViewKey;
  readonly typeKey?: WindowViewTypeKey;
  readonly multiplicity?: WindowViewMultiplicity;
  readonly label: string;
  readonly order?: number;
  readonly group?: string | null;
  readonly enabled?: boolean;
  create(options: WindowViewFactoryCreateOptions): WindowViewFactoryResult;
}

export function getWindowViewFactoryIdentity(factory: WindowViewFactory): WindowViewIdentity {
  return {
    ...createSingletonWindowViewIdentity(factory.viewKey, factory.typeKey),
    multiplicity: factory.multiplicity ?? "singleton"
  };
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

  list(): readonly WindowViewFactory[] {
    return [...this.#factories.values()];
  }

  create(viewKey: WindowViewKey, options: WindowViewFactoryCreateOptions): WindowViewFactoryResult {
    const factory = this.get(viewKey);
    if (!factory) {
      throw new Error(`Window view factory is not registered: ${viewKey}.`);
    }
    return factory.create(options);
  }
}

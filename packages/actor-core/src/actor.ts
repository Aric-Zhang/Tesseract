import type { Component, ComponentType } from "./component";

export interface Actor {
  readonly id: string;
  readonly name: string;
  enabled: boolean;
  getComponent<T extends Component>(type: ComponentType<T>): T | null;
  getComponents<T extends Component>(type: ComponentType<T>): readonly T[];
  listComponents(): readonly Component[];
  hasComponent(type: ComponentType): boolean;
}

export interface ActorOptions {
  id?: string;
  name?: string;
  enabled?: boolean;
  parent?: Actor | string | null;
}

interface ActorImplOptions {
  id: string;
  name: string;
  enabled: boolean;
}

export class ActorImpl implements Actor {
  readonly id: string;
  readonly name: string;
  enabled: boolean;
  #components: Component[] = [];

  constructor(options: ActorImplOptions) {
    this.id = options.id;
    this.name = options.name;
    this.enabled = options.enabled;
  }

  getComponent<T extends Component>(type: ComponentType<T>): T | null {
    return (this.#components.find((component) => component.type === type) as T | undefined) ?? null;
  }

  getComponents<T extends Component>(type: ComponentType<T>): readonly T[] {
    return this.#components.filter((component) => component.type === type) as T[];
  }

  hasComponent(type: ComponentType): boolean {
    return this.#components.some((component) => component.type === type);
  }

  listComponents(): readonly Component[] {
    return [...this.#components];
  }

  hasComponentInstance(component: Component): boolean {
    return this.#components.includes(component);
  }

  attachComponent(component: Component): void {
    if (!this.#components.includes(component)) {
      this.#components.push(component);
    }
  }

  detachComponent(component: Component): void {
    const index = this.#components.indexOf(component);
    if (index >= 0) {
      this.#components.splice(index, 1);
    }
  }
}

export function isActorImpl(actor: Actor): actor is ActorImpl {
  return actor instanceof ActorImpl;
}

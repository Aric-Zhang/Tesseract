import type { Actor } from "./actor";
import type { ComponentAttachmentDescriptor } from "./component-attachment-runtime";

export type ComponentType<T extends Component = Component> = string & { readonly __componentType?: T };
export type ComponentDefinitionKind = "business" | "binding";

export interface Component {
  readonly id: string;
  readonly type: string;
  readonly actor: Actor;
  enabled: boolean;
  onAttach?(): void;
  onDetach?(): void;
  dispose?(): void;
}

export interface ComponentLifecycleObserver extends Component {
  canDetach?(component: Component): boolean;
  beforeComponentDetach?(component: Component): void;
}

export interface ActorSystemView {
  getActor(id: string): Actor | null;
  listActors(): readonly Actor[];
  listActorsInTreeOrder(): readonly Actor[];
  hasActor(actor: Actor): boolean;
  isActorActive(actor: Actor): boolean;
  getParentId(actor: Actor): string | null;
  listChildren(actor: Actor): readonly Actor[];
}

export interface ComponentRegistryView {
  getComponent<T extends Component>(actor: Actor, type: ComponentType<T>): T | null;
  getComponents<T extends Component>(actor: Actor, type: ComponentType<T>): readonly T[];
  hasComponent(actor: Actor, type: ComponentType): boolean;
}

export interface BusinessComponentContext {
  readonly actorSystem: ActorSystemView;
  readonly componentRegistry: ComponentRegistryView;
}

export interface BindingComponentContext extends BusinessComponentContext {}

export type ComponentContext = BusinessComponentContext | BindingComponentContext;

export interface ComponentRequirement<TOptions = unknown> {
  readonly type: ComponentType;
  readonly autoAdd?: boolean;
  readonly reuseExisting?: boolean;
  readonly options?: TOptions | (() => TOptions);
}

export interface ComponentIdOptions {
  readonly id?: string;
}

export interface ComponentDefinition<T extends Component = Component, TOptions = unknown> {
  readonly type: ComponentType<T>;
  readonly kind?: ComponentDefinitionKind;
  readonly singleton?: boolean;
  readonly requires?: readonly ComponentRequirement[];
  readonly attachments?: readonly ComponentAttachmentDescriptor[];
  createId?(actor: Actor, options?: TOptions): string;
  create(actor: Actor, context: ComponentContext, options?: TOptions): T;
}

export function componentType<T extends Component>(type: string): ComponentType<T> {
  return type as ComponentType<T>;
}

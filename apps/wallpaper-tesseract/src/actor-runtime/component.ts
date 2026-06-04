import type { GizmoController } from "gizmo-core";
import type { SceneCommandSink, SceneFrame, SceneStateObserver } from "../scene-runtime";
import type { Actor } from "./actor";

export type ComponentType<T extends Component = Component> = string & { readonly __componentType?: T };
export type ComponentDefinitionKind = "business" | "binding";
export type ComponentCapability =
  | "frame"
  | "gizmo-controller-binding"
  | "state-observer-binding"
  // Transitional capabilities kept until the binding components replace direct adapters.
  | "gizmo"
  | "state-observer";

export interface Component {
  readonly id: string;
  readonly type: string;
  readonly actor: Actor;
  enabled: boolean;
  onAttach?(): void;
  updateFrame?(frame: SceneFrame): void;
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

export type ActorWindowFocusReason =
  | "pointer-down"
  | "menu-restore"
  | "programmatic";

export interface ActorWindowFocusService {
  getEffectiveStackPriorityForActor(actor: Actor): number | null;
  focusActorWindow(actor: Actor, reason: ActorWindowFocusReason): void;
  requestFocusOnVisible(actor: Actor, reason: ActorWindowFocusReason): void;
}

export interface BusinessComponentContext {
  readonly actorSystem: ActorSystemView;
  readonly componentRegistry: ComponentRegistryView;
  readonly services: {
    readonly commandSink: SceneCommandSink;
    readonly actorWindowFocus?: ActorWindowFocusService;
  };
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
  readonly capabilities?: readonly ComponentCapability[];
  createId?(actor: Actor, options?: TOptions): string;
  create(actor: Actor, context: ComponentContext, options?: TOptions): T;
}

export type GizmoCapableComponent = Component & GizmoController;
export type StateObserverCapableComponent = Component & SceneStateObserver;

export function componentType<T extends Component>(type: string): ComponentType<T> {
  return type as ComponentType<T>;
}

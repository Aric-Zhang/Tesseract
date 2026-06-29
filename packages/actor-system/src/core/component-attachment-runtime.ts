import type { Actor } from "./actor";
import type { Component } from "./component";

export interface ComponentAttachmentRegistration {
  dispose(): void;
}

export type ComponentAttachmentKind = string & {
  readonly __componentAttachmentKind?: never;
};

export interface ComponentAttachmentDescriptor<TOptions = unknown> {
  readonly kind: ComponentAttachmentKind;
  readonly options?: TOptions;
}

export interface ComponentAttachmentRuntime {
  attach(
    actor: Actor,
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration;
}

export function componentAttachmentKind(kind: string): ComponentAttachmentKind {
  return kind as ComponentAttachmentKind;
}

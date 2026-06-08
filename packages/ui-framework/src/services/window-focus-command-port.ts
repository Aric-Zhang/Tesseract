import type { Actor } from "actor-core";

export type WindowFocusReason =
  | "pointer-down"
  | "menu-restore"
  | "programmatic";

export interface WindowFocusCommandPort {
  focusActorWindow(actor: Actor, reason: WindowFocusReason): void;
  requestFocusOnVisible(actor: Actor, reason: WindowFocusReason): void;
}

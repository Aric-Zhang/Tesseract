import type { Actor } from "../actor-runtime";

export type WindowFocusReason =
  | "pointer-down"
  | "menu-restore"
  | "programmatic";

export interface WindowFocusCommandPort {
  focusActorWindow(actor: Actor, reason: WindowFocusReason): void;
  requestFocusOnVisible(actor: Actor, reason: WindowFocusReason): void;
}

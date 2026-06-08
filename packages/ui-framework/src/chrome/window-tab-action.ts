import type { WindowFrameTab } from "../model/window-frame-tab";
import { createSingletonWindowViewIdentity, type WindowViewIdentity } from "../model/window-view-identity";
import type { WindowViewKey } from "../model/window-view-key";

export type WindowTabAction =
  | {
      readonly kind: "close-view";
      readonly viewActorId: string;
      readonly identity: WindowViewIdentity;
      readonly viewKey: WindowViewKey;
    };

export function createWindowTabCloseAction(tab: WindowFrameTab): WindowTabAction {
  return {
    kind: "close-view",
    viewActorId: tab.viewActorId,
    identity: tab.identity ?? createSingletonWindowViewIdentity(tab.viewKey),
    viewKey: tab.viewKey
  };
}

export function isWindowTabAction(value: unknown): value is WindowTabAction {
  if (typeof value !== "object" || value === null || !("kind" in value)) return false;
  const candidate = value as Partial<WindowTabAction>;
  return candidate.kind === "close-view" &&
    typeof candidate.viewActorId === "string" &&
    typeof candidate.identity === "object" &&
    candidate.identity !== null &&
    typeof candidate.viewKey === "string";
}

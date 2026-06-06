import type { WindowFrameTab } from "./window-frame-port";
import type { WindowViewKey } from "./window-view-key";

export type WindowTabAction =
  | {
      readonly kind: "close-view";
      readonly viewActorId: string;
      readonly viewKey: WindowViewKey;
    };

export function createWindowTabCloseAction(tab: WindowFrameTab): WindowTabAction {
  return {
    kind: "close-view",
    viewActorId: tab.viewActorId,
    viewKey: tab.viewKey
  };
}

export function isWindowTabAction(value: unknown): value is WindowTabAction {
  if (typeof value !== "object" || value === null || !("kind" in value)) return false;
  const candidate = value as Partial<WindowTabAction>;
  return candidate.kind === "close-view" &&
    typeof candidate.viewActorId === "string" &&
    typeof candidate.viewKey === "string";
}

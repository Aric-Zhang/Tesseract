import type { ActorInputHit } from "actor-input";
import type { WindowFrameTab } from "../model/window-frame-tab";
import type { WindowTabDragSource } from "../model/window-tab-drag-session";

export type WindowFrameSurfaceSplitDirection = "horizontal" | "vertical";

export interface FloatingWindowSplitterHitData {
  readonly splitId: string;
  readonly direction: WindowFrameSurfaceSplitDirection;
}

export function readWindowTabDragSource(frameId: string, hit: ActorInputHit): WindowTabDragSource | null {
  const data = hit.data;
  if (typeof data !== "object" || data === null || !("tab" in data)) return null;
  const tab = (data as { tab?: Partial<WindowFrameTab> }).tab;
  if (
    !tab ||
    typeof tab.viewActorId !== "string" ||
    typeof tab.viewKey !== "string"
  ) {
    return null;
  }
  const tabsetId = (data as { tabsetId?: unknown }).tabsetId;
  const sourceTabsetId = typeof tabsetId === "string"
    ? tabsetId
    : undefined;
  return {
    frameId,
    sourceTabsetId,
    viewActorId: tab.viewActorId,
    viewKey: tab.viewKey
  };
}

export function readFloatingWindowSplitterHitData(hit: ActorInputHit): FloatingWindowSplitterHitData | null {
  const data = hit.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("splitId" in data) ||
    !("direction" in data)
  ) {
    return null;
  }
  const splitId = (data as { splitId?: unknown }).splitId;
  const direction = (data as { direction?: unknown }).direction;
  if (
    typeof splitId !== "string" ||
    (direction !== "horizontal" && direction !== "vertical")
  ) {
    return null;
  }
  return { splitId, direction };
}

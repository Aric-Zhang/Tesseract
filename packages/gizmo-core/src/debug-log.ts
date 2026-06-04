import type { ScreenDelta, ScreenPoint } from "./types";

export type GizmoDebugLogType =
  | "pointerdown"
  | "pointermove"
  | "pointerup"
  | "pointercancel"
  | "hit"
  | "miss"
  | "start"
  | "move"
  | "end"
  | "cancel"
  | "double-click"
  | "ignore";

export interface GizmoDebugLogEntry {
  type: GizmoDebugLogType;
  message: string;
  timeStamp?: number;
  pointerId?: number;
  pointerType?: string;
  button?: number;
  buttons?: number;
  point?: ScreenPoint;
  gizmoId?: string;
  partId?: string;
  reason?: string;
  delta?: ScreenDelta;
  totalDelta?: ScreenDelta;
  isDragging?: boolean;
  capture?: boolean;
}

export function formatGizmoDebugLog(entry: GizmoDebugLogEntry): string {
  const parts: string[] = [entry.type];
  if (entry.reason) parts.push(`reason=${entry.reason}`);
  if (entry.gizmoId) parts.push(`gizmo=${entry.gizmoId}`);
  if (entry.partId) parts.push(`part=${entry.partId}`);
  if (entry.pointerId !== undefined) parts.push(`pid=${entry.pointerId}`);
  if (entry.pointerType) parts.push(`type=${entry.pointerType}`);
  if (entry.button !== undefined) parts.push(`button=${entry.button}`);
  if (entry.buttons !== undefined) parts.push(`buttons=${entry.buttons}`);
  if (entry.point) parts.push(`xy=${Math.round(entry.point.x)},${Math.round(entry.point.y)}`);
  if (entry.delta) parts.push(`d=${Math.round(entry.delta.dx)},${Math.round(entry.delta.dy)}`);
  if (entry.totalDelta) parts.push(`td=${Math.round(entry.totalDelta.dx)},${Math.round(entry.totalDelta.dy)}`);
  if (entry.isDragging !== undefined) parts.push(`drag=${entry.isDragging ? "1" : "0"}`);
  if (entry.capture !== undefined) parts.push(`capture=${entry.capture ? "1" : "0"}`);
  return parts.join(" ");
}

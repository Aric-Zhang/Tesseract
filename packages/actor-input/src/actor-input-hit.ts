import type { Component } from "actor-core";
import type { ActorInputParticipant } from "./actor-input-participant";

export type ActorInputHitKind = "chrome" | "content" | "control" | "scrollbar" | "overlay" | "custom";

export type ActorInputHitRegion =
  | "window-frame"
  | "window-content"
  | "content-control"
  | "actor-overlay"
  | "custom";

export type ActorInputPathRole = "surface" | "container" | "control" | "overlay";

export interface ActorInputPathNode {
  readonly componentId: string;
  readonly role: ActorInputPathRole;
  readonly partId?: string;
}

export const actorInputScopeRoutePriority = {
  windowContent: 0,
  contentControl: 1000,
  actorOverlay: 2000,
  windowChrome: 3000,
  appOverlay: 4000
} as const;

export interface ActorInputHit {
  readonly componentId: string;
  readonly partId: string;
  readonly kind: ActorInputHitKind;
  readonly region: ActorInputHitRegion;
  readonly scopeRoutePriority?: number;
  readonly localRoutePriority: number;
  readonly hitPriority?: number;
  readonly path: readonly ActorInputPathNode[];
  readonly data?: unknown;
}

export interface ActorInputSelection {
  readonly target: ActorInputParticipant;
  readonly hit: ActorInputHit;
  readonly pathComponents: readonly Component[];
  readonly stackPriority: number;
  readonly scopeRoutePriority: number;
  readonly scopeRouteScore: number;
  readonly routeScore: number;
}

export function getActorInputScopeRoutePriority(hit: ActorInputHit): number {
  if (typeof hit.scopeRoutePriority === "number") return hit.scopeRoutePriority;
  if (hit.region === "window-frame") return actorInputScopeRoutePriority.windowChrome;
  if (hit.region === "actor-overlay") return actorInputScopeRoutePriority.actorOverlay;
  if (hit.region === "content-control") return actorInputScopeRoutePriority.contentControl;
  if (hit.region === "window-content") return actorInputScopeRoutePriority.windowContent;
  return actorInputScopeRoutePriority.contentControl;
}


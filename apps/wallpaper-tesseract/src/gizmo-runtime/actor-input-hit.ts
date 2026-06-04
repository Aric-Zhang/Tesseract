import type { Component } from "../actor-runtime";
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

export interface ActorInputHit {
  readonly componentId: string;
  readonly partId: string;
  readonly kind: ActorInputHitKind;
  readonly region: ActorInputHitRegion;
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
  readonly routeScore: number;
}

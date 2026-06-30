import type { ActorSelectionSnapshot } from "actor-system/core";

export interface InspectorSelectionSnapshotSource {
  getSelectionSnapshot(): ActorSelectionSnapshot;
}

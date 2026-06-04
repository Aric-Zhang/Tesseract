export type SceneUpdateSourceKind =
  | "gizmo"
  | "property-panel"
  | "pointer"
  | "keyboard"
  | "script"
  | "animation"
  | "debug";

export interface SceneUpdateSource {
  id: string;
  kind: SceneUpdateSourceKind;
}

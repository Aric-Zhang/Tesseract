import type {
  FloatingWindowParameterPaths,
  FloatingWindowState,
  UiVec2,
  WindowViewKey
} from "ui-framework";

export interface EditorWindowWorkspaceFloatingFramePolicy {
  readonly preferredActorId: string;
  readonly preferredComponentId: string;
  readonly paths?: FloatingWindowParameterPaths;
  readonly fallbackState: FloatingWindowState;
  readonly minSize: UiVec2;
  readonly className: string;
  readonly contentClassName?: string;
  readonly priority: number;
  readonly menuOrder?: number;
}

export interface EditorWindowWorkspaceDefaultOpenView {
  readonly viewKey: WindowViewKey;
  readonly preferredFrameId?: string;
}

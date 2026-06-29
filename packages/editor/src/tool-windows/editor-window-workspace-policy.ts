import { type FloatingWindowParameterPaths, type FloatingWindowState, type WindowViewKey } from "ui-framework/window";
import { type UiVec2 } from "ui-framework/actor-ui";

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

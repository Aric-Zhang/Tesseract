import type { WindowViewIdentity } from "./window-view-identity";
import type { WindowViewKey } from "./window-view-key";

export type WindowFramePresentation = "windowed" | "fullscreen";
export type WindowFrameSuppressionReason = "workspace-run";

export interface WindowFrameTab {
  readonly viewActorId: string;
  readonly identity?: WindowViewIdentity;
  readonly viewKey: WindowViewKey;
  readonly title: string;
}

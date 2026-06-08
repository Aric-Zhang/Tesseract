import type { FloatingWindowState } from "ui-framework";
import type {
  WindowContentAttachment,
  WindowContentHost
} from "ui-framework";

export {
  createWindowContentAttachment,
  getWindowContentAttachment
} from "ui-framework";

export type {
  WindowContentAttachment,
  WindowContentAttachmentRequest,
  WindowContentHost,
  WindowContentRehostable
} from "ui-framework";

export interface FloatingWindowHost extends WindowContentHost {
  readonly state: Readonly<FloatingWindowState>;

  setTitle(title: string): void;
  getBounds(): DOMRectReadOnly;
  requestVisible(visible: boolean, timeStamp?: number): void;
}

export type FloatingWindowContentAttachment = WindowContentAttachment;

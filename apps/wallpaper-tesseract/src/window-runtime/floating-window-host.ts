import type { FloatingWindowState } from "./floating-window-state";

export interface FloatingWindowHost {
  readonly id: string;
  readonly state: Readonly<FloatingWindowState>;

  setTitle(title: string): void;
  getBounds(): DOMRectReadOnly;
  mountContent(element: HTMLElement): FloatingWindowContentAttachment;
  requestVisible(visible: boolean, timeStamp?: number): void;
}

export interface FloatingWindowContentAttachment {
  readonly element: HTMLElement;
  dispose(): void;
}

import type { ScreenPoint } from "gizmo-core";
import type { DockTargetFrameSource } from "./dock-target-frame-source";
import type { WindowDockPreview, WindowDockTargetFrame } from "./window-dock-targets";
import { WindowTabDragSession } from "./window-tab-drag-session";
import type {
  WindowTabDragSessionEndResult,
  WindowTabDragSessionState,
  WindowTabDragSource
} from "./window-tab-drag-session";

export interface WindowTabDragSink {
  beginTabDrag(source: WindowTabDragSource, point: ScreenPoint): void;
  moveTabDrag(point: ScreenPoint): void;
  endTabDrag(): WindowTabDragSessionEndResult | null;
  cancelTabDrag(): void;
}

export interface WindowDockPreviewControllerState {
  readonly sessionState: WindowTabDragSessionState;
  readonly source: WindowTabDragSource | null;
  readonly preview: WindowDockPreview | null;
  readonly lastCompletedDrag: WindowTabDragSessionEndResult | null;
}

export interface WindowDockPreviewComponentOptions {
  readonly parent: HTMLElement;
  readonly document?: Pick<Document, "createElement">;
}

export interface WindowDockPreviewControllerOptions extends WindowDockPreviewComponentOptions {
  readonly source: DockTargetFrameSource;
}

export class WindowDockPreviewComponent {
  readonly element: HTMLDivElement;
  #preview: WindowDockPreview | null = null;

  constructor(options: WindowDockPreviewComponentOptions) {
    const documentRef = options.document ?? options.parent.ownerDocument ?? document;
    this.element = documentRef.createElement("div");
    this.element.className = "window-dock-preview";
    this.element.hidden = true;
    this.element.setAttribute("aria-hidden", "true");
    options.parent.append(this.element);
  }

  get preview(): WindowDockPreview | null {
    return this.#preview;
  }

  show(preview: WindowDockPreview): void {
    this.#preview = preview;
    this.element.hidden = false;
    this.element.className = [
      "window-dock-preview",
      `window-dock-preview--${preview.kind}`,
      preview.kind === "split" ? `window-dock-preview--${preview.placement}` : ""
    ].filter(Boolean).join(" ");
    this.element.style.left = `${preview.rect.left}px`;
    this.element.style.top = `${preview.rect.top}px`;
    this.element.style.width = `${preview.rect.width}px`;
    this.element.style.height = `${preview.rect.height}px`;
  }

  clear(): void {
    this.#preview = null;
    this.element.hidden = true;
  }

  dispose(): void {
    this.clear();
    this.element.remove();
  }
}

export class WindowDockPreviewController implements WindowTabDragSink {
  readonly #source: DockTargetFrameSource;
  readonly #session = new WindowTabDragSession();
  readonly #previewComponent: WindowDockPreviewComponent;
  #lastCompletedDrag: WindowTabDragSessionEndResult | null = null;

  constructor(options: WindowDockPreviewControllerOptions) {
    this.#source = options.source;
    this.#previewComponent = new WindowDockPreviewComponent(options);
  }

  get preview(): WindowDockPreview | null {
    return this.#previewComponent.preview;
  }

  get state(): WindowDockPreviewControllerState {
    return {
      sessionState: this.#session.state,
      source: this.#session.source,
      preview: this.#previewComponent.preview,
      lastCompletedDrag: this.#lastCompletedDrag
    };
  }

  beginTabDrag(source: WindowTabDragSource, point: ScreenPoint): void {
    this.#lastCompletedDrag = null;
    this.#session.start({ source, startPoint: point });
    this.#previewComponent.clear();
  }

  moveTabDrag(point: ScreenPoint): void {
    const result = this.#session.move(point, this.listTargetFrames());
    if (result.preview) {
      this.#previewComponent.show(result.preview);
    } else {
      this.#previewComponent.clear();
    }
  }

  endTabDrag(): WindowTabDragSessionEndResult | null {
    const result = this.#session.end();
    this.#lastCompletedDrag = result;
    this.#previewComponent.clear();
    return result;
  }

  cancelTabDrag(): void {
    this.#session.cancel();
    this.#lastCompletedDrag = null;
    this.#previewComponent.clear();
  }

  dispose(): void {
    this.#session.cancel();
    this.#previewComponent.dispose();
  }

  private listTargetFrames(): readonly WindowDockTargetFrame[] {
    return this.#source.listDockTargetFrames();
  }
}

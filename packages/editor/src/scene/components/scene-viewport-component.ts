import type { Actor, Component, ComponentType } from "actor-core";
import type { RuntimeRegistration } from "runtime-core";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "ui-framework";

export const sceneViewportComponentType =
  "scene-viewport-component" as ComponentType<SceneViewportComponent>;

export interface SceneViewportComponentOptions {
  id?: string;
  document?: Pick<Document, "createElement">;
  renderTarget: SceneViewportRenderTarget;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
  createResizeObserver?: SceneViewportResizeObserverFactory;
  devicePixelRatio?: () => number;
}

export interface SceneViewportRenderTarget {
  readonly domElement: HTMLElement;
  setSize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

export interface SceneViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface SceneViewportResizeObserver {
  observe(target: Element): void;
  disconnect(): void;
}

export type SceneViewportResizeObserverFactory = (
  callback: () => void
) => SceneViewportResizeObserver;

export class SceneViewportComponent implements Component, WindowRegisteredContent {
  readonly type = sceneViewportComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly viewportElement: HTMLDivElement;
  readonly canvasHostElement: HTMLDivElement;
  readonly overlayElement: HTMLDivElement;
  enabled = true;

  #registration: WindowRegisteredContent;
  readonly #devicePixelRatio: () => number;
  readonly #renderTarget: SceneViewportRenderTarget;
  readonly #resizeSubscribers: Array<(size: SceneViewportSize) => void> = [];
  readonly #resizeObserver: SceneViewportResizeObserver | null;
  #layoutCommitRegistration: RuntimeRegistration | null = null;
  #lastSize: SceneViewportSize | null = null;

  constructor(
    actor: Actor,
    options: SceneViewportComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? "scene-viewport";
    const documentRef = resolveDocument(options);
    this.#devicePixelRatio = options.devicePixelRatio ?? (() => (
      typeof window === "undefined" ? 1 : window.devicePixelRatio
    ));
    this.#renderTarget = options.renderTarget;
    this.viewportElement = documentRef.createElement("div");
    this.viewportElement.className = "scene-window__viewport";
    this.canvasHostElement = documentRef.createElement("div");
    this.canvasHostElement.className = "scene-window__canvas-host";
    this.overlayElement = documentRef.createElement("div");
    this.overlayElement.className = "scene-window__overlay";
    this.canvasHostElement.append(this.#renderTarget.domElement);
    this.viewportElement.append(this.canvasHostElement, this.overlayElement);
    this.#registration = options.contentRegistration.registerContent({
      contentId: options.contentId,
      element: this.viewportElement
    });
    this.#layoutCommitRegistration = this.#registration.subscribeLayoutCommit((commit) => {
      if (!commit.active || !commit.interactable) return;
      if (commit.contentRect.width <= 0 || commit.contentRect.height <= 0) return;
      this.measureNow();
    });
    this.#resizeObserver = createResizeObserver(options.createResizeObserver, () => this.measureNow());
    this.#resizeObserver?.observe(this.viewportElement);
    this.measureNow();
  }

  get contentId(): string {
    return this.#registration.contentId;
  }

  get element(): HTMLElement {
    return this.viewportElement;
  }

  get interactable(): boolean {
    return this.#registration.interactable;
  }

  setInteractable(interactable: boolean): void {
    this.#registration.setInteractable(interactable);
  }

  subscribeLayoutCommit(
    callback: (commit: WindowContentLayoutCommit) => void
  ): WindowContentLayoutCommitRegistration {
    return this.#registration.subscribeLayoutCommit(callback);
  }

  getSize(): SceneViewportSize | null {
    return this.#lastSize;
  }

  subscribeResize(callback: (size: SceneViewportSize) => void): RuntimeRegistration {
    if (!this.#resizeSubscribers.includes(callback)) {
      this.#resizeSubscribers.push(callback);
    }
    return {
      dispose: () => {
        const index = this.#resizeSubscribers.indexOf(callback);
        if (index >= 0) {
          this.#resizeSubscribers.splice(index, 1);
        }
      }
    };
  }

  measureNow(): void {
    const rect = this.viewportElement.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    if (width <= 0 || height <= 0) return;
    if (this.#lastSize && this.#lastSize.width === width && this.#lastSize.height === height) return;
    const size = { width, height };
    this.#lastSize = size;
    this.#renderTarget.setSize(width, height, this.#devicePixelRatio());
    for (const subscriber of [...this.#resizeSubscribers]) {
      subscriber(size);
    }
  }

  dispose(): void {
    this.enabled = false;
    this.#layoutCommitRegistration?.dispose();
    this.#layoutCommitRegistration = null;
    this.#resizeObserver?.disconnect();
    this.#registration.dispose();
    this.#renderTarget.dispose();
    this.#resizeSubscribers.length = 0;
  }
}

function createResizeObserver(
  factory: SceneViewportResizeObserverFactory | undefined,
  callback: () => void
): SceneViewportResizeObserver | null {
  if (factory) return factory(callback);
  if (typeof ResizeObserver === "undefined") return null;
  return new ResizeObserver(callback);
}

function resolveDocument(options: SceneViewportComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (typeof document !== "undefined") return document;
  throw new Error("SceneViewportComponent requires a document.");
}

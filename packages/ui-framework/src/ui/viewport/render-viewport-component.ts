import type { Actor, Component, ComponentType } from "actor-core";
import type { UiElementComponent } from "../element";

export const renderViewportComponentType =
  "ui-render-viewport-component" as ComponentType<RenderViewportComponent>;

export type RenderViewportTargetOwnership = "owned" | "borrowed";

export interface RenderViewportTarget {
  readonly domElement: HTMLElement;
  setSize(width: number, height: number, pixelRatio: number): void;
  dispose?(): void;
}

export interface RenderViewportSize {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}

export interface RenderViewportRegistration {
  dispose(): void;
}

export interface RenderViewportResizeObserver {
  observe(target: Element): void;
  disconnect(): void;
}

export type RenderViewportResizeObserverFactory = (
  callback: () => void
) => RenderViewportResizeObserver;

export interface RenderViewportComponentOptions {
  readonly id?: string;
  readonly target: RenderViewportTarget;
  readonly targetOwnership?: RenderViewportTargetOwnership;
  readonly createResizeObserver?: RenderViewportResizeObserverFactory;
  readonly devicePixelRatio?: () => number;
}

export class RenderViewportComponent implements Component {
  readonly type = renderViewportComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  readonly target: RenderViewportTarget;
  readonly targetOwnership: RenderViewportTargetOwnership;
  enabled = true;

  readonly #devicePixelRatio: () => number;
  readonly #resizeObserver: RenderViewportResizeObserver | null;
  readonly #resizeSubscribers: Array<(size: RenderViewportSize) => void> = [];
  #lastSize: RenderViewportSize | null = null;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: RenderViewportComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-render-viewport";
    this.element = uiElement.element;
    this.target = options.target;
    this.targetOwnership = options.targetOwnership ?? "borrowed";
    this.#devicePixelRatio = options.devicePixelRatio ?? defaultDevicePixelRatio;

    this.element.classList.add("ui-render-viewport");
    this.element.dataset.uiViewportRole = "render-viewport";
    applyViewportHostStyle(this.element);
    applyTargetStyle(this.target.domElement);
    this.element.append(this.target.domElement);

    this.#resizeObserver = createResizeObserver(options.createResizeObserver, () => this.measureNow());
    this.#resizeObserver?.observe(this.element);
    this.measureNow();
  }

  getSize(): RenderViewportSize | null {
    return cloneSize(this.#lastSize);
  }

  subscribeResize(callback: (size: RenderViewportSize) => void): RenderViewportRegistration {
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

  measureNow(): RenderViewportSize | null {
    if (this.#disposed || !this.enabled) return cloneSize(this.#lastSize);
    const rect = this.element.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    if (width <= 0 || height <= 0) return cloneSize(this.#lastSize);
    const pixelRatio = this.#devicePixelRatio();
    if (
      this.#lastSize &&
      this.#lastSize.width === width &&
      this.#lastSize.height === height &&
      this.#lastSize.pixelRatio === pixelRatio
    ) {
      return cloneSize(this.#lastSize);
    }

    const size = freezeSize({ width, height, pixelRatio });
    this.#lastSize = size;
    this.target.setSize(width, height, pixelRatio);
    for (const subscriber of [...this.#resizeSubscribers]) {
      subscriber(cloneSize(size)!);
    }
    return cloneSize(size);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    this.#resizeObserver?.disconnect();
    this.#resizeSubscribers.length = 0;
    if (this.target.domElement.parentElement === this.element) {
      this.target.domElement.remove();
    }
    if (this.targetOwnership === "owned") {
      this.target.dispose?.();
    }
  }
}

function createResizeObserver(
  factory: RenderViewportResizeObserverFactory | undefined,
  callback: () => void
): RenderViewportResizeObserver | null {
  if (factory) return factory(callback);
  if (typeof ResizeObserver === "undefined") return null;
  return new ResizeObserver(callback);
}

function defaultDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return window.devicePixelRatio;
}

function applyViewportHostStyle(element: HTMLElement): void {
  element.style.position = "relative";
  element.style.width = "100%";
  element.style.height = "100%";
  element.style.overflow = "hidden";
}

function applyTargetStyle(element: HTMLElement): void {
  element.style.display = "block";
  element.style.width = "100%";
  element.style.height = "100%";
}

function cloneSize(size: RenderViewportSize | null): RenderViewportSize | null {
  if (!size) return null;
  return freezeSize({
    width: size.width,
    height: size.height,
    pixelRatio: size.pixelRatio
  });
}

function freezeSize(size: RenderViewportSize): RenderViewportSize {
  return Object.freeze(size);
}

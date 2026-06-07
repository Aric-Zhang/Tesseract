import * as THREE from "three";
import type { Actor, Component, ComponentType } from "../../../actor-runtime";
import type { RuntimeRegistration } from "../../../runtime/ports";
import type {
  WindowContentAttachment,
  WindowContentHost,
  WindowContentRehostable
} from "../../../window-runtime";

export const sceneViewportComponentType =
  "scene-viewport-component" as ComponentType<SceneViewportComponent>;

export interface SceneViewportComponentOptions {
  id?: string;
  document?: Pick<Document, "createElement">;
  createRenderer?: SceneViewportRendererFactory;
  createResizeObserver?: SceneViewportResizeObserverFactory;
  devicePixelRatio?: () => number;
}

export interface SceneViewportRenderer {
  readonly domElement: HTMLElement;
  setClearColor(color: number, alpha: number): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export interface SceneViewportSize {
  readonly width: number;
  readonly height: number;
}

export type SceneViewportRendererFactory = () => SceneViewportRenderer;

export interface SceneViewportResizeObserver {
  observe(target: Element): void;
  disconnect(): void;
}

export type SceneViewportResizeObserverFactory = (
  callback: () => void
) => SceneViewportResizeObserver;

export class SceneViewportComponent implements Component, WindowContentRehostable {
  readonly type = sceneViewportComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly scene = new THREE.Scene();
  readonly viewportElement: HTMLDivElement;
  readonly canvasHostElement: HTMLDivElement;
  readonly overlayElement: HTMLDivElement;
  readonly renderer: SceneViewportRenderer;
  enabled = true;

  #attachment: WindowContentAttachment;
  readonly #devicePixelRatio: () => number;
  readonly #resizeSubscribers: Array<(size: SceneViewportSize) => void> = [];
  readonly #resizeObserver: SceneViewportResizeObserver | null;
  #lastSize: SceneViewportSize | null = null;

  constructor(
    actor: Actor,
    host: WindowContentHost,
    options: SceneViewportComponentOptions = {}
  ) {
    this.actor = actor;
    this.id = options.id ?? "scene-viewport";
    const documentRef = resolveDocument(options);
    this.#devicePixelRatio = options.devicePixelRatio ?? (() => (
      typeof window === "undefined" ? 1 : window.devicePixelRatio
    ));
    this.renderer = (options.createRenderer ?? createDefaultRenderer)();
    this.renderer.setClearColor(0x07090d, 1);
    this.viewportElement = documentRef.createElement("div");
    this.viewportElement.className = "scene-window__viewport";
    this.canvasHostElement = documentRef.createElement("div");
    this.canvasHostElement.className = "scene-window__canvas-host";
    this.overlayElement = documentRef.createElement("div");
    this.overlayElement.className = "scene-window__overlay";
    this.canvasHostElement.append(this.renderer.domElement);
    this.viewportElement.append(this.canvasHostElement, this.overlayElement);
    this.#attachment = host.mountContent(this.viewportElement);
    this.#resizeObserver = createResizeObserver(options.createResizeObserver, () => this.measureNow());
    this.#resizeObserver?.observe(this.viewportElement);
    this.measureNow();
  }

  get currentWindowContentHost(): WindowContentHost | null {
    return this.enabled ? this.#attachment.host : null;
  }

  rehostWindowContent(host: WindowContentHost): void {
    const previous = this.#attachment;
    this.#attachment = host.mountContent(this.viewportElement);
    previous.dispose();
    this.measureNow();
  }

  setWindowContentInteractable(interactable: boolean): void {
    this.#attachment.setInteractable(interactable);
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
    this.renderer.setPixelRatio(Math.min(this.#devicePixelRatio() || 1, 2));
    this.renderer.setSize(width, height, false);
    for (const subscriber of [...this.#resizeSubscribers]) {
      subscriber(size);
    }
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  dispose(): void {
    this.enabled = false;
    this.#resizeObserver?.disconnect();
    this.renderer.dispose();
    this.#attachment.dispose();
    this.#resizeSubscribers.length = 0;
  }
}

function createDefaultRenderer(): SceneViewportRenderer {
  return new THREE.WebGLRenderer({ antialias: true, alpha: false });
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

import type { ScreenPoint } from "actor-system/input";
import type { Actor, Component, ComponentType } from "actor-system/core";
import {
  type ActorInputEndEvent,
  type ActorInputHit,
  type ActorInputParticipant
} from "actor-system/input";
import type { UiElementComponent } from "../element";
import {
  UiButtonRenderer
} from "../button/button-renderer";
import {
  type UiButtonDescriptor
} from "../button/button-model";

export const fullscreenableViewComponentType =
  "ui-fullscreenable-view-component" as ComponentType<FullscreenableViewComponent>;

export type FullscreenableViewIntentKind = "enter" | "restore";

export interface FullscreenableViewIntent {
  readonly kind: FullscreenableViewIntentKind;
  readonly sourceActorId: string;
  readonly componentId: string;
  readonly reason: "actor-system/input";
  readonly timeStamp: number;
}

export interface FullscreenableViewIntentSink {
  requestFullscreen(intent: FullscreenableViewIntent): void;
}

export interface FullscreenableViewComponentOptions {
  readonly id?: string;
  readonly intentSink: FullscreenableViewIntentSink;
  readonly initialFullscreen?: boolean;
  readonly inputStackPriority?: number;
  readonly localRoutePriority?: number;
  readonly document?: Pick<Document, "createElement" | "createElementNS">;
}

export class FullscreenableViewComponent implements Component, ActorInputParticipant {
  readonly type = fullscreenableViewComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  readonly controlElement: HTMLButtonElement;
  readonly inputStackPriority?: number;
  readonly inputPriority?: number;
  enabled = true;

  readonly #intentSink: FullscreenableViewIntentSink;
  readonly #localRoutePriority: number;
  readonly #buttonRenderer: UiButtonRenderer;
  #fullscreen: boolean;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: FullscreenableViewComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-fullscreenable-view";
    this.element = uiElement.element;
    this.#intentSink = options.intentSink;
    this.#fullscreen = options.initialFullscreen ?? false;
    this.inputStackPriority = options.inputStackPriority;
    this.inputPriority = options.inputStackPriority;
    this.#localRoutePriority = options.localRoutePriority ?? 0;

    const documentRef = options.document ?? this.element.ownerDocument;
    this.controlElement = documentRef.createElement("button");
    this.controlElement.type = "button";
    this.controlElement.tabIndex = 0;
    this.controlElement.dataset.uiFullscreenControl = "true";
    this.#buttonRenderer = new UiButtonRenderer(
      this.controlElement,
      createFullscreenButtonDescriptor(this.#fullscreen),
      {
        extraClassName: "ui-fullscreenable-view__control",
        pressedMode: "toggle",
        document: documentRef
      }
    );
    this.element.append(this.controlElement);
    this.applyFullscreenState();
  }

  get fullscreen(): boolean {
    return this.#fullscreen;
  }

  setFullscreen(fullscreen: boolean): void {
    if (this.#disposed) return;
    this.#fullscreen = fullscreen;
    this.applyFullscreenState();
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.enabled || this.#disposed || this.element.hidden || this.controlElement.hidden) return null;
    if (!isPointInsideRect(point, this.controlElement.getBoundingClientRect())) return null;
    return {
      componentId: this.id,
      partId: "fullscreen-toggle",
      kind: "chrome",
      region: "actor-overlay",
      localRoutePriority: this.#localRoutePriority,
      hitPriority: 50,
      path: [{
        componentId: this.id,
        role: "control",
        partId: "fullscreen-toggle"
      }]
    };
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick || event.hit.partId !== "fullscreen-toggle") return;
    this.#intentSink.requestFullscreen({
      kind: this.#fullscreen ? "restore" : "enter",
      sourceActorId: this.actor.id,
      componentId: this.id,
      reason: "actor-system/input",
      timeStamp: event.timeStamp
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    this.#buttonRenderer.dispose();
    this.controlElement.remove();
  }

  private applyFullscreenState(): void {
    this.#buttonRenderer.setDescriptor(createFullscreenButtonDescriptor(this.#fullscreen));
    this.#buttonRenderer.setState({ pressed: this.#fullscreen });
  }
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function createFullscreenButtonDescriptor(fullscreen: boolean): UiButtonDescriptor {
  return {
    id: "fullscreen-toggle",
    accessibleLabel: fullscreen ? "Restore view" : "Enter fullscreen",
    title: fullscreen ? "Restore view" : "Enter fullscreen",
    icon: fullscreen
      ? {
          kind: "svg-path",
          viewBox: "0 0 24 24",
          path: "M8 4h12v9M20 4l-7 7M16 20H4v-9M4 20l7-7"
        }
      : {
          kind: "svg-path",
          viewBox: "0 0 24 24",
          path: "M4 9V4h5M4 4l7 7M20 15v5h-5M20 20l-7-7"
        }
  };
}

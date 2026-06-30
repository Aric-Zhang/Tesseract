import type { Actor, Component, ComponentType } from "actor-system/core";
import type { ScreenPoint } from "actor-system/input";
import type {
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputParticipant
} from "actor-system/input";
import type { UiElementComponent } from "../element";
import type { UiButtonDescriptor } from "./button-model";
import { UiButtonRenderer } from "./button-renderer";

export const buttonComponentType =
  "ui-button-component" as ComponentType<ButtonComponent>;

export interface ButtonActivation {
  readonly actorId: string;
  readonly componentId: string;
  readonly descriptorId: string;
  readonly reason: "actor-system/input" | "keyboard";
  readonly timeStamp: number;
}

export interface ButtonActivationSink {
  activateButton(activation: ButtonActivation): void;
}

export interface ButtonComponentOptions {
  readonly id?: string;
  readonly descriptor: UiButtonDescriptor;
  readonly activationSink: ButtonActivationSink;
  readonly localRoutePriority?: number;
  readonly document?: Pick<Document, "createElement" | "createElementNS">;
}

export class ButtonComponent implements Component, ActorInputParticipant {
  readonly type = buttonComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  readonly #activationSink: ButtonActivationSink;
  readonly #localRoutePriority: number;
  readonly #renderer: UiButtonRenderer;
  #spaceKeyDown = false;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: ButtonComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-button";
    this.element = uiElement.element;
    this.#activationSink = options.activationSink;
    this.#localRoutePriority = options.localRoutePriority ?? 0;
    this.#renderer = new UiButtonRenderer(this.element, options.descriptor, {
      document: options.document
    });
    this.element.addEventListener("keydown", this.onKeyDown);
    this.element.addEventListener("keyup", this.onKeyUp);
  }

  get descriptorId(): string {
    return this.#renderer.descriptor.id;
  }

  get disabled(): boolean {
    return this.#renderer.disabled;
  }

  setDescriptor(descriptor: UiButtonDescriptor): void {
    this.#renderer.setDescriptor(descriptor);
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.canActivate() || !isPointInsideRect(point, this.element.getBoundingClientRect())) {
      return null;
    }
    return {
      componentId: this.id,
      partId: "button",
      kind: "control",
      region: "content-control",
      localRoutePriority: this.#localRoutePriority,
      hitPriority: 50,
      path: [{
        componentId: this.id,
        role: "control",
        partId: "button"
      }]
    };
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick || event.hit.partId !== "button") return;
    this.activate("actor-system/input", event.timeStamp);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    this.element.removeEventListener("keydown", this.onKeyDown);
    this.element.removeEventListener("keyup", this.onKeyUp);
    this.#renderer.dispose();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.canActivate()) return;
    if (event.key === "Enter") {
      event.preventDefault();
      this.activate("keyboard", event.timeStamp);
      return;
    }
    if (isSpaceKey(event.key)) {
      event.preventDefault();
      this.#spaceKeyDown = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (!isSpaceKey(event.key)) return;
    event.preventDefault();
    const shouldActivate = this.#spaceKeyDown;
    this.#spaceKeyDown = false;
    if (shouldActivate) {
      this.activate("keyboard", event.timeStamp);
    }
  };

  private canActivate(): boolean {
    return this.enabled && !this.#disposed && !this.element.hidden && !this.#renderer.disabled;
  }

  private activate(reason: ButtonActivation["reason"], timeStamp: number): void {
    if (!this.canActivate()) return;
    this.#activationSink.activateButton({
      actorId: this.actor.id,
      componentId: this.id,
      descriptorId: this.#renderer.descriptor.id,
      reason,
      timeStamp
    });
  }
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function isSpaceKey(key: string): boolean {
  return key === " " || key === "Spacebar";
}

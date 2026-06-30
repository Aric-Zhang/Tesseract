import type { Actor, Component, ComponentType } from "actor-system/core";
import type { ScreenPoint } from "actor-system/input";
import type {
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputParticipant
} from "actor-system/input";
import type { UiElementComponent } from "../element";
import {
  cloneUiButtonIconDescriptor,
  type UiButtonDescriptor,
  type UiButtonIconDescriptor
} from "./button-model";
import { UiButtonRenderer } from "./button-renderer";

export const toggleButtonComponentType =
  "ui-toggle-button-component" as ComponentType<ToggleButtonComponent>;

export interface ToggleButtonActivation {
  readonly actorId: string;
  readonly componentId: string;
  readonly descriptorId: string;
  readonly pressed: boolean;
  readonly requestedPressed: boolean;
  readonly reason: "actor-system/input" | "keyboard";
  readonly timeStamp: number;
}

export interface ToggleButtonActivationSink {
  toggleButton(activation: ToggleButtonActivation): void;
}

export interface ToggleButtonIcons {
  readonly pressed: UiButtonIconDescriptor;
  readonly unpressed: UiButtonIconDescriptor;
}

export interface ToggleButtonComponentOptions {
  readonly id?: string;
  readonly descriptor: UiButtonDescriptor;
  readonly activationSink: ToggleButtonActivationSink;
  readonly initialPressed?: boolean;
  readonly icons?: ToggleButtonIcons;
  readonly localRoutePriority?: number;
  readonly document?: Pick<Document, "createElement" | "createElementNS">;
}

export class ToggleButtonComponent implements Component, ActorInputParticipant {
  readonly type = toggleButtonComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  readonly #activationSink: ToggleButtonActivationSink;
  readonly #localRoutePriority: number;
  readonly #renderer: UiButtonRenderer;
  #descriptor: UiButtonDescriptor;
  #icons?: ToggleButtonIcons;
  #pressed: boolean;
  #spaceKeyDown = false;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: ToggleButtonComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-toggle-button";
    this.element = uiElement.element;
    this.#activationSink = options.activationSink;
    this.#localRoutePriority = options.localRoutePriority ?? 0;
    this.#descriptor = options.descriptor;
    this.#icons = cloneIcons(options.icons);
    this.#pressed = options.initialPressed ?? false;
    this.#renderer = new UiButtonRenderer(this.element, this.currentDescriptor(), {
      pressedMode: "toggle",
      document: options.document
    });
    this.#renderer.setState({ pressed: this.#pressed });
    this.element.addEventListener("keydown", this.onKeyDown);
    this.element.addEventListener("keyup", this.onKeyUp);
  }

  get pressed(): boolean {
    return this.#pressed;
  }

  get disabled(): boolean {
    return this.#renderer.disabled;
  }

  setPressed(pressed: boolean): void {
    if (this.#disposed || this.#pressed === pressed) return;
    this.#pressed = pressed;
    this.#renderer.setDescriptor(this.currentDescriptor());
    this.#renderer.setState({ pressed });
  }

  setDescriptor(descriptor: UiButtonDescriptor, icons?: ToggleButtonIcons): void {
    if (this.#disposed) return;
    this.#descriptor = descriptor;
    if (icons !== undefined) {
      this.#icons = cloneIcons(icons);
    }
    this.#renderer.setDescriptor(this.currentDescriptor());
    this.#renderer.setState({ pressed: this.#pressed });
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.canActivate() || !isPointInsideRect(point, this.element.getBoundingClientRect())) {
      return null;
    }
    return {
      componentId: this.id,
      partId: "toggle-button",
      kind: "control",
      region: "content-control",
      localRoutePriority: this.#localRoutePriority,
      hitPriority: 50,
      path: [{
        componentId: this.id,
        role: "control",
        partId: "toggle-button"
      }]
    };
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick || event.hit.partId !== "toggle-button") return;
    this.emitToggle("actor-system/input", event.timeStamp);
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
      this.emitToggle("keyboard", event.timeStamp);
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
      this.emitToggle("keyboard", event.timeStamp);
    }
  };

  private canActivate(): boolean {
    return this.enabled && !this.#disposed && !this.element.hidden && !this.#renderer.disabled;
  }

  private emitToggle(reason: ToggleButtonActivation["reason"], timeStamp: number): void {
    if (!this.canActivate()) return;
    this.#activationSink.toggleButton({
      actorId: this.actor.id,
      componentId: this.id,
      descriptorId: this.#renderer.descriptor.id,
      pressed: this.#pressed,
      requestedPressed: !this.#pressed,
      reason,
      timeStamp
    });
  }

  private currentDescriptor(): UiButtonDescriptor {
    const icon = this.#icons
      ? (this.#pressed ? this.#icons.pressed : this.#icons.unpressed)
      : this.#descriptor.icon;
    return {
      ...this.#descriptor,
      icon
    };
  }
}

function cloneIcons(icons: ToggleButtonIcons | undefined): ToggleButtonIcons | undefined {
  if (!icons) return undefined;
  return {
    pressed: cloneUiButtonIconDescriptor(icons.pressed),
    unpressed: cloneUiButtonIconDescriptor(icons.unpressed)
  };
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function isSpaceKey(key: string): boolean {
  return key === " " || key === "Spacebar";
}

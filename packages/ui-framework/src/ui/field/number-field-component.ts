import type { Actor, Component, ComponentType } from "actor-system/core";
import type {
  ActorInputHit,
  ActorInputEndEvent,
  ActorInputStartEvent,
  ActorInputParticipant,
  ScreenPoint
} from "actor-system/input";
import type { UiElementComponent } from "../element";
import {
  isNumberFieldValueInRange,
  normalizeNumberFieldDescriptor,
  type NormalizedNumberFieldDescriptor,
  type NumberFieldDescriptor
} from "./number-field-model";

export const numberFieldComponentType =
  "ui-number-field-component" as ComponentType<NumberFieldComponent>;

export interface NumberFieldCommit {
  readonly actorId: string;
  readonly componentId: string;
  readonly descriptorId: string;
  readonly value: number;
  readonly reason: "enter" | "blur" | "change";
  readonly timeStamp: number;
}

export interface NumberFieldCommitSink {
  commitNumberField(commit: NumberFieldCommit): void;
}

export interface NumberFieldComponentOptions {
  readonly id?: string;
  readonly descriptor: NumberFieldDescriptor;
  readonly commitSink: NumberFieldCommitSink;
  readonly localRoutePriority?: number;
  readonly document?: Pick<Document, "createElement">;
}

export class NumberFieldComponent implements Component, ActorInputParticipant {
  readonly type = numberFieldComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  readonly inputElement: HTMLInputElement;
  enabled = true;

  readonly #commitSink: NumberFieldCommitSink;
  readonly #localRoutePriority: number;
  #descriptor: NormalizedNumberFieldDescriptor;
  #committedValue: number;
  #dirty = false;
  #focused = false;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: NumberFieldComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-number-field";
    this.element = uiElement.element;
    this.#commitSink = options.commitSink;
    this.#localRoutePriority = options.localRoutePriority ?? 0;
    this.#descriptor = normalizeNumberFieldDescriptor(options.descriptor);
    this.#committedValue = this.#descriptor.value;
    this.inputElement = createInput(options.document ?? this.element.ownerDocument);
    this.element.classList.add("ui-number-field");
    this.element.dataset.uiNumberField = "true";
    this.element.append(this.inputElement);
    this.applyDescriptor();
    this.inputElement.addEventListener("input", this.onInput);
    this.inputElement.addEventListener("pointerdown", this.onPointerDown, true);
    this.inputElement.addEventListener("pointerup", this.onPointerUp);
    this.inputElement.addEventListener("click", this.onClick);
    this.inputElement.addEventListener("change", this.onChange);
    this.inputElement.addEventListener("keydown", this.onKeyDown);
    this.inputElement.addEventListener("focus", this.onFocus);
    this.inputElement.addEventListener("blur", this.onBlur);
  }

  get descriptor(): NormalizedNumberFieldDescriptor {
    return this.#descriptor;
  }

  get value(): number {
    return this.#committedValue;
  }

  get dirty(): boolean {
    return this.#dirty;
  }

  setDescriptor(descriptor: NumberFieldDescriptor): void {
    if (this.#disposed) return;
    this.#descriptor = normalizeNumberFieldDescriptor(descriptor);
    this.#committedValue = this.#descriptor.value;
    this.applyDescriptor();
  }

  setValue(value: number): void {
    if (this.#disposed) return;
    const next = normalizeNumberFieldDescriptor({
      ...this.#descriptor,
      value
    });
    this.#descriptor = next;
    this.#committedValue = value;
    this.applyDescriptor();
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.canInteract() || !isPointInsideRect(point, this.element.getBoundingClientRect())) {
      return null;
    }
    return {
      componentId: this.id,
      partId: "number-field",
      kind: "control",
      region: "content-control",
      localRoutePriority: this.#localRoutePriority,
      hitPriority: 50,
      path: [{
        componentId: this.id,
        role: "control",
        partId: "number-field"
      }]
    };
  }

  onInputStart(event: ActorInputStartEvent): void {
    if (event.hit.componentId !== this.id || event.hit.partId !== "number-field") return;
    if (!this.canInteract()) return;
    this.requestNativeFocus();
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick || event.hit.componentId !== this.id || event.hit.partId !== "number-field") return;
    if (!this.canInteract()) return;
    this.requestNativeFocus();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    this.inputElement.removeEventListener("input", this.onInput);
    this.inputElement.removeEventListener("pointerdown", this.onPointerDown, true);
    this.inputElement.removeEventListener("pointerup", this.onPointerUp);
    this.inputElement.removeEventListener("click", this.onClick);
    this.inputElement.removeEventListener("change", this.onChange);
    this.inputElement.removeEventListener("keydown", this.onKeyDown);
    this.inputElement.removeEventListener("focus", this.onFocus);
    this.inputElement.removeEventListener("blur", this.onBlur);
    this.inputElement.remove();
    this.element.classList.remove("ui-number-field");
    delete this.element.dataset.uiNumberField;
    delete this.element.dataset.uiNumberFieldId;
    delete this.element.dataset.uiNumberFieldInvalid;
  }

  private applyDescriptor(): void {
    this.element.dataset.uiNumberFieldId = this.#descriptor.id;
    this.inputElement.setAttribute("aria-label", this.#descriptor.label);
    this.inputElement.disabled = this.#descriptor.disabled;
    this.inputElement.readOnly = this.#descriptor.readOnly;
    setOptionalNumberAttribute(this.inputElement, "min", this.#descriptor.min);
    setOptionalNumberAttribute(this.inputElement, "max", this.#descriptor.max);
    setOptionalNumberAttribute(this.inputElement, "step", this.#descriptor.step);
    if (!this.#dirty || !this.#focused) {
      this.inputElement.value = String(this.#committedValue);
      this.#dirty = false;
    }
    this.refreshInvalidState();
  }

  private readonly onInput = (): void => {
    if (!this.canEdit()) return;
    this.#dirty = true;
    this.refreshInvalidState();
  };

  private readonly onPointerDown = (): void => {
    if (!this.canInteract()) return;
    this.requestNativeFocus();
  };

  private readonly onPointerUp = (): void => {
    if (!this.canInteract()) return;
    this.requestNativeFocus();
  };

  private readonly onClick = (): void => {
    if (!this.canInteract()) return;
    this.requestNativeFocus();
  };

  private readonly onChange = (event: Event): void => {
    this.commit("change", readEventTimeStamp(event));
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      this.commit("enter", event.timeStamp);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.cancelDraft();
    }
  };

  private readonly onFocus = (): void => {
    this.#focused = true;
  };

  private readonly onBlur = (event: FocusEvent): void => {
    this.#focused = false;
    if (this.#dirty) {
      this.commit("blur", readEventTimeStamp(event));
    }
  };

  private commit(reason: NumberFieldCommit["reason"], timeStamp: number): void {
    if (!this.canEdit()) return;
    const parsed = Number(this.inputElement.value);
    if (!isNumberFieldValueInRange(parsed, this.#descriptor)) {
      this.refreshInvalidState();
      return;
    }
    if (!this.#dirty && parsed === this.#committedValue) return;
    this.#committedValue = parsed;
    this.#dirty = false;
    this.inputElement.value = String(parsed);
    this.refreshInvalidState();
    this.#commitSink.commitNumberField({
      actorId: this.actor.id,
      componentId: this.id,
      descriptorId: this.#descriptor.id,
      value: parsed,
      reason,
      timeStamp
    });
  }

  private cancelDraft(): void {
    this.#dirty = false;
    this.inputElement.value = String(this.#committedValue);
    this.refreshInvalidState();
  }

  private refreshInvalidState(): void {
    const value = Number(this.inputElement.value);
    this.element.dataset.uiNumberFieldInvalid = String(!isNumberFieldValueInRange(value, this.#descriptor));
  }

  private requestNativeFocus(): void {
    this.inputElement.focus();
    setTimeout(() => {
      if (this.canInteract()) {
        this.inputElement.focus();
      }
    }, 0);
  }

  private canInteract(): boolean {
    return this.enabled && !this.#disposed && !this.element.hidden && !this.#descriptor.disabled;
  }

  private canEdit(): boolean {
    return this.canInteract() && !this.#descriptor.readOnly;
  }
}

function createInput(documentRef: Pick<Document, "createElement">): HTMLInputElement {
  const input = documentRef.createElement("input") as HTMLInputElement;
  input.type = "number";
  input.className = "ui-number-field__input";
  return input;
}

function setOptionalNumberAttribute(
  input: HTMLInputElement,
  name: "min" | "max" | "step",
  value: number | undefined
): void {
  if (value === undefined) {
    input.removeAttribute(name);
    return;
  }
  input.setAttribute(name, String(value));
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function readEventTimeStamp(event: Event): number {
  return typeof event.timeStamp === "number" ? event.timeStamp : 0;
}

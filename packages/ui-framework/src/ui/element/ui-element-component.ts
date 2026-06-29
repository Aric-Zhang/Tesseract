import type { Actor, Component, ComponentType } from "actor-system/core";

export const uiElementComponentType =
  "ui-element-component" as ComponentType<UiElementComponent>;

export type UiElementOwnership = "owned" | "borrowed";

export interface UiElementComponentOptions {
  readonly id?: string;
  readonly element?: HTMLElement;
  readonly tagName?: keyof HTMLElementTagNameMap;
  readonly className?: string;
  readonly hidden?: boolean;
  readonly interactable?: boolean;
  readonly ownership?: UiElementOwnership;
  readonly document?: Pick<Document, "createElement">;
}

interface BorrowedElementState {
  className?: string;
  hidden?: boolean;
  uiInteractable?: {
    readonly present: boolean;
    readonly value: string | undefined;
  };
}

export class UiElementComponent implements Component {
  readonly type = uiElementComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  readonly ownership: UiElementOwnership;
  enabled = true;

  readonly #borrowedState: BorrowedElementState | null;
  #disposed = false;

  constructor(actor: Actor, options: UiElementComponentOptions = {}) {
    if (options.element && options.tagName) {
      throw new Error("UiElementComponent options.element cannot be combined with options.tagName.");
    }
    if (!options.element && options.ownership === "borrowed") {
      throw new Error("UiElementComponent cannot borrow an element when options.element is missing.");
    }

    this.actor = actor;
    this.id = options.id ?? "ui-element";
    this.ownership = options.ownership ?? (options.element ? "borrowed" : "owned");
    this.element = options.element ?? createOwnedElement(options);
    this.#borrowedState = this.ownership === "borrowed" ? {} : null;

    if (options.className !== undefined) {
      this.setClassName(options.className);
    }
    if (options.hidden !== undefined) {
      this.setHidden(options.hidden);
    }
    if (options.interactable !== undefined) {
      this.setInteractable(options.interactable);
    }
  }

  setHidden(hidden: boolean): void {
    if (this.#disposed) return;
    if (this.element.hidden === hidden) return;
    this.captureBorrowedHiddenState();
    this.element.hidden = hidden;
  }

  setInteractable(interactable: boolean): void {
    if (this.#disposed) return;
    const nextValue = String(interactable);
    if (this.element.dataset.uiInteractable === nextValue) return;
    this.captureBorrowedInteractableState();
    this.element.dataset.uiInteractable = nextValue;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    if (this.ownership === "owned") {
      this.element.remove();
      return;
    }
    this.restoreBorrowedElementState();
  }

  private restoreBorrowedElementState(): void {
    const state = this.#borrowedState;
    if (!state) return;
    if (state.className !== undefined) {
      this.element.className = state.className;
    }
    if (state.hidden !== undefined) {
      this.element.hidden = state.hidden;
    }
    if (!state.uiInteractable) return;
    if (state.uiInteractable.present) {
      this.element.dataset.uiInteractable = state.uiInteractable.value ?? "";
    } else {
      delete this.element.dataset.uiInteractable;
    }
  }

  private setClassName(className: string): void {
    if (this.#disposed) return;
    if (this.element.className === className) return;
    this.captureBorrowedClassNameState();
    this.element.className = className;
  }

  private captureBorrowedClassNameState(): void {
    if (!this.#borrowedState || this.#borrowedState.className !== undefined) return;
    this.#borrowedState.className = this.element.className;
  }

  private captureBorrowedHiddenState(): void {
    if (!this.#borrowedState || this.#borrowedState.hidden !== undefined) return;
    this.#borrowedState.hidden = this.element.hidden;
  }

  private captureBorrowedInteractableState(): void {
    if (!this.#borrowedState || this.#borrowedState.uiInteractable) return;
    this.#borrowedState.uiInteractable = {
      present: Object.hasOwn(this.element.dataset, "uiInteractable"),
      value: this.element.dataset.uiInteractable
    };
  }
}

function createOwnedElement(options: UiElementComponentOptions): HTMLElement {
  const documentRef = options.document ?? resolveGlobalDocument();
  return documentRef.createElement(options.tagName ?? "div");
}

function resolveGlobalDocument(): Pick<Document, "createElement"> {
  if (typeof document !== "undefined") return document;
  throw new Error("UiElementComponent requires options.document when creating an element.");
}

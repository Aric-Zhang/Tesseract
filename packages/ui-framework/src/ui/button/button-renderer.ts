import {
  cloneUiButtonIconDescriptor,
  normalizeUiButtonDescriptor,
  type NormalizedUiButtonDescriptor,
  type UiButtonDescriptor,
  type UiButtonIconDescriptor,
  type UiButtonRenderState
} from "./button-model";

export interface UiButtonRendererOptions {
  readonly extraClassName?: string;
  readonly document?: Pick<Document, "createElement" | "createElementNS">;
  readonly pressedMode?: "none" | "toggle";
}

interface CapturedElementState {
  readonly className: string;
  readonly role: string | null;
  readonly title: string;
  readonly ariaLabel: string | null;
  readonly ariaDisabled: string | null;
  readonly ariaPressed: string | null;
  readonly tabIndex: number;
  readonly disabled?: boolean;
  readonly dataset: {
    readonly uiButton?: string;
    readonly uiButtonVariant?: string;
    readonly uiButtonDisabled?: string;
    readonly uiButtonPressed?: string;
    readonly uiButtonActive?: string;
  };
}

export class UiButtonRenderer {
  readonly element: HTMLElement;
  #descriptor: NormalizedUiButtonDescriptor;
  #state: Required<UiButtonRenderState>;
  #labelElement: HTMLElement | null = null;
  #iconElement: HTMLElement | SVGElement | null = null;
  readonly #document: Pick<Document, "createElement" | "createElementNS">;
  readonly #extraClassName: string | undefined;
  readonly #pressedMode: "none" | "toggle";
  readonly #captured: CapturedElementState;
  #disposed = false;

  constructor(
    element: HTMLElement,
    descriptor: UiButtonDescriptor,
    options: UiButtonRendererOptions = {}
  ) {
    this.element = element;
    this.#descriptor = normalizeUiButtonDescriptor(descriptor);
    this.#state = {
      active: false,
      disabled: !this.#descriptor.enabled,
      pressed: false
    };
    this.#document = options.document ?? element.ownerDocument;
    this.#extraClassName = options.extraClassName;
    this.#pressedMode = options.pressedMode ?? "none";
    this.#captured = captureElementState(element);
    this.render();
  }

  get descriptor(): NormalizedUiButtonDescriptor {
    return {
      ...this.#descriptor,
      icon: cloneUiButtonIconDescriptor(this.#descriptor.icon)
    };
  }

  get disabled(): boolean {
    return this.#state.disabled;
  }

  get pressed(): boolean {
    return this.#state.pressed;
  }

  setDescriptor(descriptor: UiButtonDescriptor): void {
    if (this.#disposed) return;
    this.#descriptor = normalizeUiButtonDescriptor(descriptor);
    this.#state = {
      ...this.#state,
      disabled: !this.#descriptor.enabled
    };
    this.render();
  }

  setState(state: UiButtonRenderState): void {
    if (this.#disposed) return;
    this.#state = {
      active: state.active ?? this.#state.active,
      disabled: state.disabled ?? this.#state.disabled,
      pressed: state.pressed ?? this.#state.pressed
    };
    this.render();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#iconElement?.remove();
    this.#labelElement?.remove();
    this.#iconElement = null;
    this.#labelElement = null;
    restoreElementState(this.element, this.#captured);
  }

  private render(): void {
    this.element.className = mergeClassNames(
      this.#captured.className,
      "ui-button",
      this.#extraClassName
    );
    if (!isNativeButton(this.element)) {
      this.element.setAttribute("role", "button");
    }
    this.element.dataset.uiButton = "true";
    this.element.dataset.uiButtonVariant = this.#descriptor.variant;
    this.element.dataset.uiButtonDisabled = String(this.#state.disabled);
    this.element.dataset.uiButtonActive = String(this.#state.active);
    this.element.setAttribute("aria-disabled", String(this.#state.disabled));
    if (this.#pressedMode === "toggle") {
      this.element.dataset.uiButtonPressed = String(this.#state.pressed);
      this.element.setAttribute("aria-pressed", String(this.#state.pressed));
    } else {
      delete this.element.dataset.uiButtonPressed;
      this.element.removeAttribute("aria-pressed");
    }
    this.element.ariaLabel = this.#descriptor.accessibleLabel;
    this.element.title = this.#descriptor.title ?? this.#descriptor.accessibleLabel;
    if (this.element.tabIndex < 0) this.element.tabIndex = 0;
    if (isNativeButton(this.element)) {
      this.element.type = "button";
      this.element.disabled = this.#state.disabled;
    }
    this.renderIcon(this.#descriptor.icon);
    this.renderLabel(this.#descriptor.label);
  }

  private renderIcon(icon: UiButtonIconDescriptor): void {
    this.#iconElement?.remove();
    this.#iconElement = null;
    if (icon.kind === "none") return;
    if (icon.kind === "text") {
      const element = this.#document.createElement("span");
      element.className = "ui-button__icon";
      element.dataset.uiButtonIcon = "text";
      element.textContent = icon.value;
      this.#iconElement = element;
      this.element.append(element);
      return;
    }
    const svg = this.#document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ui-button__icon");
    svg.setAttribute("data-ui-button-icon", "svg-path");
    svg.setAttribute("viewBox", icon.viewBox);
    svg.setAttribute("aria-hidden", "true");
    const path = this.#document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", icon.path);
    svg.append(path);
    this.#iconElement = svg;
    this.element.append(svg);
  }

  private renderLabel(label: string | undefined): void {
    this.#labelElement?.remove();
    this.#labelElement = null;
    if (label === undefined) return;
    const element = this.#document.createElement("span");
    element.className = "ui-button__label";
    element.textContent = label;
    this.#labelElement = element;
    this.element.append(element);
  }
}

function captureElementState(element: HTMLElement): CapturedElementState {
  return {
    className: element.className,
    role: element.getAttribute("role"),
    title: element.title,
    ariaLabel: element.ariaLabel,
    ariaDisabled: element.getAttribute("aria-disabled"),
    ariaPressed: element.getAttribute("aria-pressed"),
    tabIndex: element.tabIndex,
    disabled: isNativeButton(element) ? element.disabled : undefined,
    dataset: {
      uiButton: element.dataset.uiButton,
      uiButtonVariant: element.dataset.uiButtonVariant,
      uiButtonDisabled: element.dataset.uiButtonDisabled,
      uiButtonPressed: element.dataset.uiButtonPressed,
      uiButtonActive: element.dataset.uiButtonActive
    }
  };
}

function restoreElementState(element: HTMLElement, state: CapturedElementState): void {
  element.className = state.className;
  restoreAttribute(element, "role", state.role);
  restoreAttribute(element, "aria-disabled", state.ariaDisabled);
  restoreAttribute(element, "aria-pressed", state.ariaPressed);
  element.title = state.title;
  element.ariaLabel = state.ariaLabel;
  element.tabIndex = state.tabIndex;
  restoreDataset(element, "uiButton", state.dataset.uiButton);
  restoreDataset(element, "uiButtonVariant", state.dataset.uiButtonVariant);
  restoreDataset(element, "uiButtonDisabled", state.dataset.uiButtonDisabled);
  restoreDataset(element, "uiButtonPressed", state.dataset.uiButtonPressed);
  restoreDataset(element, "uiButtonActive", state.dataset.uiButtonActive);
  if (isNativeButton(element) && state.disabled !== undefined) {
    element.disabled = state.disabled;
  }
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) {
    element.removeAttribute(name);
    return;
  }
  element.setAttribute(name, value);
}

function restoreDataset(element: HTMLElement, key: string, value: string | undefined): void {
  if (value === undefined) {
    delete element.dataset[key];
    return;
  }
  element.dataset[key] = value;
}

function mergeClassNames(...names: readonly (string | undefined)[]): string {
  return names
    .flatMap((name) => name?.split(/\s+/) ?? [])
    .filter((name, index, all) => name.length > 0 && all.indexOf(name) === index)
    .join(" ");
}

function isNativeButton(element: HTMLElement): element is HTMLButtonElement {
  return typeof HTMLButtonElement !== "undefined"
    ? element instanceof HTMLButtonElement
    : element.tagName.toLowerCase() === "button";
}

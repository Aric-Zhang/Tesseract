import type { Actor, Component, ComponentType } from "actor-system/core";
import type { UiElementComponent } from "../element";

export const scrollViewComponentType =
  "ui-scroll-view-component" as ComponentType<ScrollViewComponent>;

export type ScrollViewOrientation = "vertical" | "horizontal" | "both";

export interface ScrollViewComponentOptions {
  readonly id?: string;
  readonly orientation?: ScrollViewOrientation;
  readonly className?: string;
}

interface ScrollViewAppliedState {
  readonly className: string;
  readonly overflowX: string;
  readonly overflowY: string;
  readonly uiScrollView: string | undefined;
  readonly uiScrollOrientation: string | undefined;
  readonly uiScrollAtStart: string | undefined;
  readonly uiScrollAtEnd: string | undefined;
}

export class ScrollViewComponent implements Component {
  readonly type = scrollViewComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  readonly orientation: ScrollViewOrientation;
  enabled = true;

  readonly #className: string | undefined;
  readonly #appliedState: ScrollViewAppliedState;
  readonly #handleScroll = (): void => {
    this.refreshScrollDiagnostics();
  };
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: ScrollViewComponentOptions = {}
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-scroll-view";
    this.element = uiElement.element;
    this.orientation = normalizeOrientation(options.orientation ?? "vertical");
    this.#className = options.className;
    this.#appliedState = captureAppliedState(this.element);
    this.applyScrollState();
    this.element.addEventListener("scroll", this.#handleScroll);
  }

  refreshScrollDiagnostics(): void {
    if (this.#disposed) return;
    const horizontal = isHorizontalEnabled(this.orientation);
    const vertical = isVerticalEnabled(this.orientation);
    const atHorizontalStart = !horizontal || this.element.scrollLeft <= 0;
    const atVerticalStart = !vertical || this.element.scrollTop <= 0;
    const atHorizontalEnd = !horizontal || isHorizontalAtEnd(this.element);
    const atVerticalEnd = !vertical || isVerticalAtEnd(this.element);

    this.element.dataset.uiScrollAtStart = String(atHorizontalStart && atVerticalStart);
    this.element.dataset.uiScrollAtEnd = String(atHorizontalEnd && atVerticalEnd);
  }

  preserveEndOnMutation(mutator: () => void): void {
    if (this.#disposed) return;
    const horizontal = isHorizontalEnabled(this.orientation);
    const vertical = isVerticalEnabled(this.orientation);
    const wasHorizontalAtEnd = horizontal && isHorizontalAtEnd(this.element);
    const wasVerticalAtEnd = vertical && isVerticalAtEnd(this.element);
    const previousScrollLeft = this.element.scrollLeft;
    const previousScrollTop = this.element.scrollTop;

    mutator();

    if (horizontal) {
      this.element.scrollLeft = wasHorizontalAtEnd
        ? Math.max(0, this.element.scrollWidth - this.element.clientWidth)
        : previousScrollLeft;
    }
    if (vertical) {
      this.element.scrollTop = wasVerticalAtEnd
        ? Math.max(0, this.element.scrollHeight - this.element.clientHeight)
        : previousScrollTop;
    }
    this.refreshScrollDiagnostics();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    this.element.removeEventListener("scroll", this.#handleScroll);
    restoreAppliedState(this.element, this.#appliedState);
  }

  private applyScrollState(): void {
    this.element.className = joinClassNames(
      this.#appliedState.className,
      "ui-scroll-view",
      this.#className
    );
    this.element.dataset.uiScrollView = "true";
    this.element.dataset.uiScrollOrientation = this.orientation;
    this.element.style.overflowX = overflowXForOrientation(this.orientation);
    this.element.style.overflowY = overflowYForOrientation(this.orientation);
    this.refreshScrollDiagnostics();
  }
}

function normalizeOrientation(orientation: unknown): ScrollViewOrientation {
  if (orientation === "vertical" || orientation === "horizontal" || orientation === "both") {
    return orientation;
  }
  throw new Error(`Invalid ScrollView orientation: ${String(orientation)}`);
}

function overflowXForOrientation(orientation: ScrollViewOrientation): string {
  return orientation === "horizontal" || orientation === "both" ? "auto" : "hidden";
}

function overflowYForOrientation(orientation: ScrollViewOrientation): string {
  return orientation === "vertical" || orientation === "both" ? "auto" : "hidden";
}

function isHorizontalEnabled(orientation: ScrollViewOrientation): boolean {
  return orientation === "horizontal" || orientation === "both";
}

function isVerticalEnabled(orientation: ScrollViewOrientation): boolean {
  return orientation === "vertical" || orientation === "both";
}

function isHorizontalAtEnd(element: HTMLElement): boolean {
  return element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
}

function isVerticalAtEnd(element: HTMLElement): boolean {
  return element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
}

function captureAppliedState(element: HTMLElement): ScrollViewAppliedState {
  return {
    className: element.className,
    overflowX: element.style.overflowX,
    overflowY: element.style.overflowY,
    uiScrollView: element.dataset.uiScrollView,
    uiScrollOrientation: element.dataset.uiScrollOrientation,
    uiScrollAtStart: element.dataset.uiScrollAtStart,
    uiScrollAtEnd: element.dataset.uiScrollAtEnd
  };
}

function restoreAppliedState(element: HTMLElement, state: ScrollViewAppliedState): void {
  element.className = state.className;
  element.style.overflowX = state.overflowX;
  element.style.overflowY = state.overflowY;
  restoreOptionalDataset(element, "uiScrollView", state.uiScrollView);
  restoreOptionalDataset(element, "uiScrollOrientation", state.uiScrollOrientation);
  restoreOptionalDataset(element, "uiScrollAtStart", state.uiScrollAtStart);
  restoreOptionalDataset(element, "uiScrollAtEnd", state.uiScrollAtEnd);
}

function restoreOptionalDataset(element: HTMLElement, key: string, value: string | undefined): void {
  if (value === undefined) {
    delete element.dataset[key];
    return;
  }
  element.dataset[key] = value;
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames
    .flatMap((className) => className?.split(/\s+/) ?? [])
    .filter(Boolean)
    .join(" ");
}

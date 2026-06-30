import type {
  Actor,
  ActorSystemView,
  Component,
  ComponentRegistryView,
  ComponentType
} from "actor-system/core";
import type { FrameUpdateParticipant } from "../../ports/ui-frame-update-attachment-runtime";
import type { UiFrame } from "../../ports/ui-scheduler";
import {
  type UiElementComponent,
  uiElementComponentType
} from "../element";
import {
  buttonComponentType,
  toggleButtonComponentType
} from "../button";

export const toolbarComponentType =
  "ui-toolbar-component" as ComponentType<ToolbarComponent>;

export type ToolbarOrientation = "horizontal" | "vertical";

export interface ToolbarComponentOptions {
  readonly id?: string;
  readonly orientation?: ToolbarOrientation;
}

interface ToolbarDependencies {
  readonly actorSystem: ActorSystemView;
  readonly componentRegistry: ComponentRegistryView;
}

interface ToolbarChildContribution {
  readonly actor: Actor;
  readonly element: HTMLElement;
  readonly componentIds: readonly string[];
  readonly elementId: number;
}

export class ToolbarComponent implements Component, FrameUpdateParticipant {
  readonly type = toolbarComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  readonly #actorSystem: ActorSystemView;
  readonly #componentRegistry: ComponentRegistryView;
  readonly #elementIds = new WeakMap<HTMLElement, number>();
  #nextElementId = 1;
  #lastSignature = "";
  #currentElements = new Set<HTMLElement>();
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    dependencies: ToolbarDependencies,
    options: ToolbarComponentOptions = {}
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-toolbar";
    this.element = uiElement.element;
    this.#actorSystem = dependencies.actorSystem;
    this.#componentRegistry = dependencies.componentRegistry;
    this.element.className = mergeClassNames(this.element.className, "ui-toolbar");
    this.element.dataset.uiToolbar = "true";
    this.element.dataset.uiToolbarOrientation = options.orientation ?? "horizontal";
    this.element.setAttribute("role", "toolbar");
  }

  refreshToolbar(): void {
    if (!this.enabled || this.#disposed) return;
    const contributions = this.collectContributions();
    const signature = createSignature(contributions);
    if (signature === this.#lastSignature) return;
    this.#lastSignature = signature;
    const activeElements = new Set(contributions.map((contribution) => contribution.element));
    for (const element of this.#currentElements) {
      if (!activeElements.has(element) && element.parentElement === this.element) {
        element.remove();
      }
    }
    for (const contribution of contributions) {
      this.element.append(contribution.element);
    }
    this.#currentElements = activeElements;
    this.element.dataset.uiToolbarItemCount = String(contributions.length);
  }

  updateFrame(_frame: UiFrame): void {
    this.refreshToolbar();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    for (const element of this.#currentElements) {
      if (element.parentElement === this.element) {
        element.remove();
      }
    }
    this.#currentElements.clear();
  }

  private collectContributions(): readonly ToolbarChildContribution[] {
    return this.#actorSystem.listChildren(this.actor)
      .map((actor): ToolbarChildContribution | null => {
        if (!this.#actorSystem.isActorActive(actor)) return null;
        const uiElement = this.#componentRegistry.getComponent(actor, uiElementComponentType);
        if (!uiElement?.enabled) return null;
        const componentIds = [
          this.#componentRegistry.getComponent(actor, buttonComponentType)?.id,
          this.#componentRegistry.getComponent(actor, toggleButtonComponentType)?.id
        ].filter((id): id is string => id !== undefined);
        if (componentIds.length === 0) return null;
        return {
          actor,
          element: uiElement.element,
          componentIds,
          elementId: this.getElementId(uiElement.element)
        };
      })
      .filter((contribution): contribution is ToolbarChildContribution => contribution !== null);
  }

  private getElementId(element: HTMLElement): number {
    const existing = this.#elementIds.get(element);
    if (existing !== undefined) return existing;
    const next = this.#nextElementId++;
    this.#elementIds.set(element, next);
    return next;
  }
}

function createSignature(contributions: readonly ToolbarChildContribution[]): string {
  return contributions
    .map((contribution) => [
      contribution.actor.id,
      contribution.elementId,
      ...contribution.componentIds
    ].join(":"))
    .join("|");
}

function mergeClassNames(...names: readonly (string | undefined)[]): string {
  return names
    .flatMap((name) => name?.split(/\s+/) ?? [])
    .filter((name, index, all) => name.length > 0 && all.indexOf(name) === index)
    .join(" ");
}

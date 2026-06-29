import type { Actor, Component, ComponentType } from "actor-system/core";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "ui-framework";
import type { UiElementComponent } from "ui-framework";

export const sceneViewContentComponentType =
  "scene-view-content-component" as ComponentType<SceneViewContentComponent>;

export interface SceneViewContentComponentOptions {
  readonly id?: string;
  readonly contentId: string;
  readonly contentRegistration: WindowContentRegistrationPort;
}

export class SceneViewContentComponent implements Component, WindowRegisteredContent {
  readonly type = sceneViewContentComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  readonly #registration: WindowRegisteredContent;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: SceneViewContentComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? "scene-view-content";
    this.element = uiElement.element;
    this.element.classList.add("scene-view");
    this.element.dataset.sceneViewContent = "true";
    this.#registration = options.contentRegistration.registerContent({
      contentId: options.contentId,
      element: this.element
    });
  }

  get contentId(): string {
    return this.#registration.contentId;
  }

  get interactable(): boolean {
    return this.#registration.interactable;
  }

  setInteractable(interactable: boolean): void {
    this.#registration.setInteractable(interactable);
  }

  subscribeLayoutCommit(
    callback: (commit: WindowContentLayoutCommit) => void
  ): WindowContentLayoutCommitRegistration {
    return this.#registration.subscribeLayoutCommit(callback);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    this.#registration.dispose();
  }
}

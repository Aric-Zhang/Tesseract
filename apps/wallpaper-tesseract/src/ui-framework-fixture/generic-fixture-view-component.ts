import type { Actor, Component, ComponentDefinition, ComponentType } from "../actor-runtime";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "../window-runtime";

export const genericFixtureViewComponentType =
  "ui-fixture-generic-view" as ComponentType<GenericFixtureViewComponent>;

export interface GenericFixtureViewComponentOptions {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly document?: Pick<Document, "createElement">;
  readonly contentId: string;
  readonly contentRegistration: WindowContentRegistrationPort;
}

export class GenericFixtureViewComponent
  implements Component, WindowRegisteredContent {
  readonly type = genericFixtureViewComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly element: HTMLElement;
  readonly #registration: WindowRegisteredContent;

  constructor(actor: Actor, options: GenericFixtureViewComponentOptions) {
    this.actor = actor;
    this.id = options.id;
    const documentRef = options.document ?? document;
    this.element = documentRef.createElement("section");
    this.element.className = "ui-fixture-view";
    this.element.setAttribute("data-ui-fixture-view-actor-id", actor.id);

    const heading = documentRef.createElement("h2");
    heading.className = "ui-fixture-view__title";
    heading.textContent = options.title;
    const body = documentRef.createElement("p");
    body.className = "ui-fixture-view__body";
    body.textContent = options.body ?? `${options.title} content`;
    this.element.append(heading, body);
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
    this.#registration.dispose();
    this.element.remove();
  }
}

export const genericFixtureViewComponentDefinition:
  ComponentDefinition<GenericFixtureViewComponent, GenericFixtureViewComponentOptions> = {
  type: genericFixtureViewComponentType,
  createId(_actor, options) {
    if (!options?.id) {
      throw new Error("GenericFixtureViewComponent options.id is required.");
    }
    return options.id;
  },
  create(actor, _context, options) {
    if (!options) {
      throw new Error("GenericFixtureViewComponent options are required.");
    }
    return new GenericFixtureViewComponent(actor, options);
  }
};

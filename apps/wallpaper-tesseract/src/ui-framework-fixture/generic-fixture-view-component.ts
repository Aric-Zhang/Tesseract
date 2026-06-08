import type { Actor, Component, ComponentDefinition, ComponentType } from "../actor-runtime";
import type {
  WindowContentAttachment,
  WindowContentHost,
  WindowContentRehostable
} from "../window-runtime";

export const genericFixtureViewComponentType =
  "ui-fixture-generic-view" as ComponentType<GenericFixtureViewComponent>;

export interface GenericFixtureViewComponentOptions {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly document?: Pick<Document, "createElement">;
}

export class GenericFixtureViewComponent
  implements Component, WindowContentRehostable {
  readonly type = genericFixtureViewComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly element: HTMLElement;
  #attachment: WindowContentAttachment | null = null;

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
  }

  get currentWindowContentHost(): WindowContentHost | null {
    return this.#attachment?.host ?? null;
  }

  rehostWindowContent(host: WindowContentHost): void {
    this.#attachment = host.mountContent({
      element: this.element,
      viewActorId: this.actor.id
    });
  }

  setWindowContentInteractable(interactable: boolean): void {
    this.#attachment?.setInteractable(interactable);
  }

  dispose(): void {
    this.#attachment?.dispose();
    this.#attachment = null;
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

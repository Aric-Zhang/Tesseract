import type { Actor, Component, ComponentType } from "../../actor-runtime";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "../../window-runtime";

export const inspectorContentComponentType =
  "inspector-content-component" as ComponentType<InspectorContentComponent>;

export interface InspectorContentComponentOptions {
  readonly id?: string;
  readonly label: string;
  readonly document?: Pick<Document, "createElement">;
  readonly contentId: string;
  readonly contentRegistration: WindowContentRegistrationPort;
}

const DEFAULT_INSPECTOR_CONTENT_ID = "inspector-content";

export class InspectorContentComponent implements Component, WindowRegisteredContent {
  readonly type = inspectorContentComponentType;
  readonly id: string;
  readonly actor: Actor;
  enabled = true;

  readonly #root: HTMLDivElement;
  #registration: WindowRegisteredContent;

  constructor(
    actor: Actor,
    options: InspectorContentComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_INSPECTOR_CONTENT_ID;
    const documentRef = resolveDocument(options);
    this.#root = documentRef.createElement("div");
    this.#root.className = "inspector-window__content";
    this.#root.textContent = options.label;
    this.#registration = options.contentRegistration.registerContent({
      contentId: options.contentId,
      element: this.#root
    });
  }

  get contentId(): string {
    return this.#registration.contentId;
  }

  get element(): HTMLElement {
    return this.#root;
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
    this.enabled = false;
    this.#registration.dispose();
  }
}

function resolveDocument(options: InspectorContentComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (typeof document !== "undefined") return document;
  throw new Error("InspectorContentComponent requires a document.");
}

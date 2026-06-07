import type { Actor, Component, ComponentType } from "../../actor-runtime";
import type {
  WindowContentAttachment,
  WindowContentHost,
  WindowContentRehostable
} from "../../window-runtime";

export const inspectorContentComponentType =
  "inspector-content-component" as ComponentType<InspectorContentComponent>;

export interface InspectorContentComponentOptions {
  readonly id?: string;
  readonly label: string;
  readonly document?: Pick<Document, "createElement">;
}

export interface InspectorContentComponentServices {
  readonly host: WindowContentHost;
}

const DEFAULT_INSPECTOR_CONTENT_ID = "inspector-content";

export class InspectorContentComponent implements Component, WindowContentRehostable {
  readonly type = inspectorContentComponentType;
  readonly id: string;
  readonly actor: Actor;
  enabled = true;

  readonly #root: HTMLDivElement;
  #attachment: WindowContentAttachment;

  constructor(
    actor: Actor,
    options: InspectorContentComponentOptions,
    services: InspectorContentComponentServices
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_INSPECTOR_CONTENT_ID;
    const documentRef = resolveDocument(options);
    this.#root = documentRef.createElement("div");
    this.#root.className = "inspector-window__content";
    this.#root.textContent = options.label;
    this.#attachment = services.host.mountContent(this.#root);
  }

  get currentWindowContentHost(): WindowContentHost | null {
    return this.enabled ? this.#attachment.host : null;
  }

  rehostWindowContent(host: WindowContentHost): void {
    const previous = this.#attachment;
    this.#attachment = host.mountContent(this.#root);
    previous.dispose();
  }

  setWindowContentInteractable(interactable: boolean): void {
    this.#attachment.setInteractable(interactable);
  }

  dispose(): void {
    this.enabled = false;
    this.#attachment.dispose();
  }
}

function resolveDocument(options: InspectorContentComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (typeof document !== "undefined") return document;
  throw new Error("InspectorContentComponent requires a document.");
}

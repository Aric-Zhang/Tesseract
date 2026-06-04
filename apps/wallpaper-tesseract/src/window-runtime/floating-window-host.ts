import type { FloatingWindowState } from "./floating-window-state";

export interface WindowContentAttachmentRequest {
  readonly element: HTMLElement;
  readonly interactable?: boolean;
}

export interface WindowContentHost {
  readonly id: string;

  mountContent(request: HTMLElement | WindowContentAttachmentRequest): WindowContentAttachment;
  isContentInteractable(element: HTMLElement): boolean;
}

export interface FloatingWindowHost extends WindowContentHost {
  readonly state: Readonly<FloatingWindowState>;

  setTitle(title: string): void;
  getBounds(): DOMRectReadOnly;
  requestVisible(visible: boolean, timeStamp?: number): void;
}

export interface WindowContentAttachment {
  readonly element: HTMLElement;
  readonly host: WindowContentHost;
  readonly interactable: boolean;
  setInteractable(interactable: boolean): void;
  dispose(): void;
}

export type FloatingWindowContentAttachment = WindowContentAttachment;

type AttachWindowContent = (element: HTMLElement) => void;
type DisposeWindowContentAttachment = (attachment: WindowContentAttachment) => void;

const attachmentsByElement = new WeakMap<HTMLElement, ManagedWindowContentAttachment>();

export function createWindowContentAttachment(
  host: WindowContentHost,
  requestOrElement: HTMLElement | WindowContentAttachmentRequest,
  attach: AttachWindowContent,
  onDispose: DisposeWindowContentAttachment
): WindowContentAttachment {
  const request = normalizeWindowContentAttachmentRequest(requestOrElement);
  const previous = attachmentsByElement.get(request.element);
  previous?.dispose();
  const attachment = new ManagedWindowContentAttachment(host, request, onDispose);
  attachmentsByElement.set(request.element, attachment);
  attach(request.element);
  return attachment;
}

export function getWindowContentAttachment(element: HTMLElement): WindowContentAttachment | null {
  return attachmentsByElement.get(element) ?? null;
}

function normalizeWindowContentAttachmentRequest(
  requestOrElement: HTMLElement | WindowContentAttachmentRequest
): WindowContentAttachmentRequest {
  if (isWindowContentAttachmentRequest(requestOrElement)) {
    return requestOrElement;
  }
  return { element: requestOrElement };
}

function isWindowContentAttachmentRequest(
  requestOrElement: HTMLElement | WindowContentAttachmentRequest
): requestOrElement is WindowContentAttachmentRequest {
  return (
    typeof requestOrElement === "object" &&
    requestOrElement !== null &&
    "element" in requestOrElement
  );
}

class ManagedWindowContentAttachment implements WindowContentAttachment {
  readonly element: HTMLElement;
  readonly host: WindowContentHost;
  readonly #onDispose: DisposeWindowContentAttachment;
  #interactable: boolean;
  #disposed = false;

  constructor(
    host: WindowContentHost,
    request: WindowContentAttachmentRequest,
    onDispose: DisposeWindowContentAttachment
  ) {
    this.host = host;
    this.element = request.element;
    this.#interactable = request.interactable ?? true;
    this.#onDispose = onDispose;
  }

  get interactable(): boolean {
    return !this.#disposed && this.#interactable;
  }

  setInteractable(interactable: boolean): void {
    this.#interactable = interactable;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (attachmentsByElement.get(this.element) === this) {
      attachmentsByElement.delete(this.element);
    }
    this.#onDispose(this);
  }
}

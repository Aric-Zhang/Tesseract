export interface WindowContentAttachmentRequest {
  readonly element: HTMLElement;
  readonly interactable?: boolean;
  readonly viewActorId?: string;
}

export interface WindowContentRegistrationRequest {
  readonly contentId: string;
  readonly element: HTMLElement;
  readonly interactable?: boolean;
}

export type WindowContentRegistryRegistrationRequest = WindowContentRegistrationRequest;

export interface WindowContentLayoutCommitRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WindowContentLayoutCommitSplit {
  readonly splitId: string;
  readonly direction: "horizontal" | "vertical";
  readonly rect: WindowContentLayoutCommitRect;
}

export interface WindowContentLayoutCommit {
  readonly surfaceId: string;
  readonly contentId: string | null;
  readonly tabsetId: string | null;
  readonly active: boolean;
  readonly interactable: boolean;
  readonly contentRect: WindowContentLayoutCommitRect;
  readonly surfaceRevision: number;
  readonly splits: readonly WindowContentLayoutCommitSplit[];
}

export interface WindowContentLayoutCommitRegistration {
  dispose(): void;
}

export interface WindowContentHost {
  readonly id: string;
  readonly viewActorId?: string;
  readonly inputStackPriority?: number;

  mountContent(request: HTMLElement | WindowContentAttachmentRequest): WindowContentAttachment;
  isContentInteractable(element: HTMLElement): boolean;
}

export interface WindowContentAttachment {
  readonly element: HTMLElement;
  readonly host: WindowContentHost;
  readonly interactable: boolean;
  setInteractable(interactable: boolean): void;
  subscribeLayoutCommit(
    callback: (commit: WindowContentLayoutCommit) => void
  ): WindowContentLayoutCommitRegistration;
  dispose(): void;
}

export interface WindowRegisteredContent {
  readonly contentId: string;
  readonly element: HTMLElement;
  readonly interactable: boolean;
  readonly inputStackPriority?: number;
  setInteractable(interactable: boolean): void;
  subscribeLayoutCommit(
    callback: (commit: WindowContentLayoutCommit) => void
  ): WindowContentLayoutCommitRegistration;
  dispose(): void;
}

export type WindowContentRegistration = WindowRegisteredContent;

export interface WindowContentRegistrationPort {
  registerContent(request: WindowContentRegistrationRequest): WindowRegisteredContent;
  getRegisteredContent(contentId: string): WindowRegisteredContent | null;
}

type AttachWindowContent = (element: HTMLElement) => void;
type DisposeWindowContentAttachment = (attachment: WindowContentAttachment) => void;

const attachmentsByElement = new WeakMap<HTMLElement, ManagedWindowContentAttachment>();
const registeredContentByElement = new WeakMap<HTMLElement, ManagedWindowContentRegistration>();
const contentAttachmentElementKey = Symbol.for("ui-framework.windowContentAttachment");
const registeredContentElementKey = Symbol.for("ui-framework.windowRegisteredContent");

export class WindowContentRegistry implements WindowContentRegistrationPort {
  readonly #registrationsByContentId = new Map<string, ManagedWindowContentRegistration>();

  registerContent(request: WindowContentRegistrationRequest): WindowRegisteredContent {
    this.#registrationsByContentId.get(request.contentId)?.dispose();
    const registration = new ManagedWindowContentRegistration(request, () => {
      if (this.#registrationsByContentId.get(request.contentId) === registration) {
        this.#registrationsByContentId.delete(request.contentId);
      }
      if (registeredContentByElement.get(request.element) === registration) {
        registeredContentByElement.delete(request.element);
      }
      if (readRegisteredContentFromElement(request.element) === registration) {
        delete (request.element as unknown as Record<PropertyKey, unknown>)[registeredContentElementKey];
      }
    });
    this.#registrationsByContentId.set(request.contentId, registration);
    registeredContentByElement.set(request.element, registration);
    Object.defineProperty(request.element, registeredContentElementKey, {
      configurable: true,
      value: registration
    });
    return registration;
  }

  register(request: WindowContentRegistrationRequest): WindowRegisteredContent {
    return this.registerContent(request);
  }

  getRegisteredContent(contentId: string): WindowRegisteredContent | null {
    return this.#registrationsByContentId.get(contentId) ?? null;
  }

  get(contentId: string): WindowRegisteredContent | null {
    return this.getRegisteredContent(contentId);
  }

  commitLayout(contentId: string, commit: WindowContentLayoutCommit): void {
    this.#registrationsByContentId.get(contentId)?.commitLayout(commit);
  }
}

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
  Object.defineProperty(request.element, contentAttachmentElementKey, {
    configurable: true,
    value: attachment
  });
  attach(request.element);
  return attachment;
}

export function getWindowContentAttachment(element: HTMLElement): WindowContentAttachment | null {
  return readAttachment(element) ?? null;
}

export function commitWindowContentLayout(
  attachment: WindowContentAttachment,
  commit: WindowContentLayoutCommit
): void {
  if (attachment instanceof ManagedWindowContentAttachment) {
    attachment.commitLayout(commit);
  }
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
  readonly #layoutCommitSubscribers: Array<(commit: WindowContentLayoutCommit) => void> = [];
  #lastLayoutCommit: WindowContentLayoutCommit | null = null;
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

  get inputStackPriority(): number | undefined {
    return readAttachment(this.element)?.host.inputStackPriority;
  }

  setInteractable(interactable: boolean): void {
    this.#interactable = interactable;
    readRegisteredContent(this.element)?.syncInteractableFromAttachment(interactable);
  }

  subscribeLayoutCommit(
    callback: (commit: WindowContentLayoutCommit) => void
  ): WindowContentLayoutCommitRegistration {
    if (!this.#layoutCommitSubscribers.includes(callback)) {
      this.#layoutCommitSubscribers.push(callback);
    }
    if (this.#lastLayoutCommit) {
      callback(this.#lastLayoutCommit);
    }
    return {
      dispose: () => {
        const index = this.#layoutCommitSubscribers.indexOf(callback);
        if (index >= 0) {
          this.#layoutCommitSubscribers.splice(index, 1);
        }
      }
    };
  }

  commitLayout(commit: WindowContentLayoutCommit): void {
    if (this.#disposed) return;
    this.#lastLayoutCommit = commit;
    readRegisteredContent(this.element)?.commitLayout(commit);
    for (const subscriber of [...this.#layoutCommitSubscribers]) {
      subscriber(commit);
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#lastLayoutCommit = null;
    this.#layoutCommitSubscribers.length = 0;
    if (attachmentsByElement.get(this.element) === this) {
      attachmentsByElement.delete(this.element);
    }
    if (readAttachmentFromElement(this.element) === this) {
      delete (this.element as unknown as Record<PropertyKey, unknown>)[contentAttachmentElementKey];
    }
    this.#onDispose(this);
  }
}

function readRegisteredContent(element: HTMLElement): ManagedWindowContentRegistration | undefined {
  return registeredContentByElement.get(element) ?? readRegisteredContentFromElement(element);
}

function readRegisteredContentFromElement(element: HTMLElement): ManagedWindowContentRegistration | undefined {
  return (element as unknown as Record<PropertyKey, ManagedWindowContentRegistration | undefined>)[
    registeredContentElementKey
  ];
}

function readAttachment(element: HTMLElement): ManagedWindowContentAttachment | undefined {
  return attachmentsByElement.get(element) ?? readAttachmentFromElement(element);
}

function readAttachmentFromElement(element: HTMLElement): ManagedWindowContentAttachment | undefined {
  return (element as unknown as Record<PropertyKey, ManagedWindowContentAttachment | undefined>)[
    contentAttachmentElementKey
  ];
}

class ManagedWindowContentRegistration implements WindowContentRegistration {
  readonly contentId: string;
  readonly element: HTMLElement;
  readonly #onDispose: () => void;
  readonly #layoutCommitSubscribers: Array<(commit: WindowContentLayoutCommit) => void> = [];
  #lastLayoutCommit: WindowContentLayoutCommit | null = null;
  #interactable: boolean;
  #disposed = false;

  constructor(
    request: WindowContentRegistryRegistrationRequest,
    onDispose: () => void
  ) {
    this.contentId = request.contentId;
    this.element = request.element;
    this.#interactable = request.interactable ?? true;
    this.#onDispose = onDispose;
  }

  get interactable(): boolean {
    return !this.#disposed && this.#interactable;
  }

  setInteractable(interactable: boolean): void {
    this.#interactable = interactable;
    readAttachment(this.element)?.setInteractable(interactable);
  }

  syncInteractableFromAttachment(interactable: boolean): void {
    this.#interactable = interactable;
  }

  subscribeLayoutCommit(
    callback: (commit: WindowContentLayoutCommit) => void
  ): WindowContentLayoutCommitRegistration {
    if (!this.#layoutCommitSubscribers.includes(callback)) {
      this.#layoutCommitSubscribers.push(callback);
    }
    if (this.#lastLayoutCommit) {
      callback(this.#lastLayoutCommit);
    }
    return {
      dispose: () => {
        const index = this.#layoutCommitSubscribers.indexOf(callback);
        if (index >= 0) {
          this.#layoutCommitSubscribers.splice(index, 1);
        }
      }
    };
  }

  commitLayout(commit: WindowContentLayoutCommit): void {
    if (this.#disposed) return;
    this.#lastLayoutCommit = commit;
    for (const subscriber of [...this.#layoutCommitSubscribers]) {
      subscriber(commit);
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#lastLayoutCommit = null;
    this.#layoutCommitSubscribers.length = 0;
    this.#onDispose();
  }
}

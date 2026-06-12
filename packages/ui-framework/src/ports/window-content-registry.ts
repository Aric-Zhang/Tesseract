export interface WindowContentRegistrationRequest {
  readonly contentId: string;
  readonly element: HTMLElement;
  readonly interactable?: boolean;
}

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

export interface WindowContentRegistrationPort {
  registerContent(request: WindowContentRegistrationRequest): WindowRegisteredContent;
  getRegisteredContent(contentId: string): WindowRegisteredContent | null;
}

const registeredContentByElement = new WeakMap<HTMLElement, ManagedWindowContentRegistration>();
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

  getRegisteredContent(contentId: string): WindowRegisteredContent | null {
    return this.#registrationsByContentId.get(contentId) ?? null;
  }

  commitLayout(contentId: string, commit: WindowContentLayoutCommit): void {
    this.#registrationsByContentId.get(contentId)?.commitLayout(commit);
  }
}

export function commitWindowRegisteredContentLayout(
  content: WindowRegisteredContent,
  commit: WindowContentLayoutCommit
): void {
  if (content instanceof ManagedWindowContentRegistration) {
    content.commitLayout(commit);
  }
}

function readRegisteredContentFromElement(element: HTMLElement): ManagedWindowContentRegistration | undefined {
  return (element as unknown as Record<PropertyKey, ManagedWindowContentRegistration | undefined>)[
    registeredContentElementKey
  ];
}

class ManagedWindowContentRegistration implements WindowRegisteredContent {
  readonly contentId: string;
  readonly element: HTMLElement;
  readonly #onDispose: () => void;
  readonly #layoutCommitSubscribers: Array<(commit: WindowContentLayoutCommit) => void> = [];
  #lastLayoutCommit: WindowContentLayoutCommit | null = null;
  #interactable: boolean;
  #disposed = false;

  constructor(
    request: WindowContentRegistrationRequest,
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
    this.element.remove();
    this.#onDispose();
  }
}

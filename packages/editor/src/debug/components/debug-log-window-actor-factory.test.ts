import { describe, expect, it } from "vitest";
import { DiagnosticHub, type DiagnosticEvent, type DiagnosticEventListener, type DiagnosticSource } from "foundation/diagnostics";
import {
  ActorSystem,
  ComponentRegistry,
  createActorCreationScope
} from "actor-system/core";
import { installActorUiComponentDefinitions } from "ui-framework/actor-ui";
import { installControlComponentDefinitions } from "ui-framework/controls";
import { installMenuComponentDefinitions } from "ui-framework/menu";
import { installThemeComponentDefinitions } from "ui-framework/theme";
import { type WindowContentLayoutCommit, type WindowContentLayoutCommitRegistration, type WindowContentRegistrationPort, type WindowRegisteredContent } from "ui-framework/window";
import { installDebugLogComponentDefinitions } from "../install-component-definitions";
import { createDebugLogViewActor } from "./debug-log-window-actor-factory";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly style: Record<string, string> & { setProperty: (name: string, value: string) => void };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly #listeners = new Map<string, Set<() => void>>();
  parentElement: FakeElement | null = null;
  className = "";
  textContent = "";
  hidden = false;
  scrollLeft = 0;
  scrollTop = 0;
  clientWidth = 100;
  clientHeight = 40;
  scrollWidth = 100;
  scrollHeight = 40;
  appendCallCount = 0;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
    this.style = {
      setProperty: (name: string, value: string) => {
        this.style[name] = value;
      }
    } as Record<string, string> & { setProperty: (name: string, value: string) => void };
  }

  append(...children: FakeElement[]): void {
    this.appendCallCount += 1;
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.#listeners.get(type)?.delete(listener);
  }
}

class FakeWindowContentRegistry implements WindowContentRegistrationPort {
  registered: { readonly contentId: string; readonly element: HTMLElement } | null = null;

  registerContent(request: { readonly contentId: string; readonly element: HTMLElement }): WindowRegisteredContent {
    this.registered = request;
    return {
      contentId: request.contentId,
      element: request.element,
      interactable: true,
      setInteractable() {},
      subscribeLayoutCommit(_callback: (commit: WindowContentLayoutCommit) => void): WindowContentLayoutCommitRegistration {
        return { dispose() {} };
      },
      dispose: () => {
        if (this.registered?.contentId === request.contentId) {
          this.registered = null;
        }
      }
    };
  }
}

class CountingDiagnosticSource implements DiagnosticSource {
  activeSubscriptions = 0;

  constructor(readonly hub: DiagnosticHub) {}

  snapshot(): readonly DiagnosticEvent[] {
    return this.hub.snapshot();
  }

  subscribe(listener: DiagnosticEventListener): { dispose(): void } {
    this.activeSubscriptions += 1;
    const registration = this.hub.subscribe(listener);
    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this.activeSubscriptions -= 1;
        registration.dispose();
      }
    };
  }
}

describe("createDebugLogViewActor", () => {
  it("registers the same actor UI element as content and renders logs through a virtual row pool", () => {
    const fixture = createFixture();
    fixture.diagnostics.emit({ level: "log", message: "first", source: "test", tags: ["debug"] });
    const handle = fixture.createDebugView();

    expect(fixture.contentRegistration.registered?.element).toBe(handle.component.element);
    expect(virtualRows(handle.component.element).map((child) => child.dataset.uiVirtualListKey))
      .toEqual(["diagnostic:1"]);
    expect(virtualRows(handle.component.element).map((child) => child.textContent))
      .toEqual(["    0 LOG test [debug] first"]);

    fixture.diagnostics.emit({ level: "warn", message: "second" });
    handle.component.updateFrame({} as never);

    expect(virtualRows(handle.component.element).map((child) => child.textContent)).toEqual([
      "    0 LOG test [debug] first",
      "    0 WARN second"
    ]);
    expect(fixture.actorSystem.listChildren(handle.actor)).toEqual([]);
  });

  it("does not rebind virtual rows on idle update frames", () => {
    const fixture = createFixture();
    const handle = fixture.createDebugView();
    fixture.diagnostics.emit({ level: "log", message: "entry" });
    handle.component.updateFrame({} as never);
    const spacer = handle.component.element.children[0]!;
    const appendCallCount = spacer.appendCallCount;

    handle.component.updateFrame({} as never);

    expect(spacer.appendCallCount).toBe(appendCallCount);
  });

  it("removes virtual rows and content registration on dispose", () => {
    const fixture = createFixture();
    const handle = fixture.createDebugView();
    fixture.diagnostics.emit({ level: "log", message: "entry" });
    handle.component.updateFrame({} as never);

    handle.dispose();

    expect(fixture.contentRegistration.registered).toBeNull();
  });

  it("unsubscribes diagnostics when the view is disposed", () => {
    const fixture = createFixture();
    const handle = fixture.createDebugView();
    expect(fixture.diagnosticSource.activeSubscriptions).toBe(1);

    handle.dispose();

    expect(fixture.diagnosticSource.activeSubscriptions).toBe(0);
  });
});

function virtualRows(element: HTMLElement): FakeElement[] {
  const spacer = (element as unknown as FakeElement).children[0];
  return spacer?.children ?? [];
}

function createFixture(): {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly document: FakeDocument;
  readonly diagnostics: DiagnosticHub;
  readonly diagnosticSource: CountingDiagnosticSource;
  readonly contentRegistration: FakeWindowContentRegistry;
  readonly createDebugView: () => ReturnType<typeof createDebugLogViewActor>;
} {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installActorUiComponentDefinitions(componentRegistry);
  installControlComponentDefinitions(componentRegistry);
  installMenuComponentDefinitions(componentRegistry);
  installThemeComponentDefinitions(componentRegistry);
  installDebugLogComponentDefinitions(componentRegistry);
  const context = createActorCreationScope({ actorSystem, componentRegistry });
  const parent = actorSystem.createActor({ id: "frame" });
  const document = new FakeDocument();
  const diagnostics = new DiagnosticHub({ now: () => 0 });
  const diagnosticSource = new CountingDiagnosticSource(diagnostics);
  const contentRegistration = new FakeWindowContentRegistry();
  return {
    actorSystem,
    componentRegistry,
    document,
    diagnostics,
    diagnosticSource,
    contentRegistration,
    createDebugView() {
      return createDebugLogViewActor(context, {
        actorId: "debug:view",
        parentActor: parent,
        diagnostics: diagnosticSource,
        document: document as unknown as Document,
        contentId: "content:debug",
        contentRegistration
      });
    }
  };
}

import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-system/core";
import type { UiElementComponent } from "../element";
import {
  NumberFieldComponent,
  type NumberFieldCommit
} from "./number-field-component";

describe("NumberFieldComponent", () => {
  it("renders descriptor state and exposes actor-input content-control hits", () => {
    const fixture = createFixture();

    expect(fixture.component.inputElement.type).toBe("number");
    expect(fixture.component.inputElement.value).toBe("45");
    expect(fixture.component.inputElement.getAttribute("min")).toBe("1");
    expect(fixture.component.inputElement.getAttribute("max")).toBe("120");
    expect(fixture.component.inputElement.getAttribute("step")).toBe("0.5");
    expect(fixture.element.dataset.uiNumberField).toBe("true");
    expect(fixture.element.dataset.uiNumberFieldId).toBe("fov");

    const hit = fixture.component.hitTestInput({ x: 10, y: 10 });

    expect(hit?.region).toBe("content-control");
    expect(hit?.partId).toBe("number-field");
  });

  it("commits valid values on Enter and ignores unchanged commits", () => {
    const fixture = createFixture();

    fixture.input.value = "60";
    fixture.input.dispatch("input");
    fixture.input.dispatch("keydown", { key: "Enter", timeStamp: 12, preventDefault() {} });
    fixture.input.dispatch("keydown", { key: "Enter", timeStamp: 13, preventDefault() {} });

    expect(fixture.commits).toEqual([{
      actorId: "field-actor",
      componentId: "number-field",
      descriptorId: "fov",
      value: 60,
      reason: "enter",
      timeStamp: 12
    }]);
  });

  it("does not commit invalid values and marks invalid state", () => {
    const fixture = createFixture();

    fixture.input.value = "900";
    fixture.input.dispatch("input");
    fixture.input.dispatch("change", { timeStamp: 8 });

    expect(fixture.commits).toEqual([]);
    expect(fixture.element.dataset.uiNumberFieldInvalid).toBe("true");
    expect(fixture.component.value).toBe(45);
  });

  it("commits valid dirty values on blur", () => {
    const fixture = createFixture();

    fixture.input.dispatch("focus");
    fixture.input.value = "50";
    fixture.input.dispatch("input");
    fixture.input.dispatch("blur", { timeStamp: 20 });

    expect(fixture.commits.map((commit) => [commit.value, commit.reason])).toEqual([[50, "blur"]]);
    expect(fixture.component.value).toBe(50);
  });

  it("cancels dirty drafts on Escape", () => {
    const fixture = createFixture();

    fixture.input.value = "70";
    fixture.input.dispatch("input");
    fixture.input.dispatch("keydown", { key: "Escape", timeStamp: 4, preventDefault() {} });

    expect(fixture.input.value).toBe("45");
    expect(fixture.component.dirty).toBe(false);
    expect(fixture.commits).toEqual([]);
  });

  it("does not stomp focused dirty drafts with external value updates", () => {
    const fixture = createFixture();

    fixture.input.dispatch("focus");
    fixture.input.value = "77";
    fixture.input.dispatch("input");
    fixture.component.setValue(80);

    expect(fixture.input.value).toBe("77");
    expect(fixture.component.value).toBe(80);

    fixture.input.dispatch("keydown", { key: "Escape", timeStamp: 4, preventDefault() {} });

    expect(fixture.input.value).toBe("80");
  });

  it("does not emit commits while disabled", () => {
    const fixture = createFixture({
      disabled: true
    });

    fixture.input.value = "60";
    fixture.input.dispatch("input");
    fixture.input.dispatch("keydown", { key: "Enter", timeStamp: 1, preventDefault() {} });

    expect(fixture.commits).toEqual([]);
    expect(fixture.component.hitTestInput({ x: 10, y: 10 })).toBeNull();
  });

  it("focuses the native input on actor-input start and click end", () => {
    const fixture = createFixture();
    const hit = fixture.component.hitTestInput({ x: 10, y: 10 })!;

    fixture.component.onInputStart({
      hit,
      timeStamp: 3
    } as Parameters<typeof fixture.component.onInputStart>[0]);
    fixture.component.onInputEnd({
      hit,
      wasClick: true,
      timeStamp: 4
    } as Parameters<typeof fixture.component.onInputEnd>[0]);

    expect(fixture.input.focusCount).toBe(2);
  });

  it("focuses the native input on pointer down before global input handlers can steal focus", () => {
    const fixture = createFixture();

    fixture.input.dispatch("pointerdown");
    fixture.input.dispatch("pointerup");
    fixture.input.dispatch("click");

    expect(fixture.input.focusCount).toBe(3);
  });

  it("removes listeners and owned DOM state on dispose", () => {
    const fixture = createFixture();

    fixture.component.dispose();
    fixture.input.value = "60";
    fixture.input.dispatch("input");
    fixture.input.dispatch("keydown", { key: "Enter", timeStamp: 1, preventDefault() {} });

    expect(fixture.commits).toEqual([]);
    expect(fixture.input.parentElement).toBeNull();
    expect(fixture.element.dataset.uiNumberField).toBeUndefined();
  });
});

function createFixture(overrides: Partial<Parameters<typeof createComponent>[0]> = {}) {
  const document = new FakeDocument();
  const element = document.createElement("div");
  const commits: NumberFieldCommit[] = [];
  const component = createComponent({
    document,
    element,
    commits,
    ...overrides
  });
  return {
    document,
    element,
    input: component.inputElement as unknown as FakeInputElement,
    component,
    commits
  };
}

function createComponent(options: {
  readonly document: FakeDocument;
  readonly element: FakeElement;
  readonly commits: NumberFieldCommit[];
  readonly disabled?: boolean;
}): NumberFieldComponent {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "field-actor" });
  return new NumberFieldComponent(
    actor,
    { element: options.element as unknown as HTMLElement } as UiElementComponent,
    {
      id: "number-field",
      descriptor: {
        id: "fov",
        value: 45,
        min: 1,
        max: 120,
        step: 0.5,
        disabled: options.disabled
      },
      commitSink: {
        commitNumberField(commit) {
          options.commits.push(commit);
        }
      },
      document: options.document as unknown as Document
    }
  );
}

type FakeListener = (event: FakeEvent) => void;

interface FakeEvent {
  readonly key?: string;
  readonly timeStamp?: number;
  preventDefault?(): void;
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return tagName === "input"
      ? new FakeInputElement(this)
      : new FakeElement(this, tagName);
  }
}

class FakeClassList {
  readonly #classes = new Set<string>();

  add(className: string): void {
    this.#classes.add(className);
  }

  remove(className: string): void {
    this.#classes.delete(className);
  }

  contains(className: string): boolean {
    return this.#classes.has(className);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly children: FakeElement[] = [];
  readonly classList = new FakeClassList();
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<FakeListener>>();
  className = "";
  hidden = false;
  parentElement: FakeElement | null = null;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(child: FakeElement): void {
    child.parentElement = this;
    this.children.push(child);
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

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  addEventListener(type: string, listener: FakeListener): void {
    const listeners = this.listeners.get(type) ?? new Set<FakeListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: FakeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: FakeEvent = {}): void {
    for (const listener of [...this.listeners.get(type) ?? []]) {
      listener(event);
    }
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return {
      left: 0,
      top: 0,
      right: 100,
      bottom: 24,
      width: 100,
      height: 24,
      x: 0,
      y: 0,
      toJSON() {}
    };
  }
}

class FakeInputElement extends FakeElement {
  type = "";
  value = "";
  disabled = false;
  readOnly = false;
  focusCount = 0;

  constructor(ownerDocument: FakeDocument) {
    super(ownerDocument, "input");
  }

  focus(): void {
    this.focusCount += 1;
  }
}

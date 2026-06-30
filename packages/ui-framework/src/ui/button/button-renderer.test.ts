import { describe, expect, it } from "vitest";
import { normalizeUiButtonDescriptor } from "./button-model";
import { UiButtonRenderer } from "./button-renderer";

describe("UiButtonRenderer", () => {
  it("normalizes descriptors and rejects buttons without accessible names", () => {
    expect(() => normalizeUiButtonDescriptor({ id: "empty" })).toThrow(/requires label, title, or accessibleLabel/);

    expect(normalizeUiButtonDescriptor({
      id: "save",
      label: "Save"
    })).toMatchObject({
      id: "save",
      accessibleLabel: "Save",
      enabled: true,
      variant: "plain"
    });
  });

  it("renders text and svg icons deterministically and restores state", () => {
    const document = new FakeDocument();
    const element = document.createElement("button");
    element.className = "existing";
    element.setAttribute("aria-disabled", "mixed");

    const renderer = new UiButtonRenderer(element as unknown as HTMLElement, {
      id: "lock",
      accessibleLabel: "Lock View",
      icon: { kind: "text", value: "L" },
      variant: "toolbar"
    }, {
      document: document as unknown as Document
    });

    expect(element.className).toBe("existing ui-button");
    expect(element.dataset.uiButton).toBe("true");
    expect(element.dataset.uiButtonVariant).toBe("toolbar");
    expect(element.getAttribute("aria-pressed")).toBeNull();
    expect(element.dataset.uiButtonPressed).toBeUndefined();
    expect(element.children.map((child) => child.textContent)).toEqual(["L"]);

    renderer.setDescriptor({
      id: "unlock",
      accessibleLabel: "Unlock View",
      icon: {
        kind: "svg-path",
        path: "M1 1h10",
        viewBox: "0 0 12 12"
      }
    });
    renderer.setState({ disabled: true, pressed: true });

    expect(element.dataset.uiButtonDisabled).toBe("true");
    expect(element.dataset.uiButtonPressed).toBeUndefined();
    expect(element.children).toHaveLength(1);
    expect(element.children[0].tagName).toBe("svg");
    expect(element.children[0].children[0].attributes.get("d")).toBe("M1 1h10");

    renderer.dispose();

    expect(element.className).toBe("existing");
    expect(element.getAttribute("aria-disabled")).toBe("mixed");
    expect(element.dataset.uiButton).toBeUndefined();
    expect(element.children).toEqual([]);
  });

  it("applies aria-pressed only in toggle pressed mode", () => {
    const document = new FakeDocument();
    const element = document.createElement("button");

    const renderer = new UiButtonRenderer(element as unknown as HTMLElement, {
      id: "toggle",
      accessibleLabel: "Toggle"
    }, {
      document: document as unknown as Document,
      pressedMode: "toggle"
    });

    renderer.setState({ pressed: true });

    expect(element.getAttribute("aria-pressed")).toBe("true");
    expect(element.dataset.uiButtonPressed).toBe("true");
  });
});

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }

  createElementNS(_namespace: string, tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  className = "";
  textContent = "";
  title = "";
  ariaLabel: string | null = null;
  tabIndex = -1;
  disabled = false;
  type = "";

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
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

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

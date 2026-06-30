import { describe, expect, it } from "vitest";
import { Debug } from "foundation/diagnostics";
import { Selection } from "editor";

import { createWallpaperApp } from "./create-wallpaper-app";

class FakeElement {
  className = "";
  hidden = false;
  parentElement: FakeElement | null = null;
  readonly children: FakeElement[] = [];
  readonly ownerDocument: FakeDocument;
  readonly style = {
    setProperty() {}
  };

  constructor(ownerDocument: FakeDocument) {
    this.ownerDocument = ownerDocument;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeElement[]): void {
    for (const child of [...this.children]) {
      child.parentElement = null;
    }
    this.children.length = 0;
    this.append(...children);
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) {
      this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
  }
}

class FakeDocument {
  createElement(): FakeElement {
    return new FakeElement(this);
  }
}

describe("createWallpaperApp", () => {
  it("disposes the diagnostic provider registration when app creation fails", () => {
    const document = new FakeDocument();
    const parent = document.createElement();

    expect(() => createWallpaperApp(parent as unknown as HTMLElement)).toThrow();

    expect(parent.children).toEqual([]);
    expect(() => Debug.log("after failed app creation")).toThrow("Debug diagnostics");
    expect(() => Selection.snapshot).toThrow("Editor selection");
  });
});

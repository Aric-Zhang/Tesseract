import { describe, expect, it } from "vitest";
import { WINDOW_FULLSCREEN_PRESENTATION_LAYER, WINDOW_TOP_DOCKED_CHROME_LAYER } from "ui-framework/window";
import { createWallpaperAppShell } from "./app-shell";

class FakeElement {
  className = "";
  hidden = false;
  parentElement: FakeElement | null = null;
  readonly children: FakeElement[] = [];
  readonly ownerDocument: FakeDocument;
  readonly style = {
    properties: new Map<string, string>(),
    setProperty(name: string, value: string): void {
      this.properties.set(name, value);
    }
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

describe("createWallpaperAppShell", () => {
  it("creates the fixed app shell slots in layout order", () => {
    const document = new FakeDocument();
    const parent = document.createElement();

    const shell = createWallpaperAppShell(parent as unknown as HTMLElement);
    const root = shell.root as unknown as FakeElement;

    expect(parent.children).toEqual([shell.root as unknown as FakeElement]);
    expect(root.className).toBe("app-shell");
    expect(root.children.map((child) => child.className)).toEqual([
      "app-shell__menu",
      "app-shell__toolbar",
      "app-shell__root-dock",
      "app-shell__status",
      "app-shell__floating-overlay"
    ]);
    expect(root.style.properties.get("--window-top-docked-chrome-layer"))
      .toBe(String(WINDOW_TOP_DOCKED_CHROME_LAYER));
    expect(root.style.properties.get("--window-fullscreen-presentation-layer"))
      .toBe(String(WINDOW_FULLSCREEN_PRESENTATION_LAYER));
    expect(shell.toolbarSlot.hidden).toBe(true);
    expect(shell.statusSlot.hidden).toBe(true);
  });

  it("removes the shell root on dispose", () => {
    const document = new FakeDocument();
    const parent = document.createElement();
    const shell = createWallpaperAppShell(parent as unknown as HTMLElement);

    shell.dispose();

    expect(parent.children).toEqual([]);
  });
});

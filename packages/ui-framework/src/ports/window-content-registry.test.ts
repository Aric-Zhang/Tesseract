import { describe, expect, it } from "vitest";
import {
  commitWindowRegisteredContentLayout,
  WindowContentRegistry,
  type WindowContentLayoutCommit
} from "./window-content-registry";

describe("WindowContentRegistry", () => {
  it("registers content by logical content id and replays graph layout commits", () => {
    const registry = new WindowContentRegistry();
    const element = createElement();
    const registration = registry.registerContent({
      contentId: "content:scene",
      element,
      interactable: false
    });
    const commits: WindowContentLayoutCommit[] = [];

    registry.commitLayout("content:scene", createCommit({ active: true, interactable: false }));
    registration.subscribeLayoutCommit((commit) => commits.push(commit));

    expect(registry.getRegisteredContent("content:scene")).toBe(registration);
    expect(registration.element).toBe(element);
    expect(registration.interactable).toBe(false);
    expect(commits).toEqual([createCommit({ active: true, interactable: false })]);
  });

  it("replaces registered content for the same content id", () => {
    const registry = new WindowContentRegistry();
    const first = registry.registerContent({ contentId: "content:debug", element: createElement() });
    const second = registry.registerContent({ contentId: "content:debug", element: createElement() });

    expect(first.interactable).toBe(false);
    expect(registry.getRegisteredContent("content:debug")).toBe(second);
  });

  it("commits layout directly to registered content", () => {
    const registry = new WindowContentRegistry();
    const registered = registry.registerContent({
      contentId: "content:scene",
      element: createElement(),
      interactable: true
    });
    const commits: WindowContentLayoutCommit[] = [];

    registered.subscribeLayoutCommit((commit) => commits.push(commit));
    commitWindowRegisteredContentLayout(registered, createCommit({ active: true, interactable: true }));

    expect(commits).toHaveLength(1);
    expect(commits[0]?.contentRect.width).toBe(100);
    expect(registered.interactable).toBe(true);
  });
});

function createCommit(options: {
  readonly active: boolean;
  readonly interactable: boolean;
}): WindowContentLayoutCommit {
  return {
    surfaceId: "surface",
    contentId: "content:scene",
    tabsetId: "tabset",
    active: options.active,
    interactable: options.interactable,
    contentRect: { x: 0, y: 0, width: 100, height: 100 },
    surfaceRevision: 1,
    splits: []
  };
}

function createElement(): HTMLElement {
  return {
    remove() {}
  } as HTMLElement;
}

import { describe, expect, it } from "vitest";
import {
  commitWindowContentLayout,
  createWindowContentAttachment,
  WindowContentRegistry,
  type WindowContentHost,
  type WindowContentLayoutCommit,
  type WindowContentRegistrationPort
} from "./window-content-host";

describe("WindowContentRegistry", () => {
  it("registers content by logical content id and replays graph layout commits", () => {
    const registry = new WindowContentRegistry();
    const element = {} as HTMLElement;
    const registration = registry.register({
      contentId: "content:scene",
      element,
      interactable: false
    });
    const commits: WindowContentLayoutCommit[] = [];

    registry.commitLayout("content:scene", createCommit({ active: true, interactable: false }));
    registration.subscribeLayoutCommit((commit) => commits.push(commit));

    expect(registry.get("content:scene")).toBe(registration);
    expect(registration.element).toBe(element);
    expect(registration.interactable).toBe(false);
    expect(commits).toEqual([createCommit({ active: true, interactable: false })]);
  });

  it("replaces old registrations for the same content id", () => {
    const registry = new WindowContentRegistry();
    const first = registry.register({ contentId: "content:debug", element: {} as HTMLElement });
    const second = registry.register({ contentId: "content:debug", element: {} as HTMLElement });

    expect(first.interactable).toBe(false);
    expect(registry.get("content:debug")).toBe(second);
  });

  it("can be consumed through the narrow registration port without host placement", () => {
    const registry: WindowContentRegistrationPort = new WindowContentRegistry();
    const element = {} as HTMLElement;
    const registered = registry.registerContent({
      contentId: "content:hierarchy",
      element,
      interactable: true
    });

    registered.setInteractable(false);

    expect(registry.getRegisteredContent("content:hierarchy")).toBe(registered);
    expect(registered.element).toBe(element);
    expect(registered.interactable).toBe(false);
  });

  it("syncs registered content layout and interactability with the active attachment", () => {
    const registry = new WindowContentRegistry();
    const element = {} as HTMLElement;
    const registered = registry.registerContent({
      contentId: "content:scene",
      element,
      interactable: true
    });
    const host = createHost("scene-host");
    const attachment = host.mountContent(element);
    const commits: WindowContentLayoutCommit[] = [];

    registered.subscribeLayoutCommit((commit) => commits.push(commit));
    commitWindowContentLayout(attachment, createCommit({ active: true, interactable: true }));
    attachment.setInteractable(false);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.contentRect.width).toBe(100);
    expect(registered.interactable).toBe(false);

    registered.setInteractable(true);

    expect(attachment.interactable).toBe(true);
  });
});

function createHost(id: string): WindowContentHost {
  return {
    id,
    mountContent(element) {
      return createWindowContentAttachment(this, element, () => {}, () => {});
    },
    isContentInteractable() {
      return true;
    }
  };
}

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

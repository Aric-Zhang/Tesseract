import { describe, expect, it } from "vitest";
import {
  ActorSystem,
  ComponentRegistry,
  type Actor,
  type ComponentAttachmentRuntime
} from "actor-system/core";
import {
  FrameUpdateAttachmentRuntime
} from "../../ports/ui-frame-update-attachment-runtime";
import {
  uiElementComponentDefinition,
  uiElementComponentType
} from "../element";
import {
  UiLayoutHostComponent,
  UiLayoutItemComponent,
  uiLayoutHostComponentDefinition,
  uiLayoutHostComponentType,
  uiLayoutItemComponentDefinition,
  uiLayoutItemComponentType,
  type UiLayoutHostCommit,
  type UiLayoutItemComponentOptions,
  type UiLayoutSize
} from "./index";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly style: Record<string, string | undefined> = {};
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  className = "";
  hidden = false;

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
    if (index >= 0) {
      this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
  }
}

describe("UiLayoutHostComponent", () => {
  it("adds a host through ComponentRegistry when the actor has a UI element", () => {
    const fixture = createFixture();

    const host = fixture.addHost();

    expect(host.id).toBe("ui-layout-host");
    expect(host.type).toBe(uiLayoutHostComponentType);
    expect(host.actor).toBe(fixture.hostActor);
    expect(host.element).toBe(fixture.hostRoot as unknown as HTMLElement);
    expect(fixture.hostRoot.children).toContain(hostRoot(fixture.hostRoot));
  });

  it("fails through the required dependency when the actor has no UI element", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const actor = actorSystem.createActor({ id: "host" });

    expect(() => registry.addComponent(actor, uiLayoutHostComponentType)).toThrow(
      /Required component is missing/
    );
  });

  it("preserves unrelated host root children through construction, refresh, and dispose", () => {
    const fixture = createFixture();
    const unrelated = fixture.document.createElement("unrelated");
    fixture.hostRoot.append(unrelated);
    const host = fixture.addHost();

    expect(fixture.hostRoot.children[0]).toBe(unrelated);
    host.refreshLayout();
    host.dispose();

    expect(fixture.hostRoot.children).toEqual([unrelated]);
  });

  it("places top and fill children into stable regions with diagnostics", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    fixture.addChild("top", { slot: "top", order: 2 });
    fixture.addChild("fill", { slot: "fill", order: 1 });

    const commit = host.refreshLayout();

    expect(commit.revision).toBe(1);
    expect(commit.contributions.map((contribution) => contribution.actorId)).toEqual(["top", "fill"]);
    expect(region(fixture.hostRoot, "top").children.map(actorIdForWrapper)).toEqual(["top"]);
    expect(region(fixture.hostRoot, "fill").children.map(actorIdForWrapper)).toEqual(["fill"]);
    expect(wrapper(fixture.hostRoot, "top").dataset).toMatchObject({
      uiLayoutActorId: "top",
      uiLayoutSlot: "top",
      uiLayoutOrder: "2",
      uiLayoutLayer: "0",
      uiLayoutStretch: "both"
    });
    expect(region(fixture.hostRoot, "top").dataset.uiLayoutRegion).toBe("top");
    expect(hostRoot(fixture.hostRoot).dataset.uiLayoutRoot).toBe("true");
  });

  it("applies structural layout styles only to host-owned nodes", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    const child = fixture.addChild("overlay", {
      slot: "overlay",
      layer: 7,
      minSize: { width: 10, height: 11 },
      preferredSize: { width: 20, height: 21 }
    });

    host.refreshLayout();

    expect(hostRoot(fixture.hostRoot).style).toMatchObject({
      display: "flex",
      flexDirection: "column",
      position: "relative",
      width: "100%",
      height: "100%"
    });
    expect(region(fixture.hostRoot, "middle").style).toMatchObject({
      display: "flex",
      flexDirection: "row",
      flex: "1 1 auto",
      minWidth: "0",
      minHeight: "0"
    });
    expect(region(fixture.hostRoot, "fill").style).toMatchObject({
      display: "flex",
      flexDirection: "column",
      flex: "1 1 auto",
      minWidth: "0",
      minHeight: "0"
    });
    expect(region(fixture.hostRoot, "overlay").style).toMatchObject({
      position: "absolute",
      inset: "0",
      pointerEvents: "none"
    });
    expect(wrapper(fixture.hostRoot, "overlay").style).toMatchObject({
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      minWidth: "10px",
      minHeight: "11px",
      width: "20px",
      height: "21px",
      zIndex: "7"
    });
    expect(child.element.style).toEqual({});
  });

  it("gives fill stretch children a real host-owned flex box without styling the child", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    const child = fixture.addChild("render-view", { slot: "fill", stretch: "both" });

    host.refreshLayout();

    expect(region(fixture.hostRoot, "fill").style).toMatchObject({
      display: "flex",
      flexDirection: "column",
      flex: "1 1 auto",
      minWidth: "0",
      minHeight: "0"
    });
    expect(wrapper(fixture.hostRoot, "render-view").style).toMatchObject({
      display: "flex",
      flex: "1 1 auto",
      alignSelf: "stretch",
      minWidth: "0",
      minHeight: "0"
    });
    expect(child.element.style).toEqual({});
  });

  it("gives overlay children a full host-owned plane when no preferred size is declared", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    const child = fixture.addChild("overlay", { slot: "overlay", layer: 10, stretch: "none" });

    host.refreshLayout();

    expect(region(fixture.hostRoot, "overlay").style).toMatchObject({
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%"
    });
    expect(wrapper(fixture.hostRoot, "overlay").style).toMatchObject({
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none"
    });
    expect(child.element.style).toEqual({});
  });

  it("adds, removes, reparents away, and reparents back children through refresh", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    const child = fixture.addChild("child", { slot: "fill" });

    host.refreshLayout();
    expect(wrapper(fixture.hostRoot, "child")).toBeTruthy();

    fixture.actorSystem.setParent(child.actor, null);
    host.refreshLayout();
    expect(findWrapper(fixture.hostRoot, "child")).toBeNull();

    fixture.actorSystem.setParent(child.actor, fixture.hostActor);
    host.refreshLayout();
    expect(wrapper(fixture.hostRoot, "child")).toBeTruthy();

    fixture.actorSystem.destroyActor(child.actor);
    host.refreshLayout();
    expect(findWrapper(fixture.hostRoot, "child")).toBeNull();
  });

  it("filters disabled actors and disabled layout items", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    const actorDisabled = fixture.addChild("actor-disabled", { slot: "fill" });
    const itemDisabled = fixture.addChild("item-disabled", { slot: "fill" });

    host.refreshLayout();
    actorDisabled.actor.enabled = false;
    itemDisabled.item.enabled = false;
    host.refreshLayout();

    expect(findWrapper(fixture.hostRoot, "actor-disabled")).toBeNull();
    expect(findWrapper(fixture.hostRoot, "item-disabled")).toBeNull();
  });

  it("orders non-overlay slots by slot, order, then actor tree order", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    fixture.addChild("fill-a", { slot: "fill", order: 2 });
    fixture.addChild("top-b", { slot: "top", order: 1 });
    fixture.addChild("top-a", { slot: "top", order: 1 });
    fixture.addChild("left", { slot: "left", order: 0 });

    const commit = host.refreshLayout();

    expect(commit.contributions.map((contribution) => contribution.actorId)).toEqual([
      "top-b",
      "top-a",
      "left",
      "fill-a"
    ]);
    expect(region(fixture.hostRoot, "top").children.map(actorIdForWrapper)).toEqual(["top-b", "top-a"]);
  });

  it("orders overlays by layer, order, then actor tree order", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    fixture.addChild("overlay-b", { slot: "overlay", layer: 2, order: 1 });
    fixture.addChild("overlay-a", { slot: "overlay", layer: 1, order: 3 });
    fixture.addChild("overlay-c", { slot: "overlay", layer: 2, order: 1 });

    host.refreshLayout();

    expect(region(fixture.hostRoot, "overlay").children.map(actorIdForWrapper)).toEqual([
      "overlay-a",
      "overlay-b",
      "overlay-c"
    ]);
  });

  it("updates placement and revision when child layout descriptor changes", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    const child = fixture.addChild("child", { slot: "fill" });
    const first = host.refreshLayout();

    child.item.setLayout({ slot: "top", order: 4 });
    const second = host.refreshLayout();

    expect(second.revision).toBe(first.revision + 1);
    expect(region(fixture.hostRoot, "top").children.map(actorIdForWrapper)).toEqual(["child"]);
    expect(wrapper(fixture.hostRoot, "child").dataset.uiLayoutOrder).toBe("4");
  });

  it("updates revision and diagnostics when only stretch or sizes change", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    const child = fixture.addChild("child", { slot: "fill" });
    const first = host.refreshLayout();

    child.item.setLayout({
      stretch: "none",
      minSize: { width: 30 },
      preferredSize: { height: 40 }
    });
    const second = host.refreshLayout();

    expect(second.revision).toBe(first.revision + 1);
    expect(second.contributions[0]).toMatchObject({
      stretch: "none",
      minSize: { width: 30 },
      preferredSize: { height: 40 }
    });
    expect(wrapper(fixture.hostRoot, "child").dataset).toMatchObject({
      uiLayoutStretch: "none",
      uiLayoutMinWidth: "30",
      uiLayoutPreferredHeight: "40"
    });
  });

  it("returns immutable commit snapshots", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    fixture.addChild("child", {
      slot: "fill",
      minSize: { width: 10 }
    });
    const commit = host.refreshLayout();

    tryMutateCommit(commit, {
      revision: 100,
      actorId: "mutated",
      minSize: { width: 99 }
    });

    expect(host.refreshLayout()).toEqual({
      revision: 1,
      contributions: [{
        actorId: "child",
        slot: "fill",
        order: 0,
        layer: 0,
        stretch: "both",
        minSize: { width: 10 }
      }]
    });
  });

  it("refreshes as a no-op when disabled or disposed", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    fixture.addChild("child", { slot: "fill" });
    const first = host.refreshLayout();
    host.enabled = false;
    fixture.addChild("later", { slot: "fill" });

    const disabledCommit = host.refreshLayout();

    expect(disabledCommit).toEqual(first);
    expect(findWrapper(fixture.hostRoot, "later")).toBeNull();

    host.dispose();
    const childrenAfterDispose = [...fixture.hostRoot.children];
    const disposedCommit = host.refreshLayout();

    expect(disposedCommit).toEqual(first);
    expect(fixture.hostRoot.children).toEqual(childrenAfterDispose);
  });

  it("does not mutate child element generic state", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    const child = fixture.addChild("child", { slot: "fill" });
    child.element.className = "child-class";
    child.element.hidden = true;
    child.element.dataset.uiInteractable = "external";
    child.element.style.color = "red";

    host.refreshLayout();
    host.dispose();

    expect(child.element.className).toBe("child-class");
    expect(child.element.hidden).toBe(true);
    expect(child.element.dataset).toEqual({ uiInteractable: "external" });
    expect(child.element.style).toEqual({ color: "red" });
  });

  it("detaches borrowed child elements instead of restoring an old external parent", () => {
    const fixture = createFixture();
    const host = fixture.addHost();
    const oldParent = fixture.document.createElement("old-parent");
    const child = fixture.addChild("borrowed", { slot: "fill" });
    oldParent.append(child.element);

    host.refreshLayout();
    expect(child.element.parentElement).toBe(wrapper(fixture.hostRoot, "borrowed"));
    fixture.actorSystem.setParent(child.actor, null);
    host.refreshLayout();

    expect(child.element.parentElement).toBeNull();
    expect(oldParent.children).toEqual([]);
  });

  it("updates layout through frame update attachment", () => {
    const fixture = createFixture({ withFrameUpdateRuntime: true });
    fixture.addHost();
    fixture.addChild("child", { slot: "fill" });

    fixture.frameUpdateRuntime!.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(wrapper(fixture.hostRoot, "child")).toBeTruthy();
  });
});

interface Fixture {
  readonly actorSystem: ActorSystem;
  readonly registry: ComponentRegistry;
  readonly frameUpdateRuntime?: FrameUpdateAttachmentRuntime;
  readonly document: FakeDocument;
  readonly hostActor: Actor;
  readonly hostRoot: FakeElement;
  addHost(): UiLayoutHostComponent;
  addChild(id: string, options: UiLayoutItemComponentOptions): {
    readonly actor: Actor;
    readonly element: FakeElement;
    readonly item: UiLayoutItemComponent;
  };
}

function createFixture(options: { readonly withFrameUpdateRuntime?: boolean } = {}): Fixture {
  const actorSystem = new ActorSystem();
  const frameUpdateRuntime = options.withFrameUpdateRuntime
    ? new FrameUpdateAttachmentRuntime({ actorSystem })
    : undefined;
  const registry = createRegistry(actorSystem, frameUpdateRuntime);
  const document = new FakeDocument();
  const hostActor = actorSystem.createActor({ id: "host" });
  const hostRoot = document.createElement("host-root");
  registry.addComponent(hostActor, uiElementComponentType, {
    element: hostRoot as unknown as HTMLElement
  });

  return {
    actorSystem,
    registry,
    frameUpdateRuntime,
    document,
    hostActor,
    hostRoot,
    addHost() {
      return registry.addComponent(hostActor, uiLayoutHostComponentType);
    },
    addChild(id, childOptions) {
      const actor = actorSystem.createActor({ id, parent: hostActor });
      const element = document.createElement(id);
      registry.addComponent(actor, uiElementComponentType, {
        element: element as unknown as HTMLElement
      });
      const item = registry.addComponent(actor, uiLayoutItemComponentType, childOptions);
      return { actor, element, item };
    }
  };
}

function createRegistry(
  actorSystem: ActorSystem,
  attachmentRuntime?: ComponentAttachmentRuntime
): ComponentRegistry {
  const registry = new ComponentRegistry({ actorSystem, attachmentRuntime });
  registry.registerDefinition(uiElementComponentDefinition);
  registry.registerDefinition(uiLayoutItemComponentDefinition);
  registry.registerDefinition(uiLayoutHostComponentDefinition);
  return registry;
}

function hostRoot(root: FakeElement): FakeElement {
  return findByDataset(root, "uiLayoutRoot", "true");
}

function region(root: FakeElement, name: string): FakeElement {
  return findByDataset(root, "uiLayoutRegion", name);
}

function wrapper(root: FakeElement, actorId: string): FakeElement {
  return findByDataset(root, "uiLayoutActorId", actorId);
}

function findWrapper(root: FakeElement, actorId: string): FakeElement | null {
  return findByDatasetOrNull(root, "uiLayoutActorId", actorId);
}

function findByDataset(root: FakeElement, key: string, value: string): FakeElement {
  const result = findByDatasetOrNull(root, key, value);
  if (!result) {
    throw new Error(`Expected element with dataset ${key}=${value}`);
  }
  return result;
}

function findByDatasetOrNull(root: FakeElement, key: string, value: string): FakeElement | null {
  if (root.dataset[key] === value) return root;
  for (const child of root.children) {
    const result = findByDatasetOrNull(child, key, value);
    if (result) return result;
  }
  return null;
}

function actorIdForWrapper(element: FakeElement): string | undefined {
  return element.dataset.uiLayoutActorId;
}

function tryMutateCommit(
  commit: UiLayoutHostCommit,
  mutation: {
    readonly revision: number;
    readonly actorId: string;
    readonly minSize: UiLayoutSize;
  }
): void {
  try {
    (commit as { revision: number }).revision = mutation.revision;
  } catch {
    // Frozen commits may throw in strict mode; either outcome is fine.
  }
  try {
    (commit.contributions as unknown as Array<{ actorId: string }>)[0].actorId = mutation.actorId;
  } catch {
    // Frozen contributions may throw in strict mode; either outcome is fine.
  }
  try {
    (commit.contributions[0].minSize as { width: number }).width = mutation.minSize.width!;
  } catch {
    // Frozen nested sizes may throw in strict mode; either outcome is fine.
  }
}

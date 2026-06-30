import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-system/core";
import type { UiElementComponent } from "ui-framework/actor-ui";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "ui-framework/window";
import { InspectorRootContentComponent } from "./inspector-root-content-component";

class FakeWindowContentRegistry implements WindowContentRegistrationPort {
  registered: { readonly contentId: string; readonly element: HTMLElement } | null = null;
  interactable = true;
  layoutCallbacks: ((commit: WindowContentLayoutCommit) => void)[] = [];

  registerContent(request: { readonly contentId: string; readonly element: HTMLElement }): WindowRegisteredContent {
    const registry = this;
    this.registered = request;
    return {
      contentId: request.contentId,
      element: request.element,
      get interactable() {
        return registry.interactable;
      },
      setInteractable(interactable: boolean) {
        registry.interactable = interactable;
      },
      subscribeLayoutCommit(callback: (commit: WindowContentLayoutCommit) => void): WindowContentLayoutCommitRegistration {
        registry.layoutCallbacks.push(callback);
        return {
          dispose() {
            const index = registry.layoutCallbacks.indexOf(callback);
            if (index >= 0) registry.layoutCallbacks.splice(index, 1);
          }
        };
      },
      dispose: () => {
        if (this.registered?.contentId === request.contentId) {
          this.registered = null;
        }
      }
    };
  }
}

describe("InspectorRootContentComponent", () => {
  it("registers the same UiElement root as window content", () => {
    const fixture = createFixture();

    expect(fixture.registry.registered).toEqual({
      contentId: "content:inspector",
      element: fixture.element
    });
    expect(fixture.component.contentId).toBe("content:inspector");
    expect(fixture.component.element).toBe(fixture.element);
  });

  it("forwards interactable and layout subscriptions", () => {
    const fixture = createFixture();
    const callback = () => {};

    fixture.component.setInteractable(false);
    const registration = fixture.component.subscribeLayoutCommit(callback);

    expect(fixture.component.interactable).toBe(false);
    expect(fixture.registry.layoutCallbacks).toEqual([callback]);

    registration.dispose();

    expect(fixture.registry.layoutCallbacks).toEqual([]);
  });

  it("disposes registration once", () => {
    const fixture = createFixture();

    fixture.component.dispose();
    fixture.component.dispose();

    expect(fixture.component.enabled).toBe(false);
    expect(fixture.registry.registered).toBeNull();
  });
});

function createFixture(): {
  readonly component: InspectorRootContentComponent;
  readonly element: HTMLElement;
  readonly registry: FakeWindowContentRegistry;
} {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "inspector:root" });
  const element = createFakeElement();
  const registry = new FakeWindowContentRegistry();
  const component = new InspectorRootContentComponent(
    actor,
    { element } as UiElementComponent,
    {
      contentId: "content:inspector",
      contentRegistration: registry
    }
  );
  return { component, element, registry };
}

function createFakeElement(): HTMLElement {
  return {
    dataset: {},
    textContent: ""
  } as unknown as HTMLElement;
}

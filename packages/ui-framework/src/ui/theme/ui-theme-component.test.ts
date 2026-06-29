import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import {
  uiElementComponentDefinition,
  uiElementComponentType
} from "../element";
import {
  UiThemeComponent,
  uiThemeComponentDefinition,
  uiThemeComponentType
} from "./index";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

class FakeStyle {
  readonly #values = new Map<string, string>();

  setProperty(property: string, value: string): void {
    this.#values.set(property, value);
  }

  removeProperty(property: string): void {
    this.#values.delete(property);
  }

  getPropertyValue(property: string): string {
    return this.#values.get(property) ?? "";
  }
}

class FakeElement {
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly style = new FakeStyle();

  constructor(tagName: string) {
    this.tagName = tagName;
  }
}

describe("UiThemeComponent", () => {
  it("applies theme tokens to the same actor UI element", () => {
    const { actor, element, registry } = createActorWithElement();

    const component = registry.addComponent(actor, uiThemeComponentType, {
      theme: {
        id: "custom",
        tokens: {
          "--ui-color-panel-bg": "#223344"
        }
      }
    });

    expect(component).toBeInstanceOf(UiThemeComponent);
    expect(element.dataset.uiTheme).toBe("custom");
    expect(element.style.getPropertyValue("--ui-color-panel-bg")).toBe("#223344");
    expect(element.style.getPropertyValue("--ui-color-text")).toBe("rgba(232, 242, 252, 0.94)");
  });

  it("updates theme tokens without creating another component", () => {
    const { actor, element, registry } = createActorWithElement();
    const component = registry.addComponent(actor, uiThemeComponentType, {
      theme: { id: "first" }
    });

    component.setTheme({
      id: "second",
      tokens: {
        "--ui-color-text": "#abcdef"
      }
    });

    expect(registry.getComponent(actor, uiThemeComponentType)).toBe(component);
    expect(element.dataset.uiTheme).toBe("second");
    expect(element.style.getPropertyValue("--ui-color-text")).toBe("#abcdef");
  });

  it("restores only theme state that it applied", () => {
    const { actor, element, registry } = createActorWithElement();
    element.dataset.uiTheme = "external";
    element.style.setProperty("--ui-color-text", "#111111");
    element.style.setProperty("--external-token", "#222222");

    const component = registry.addComponent(actor, uiThemeComponentType, {
      theme: {
        id: "temporary",
        tokens: {
          "--ui-color-text": "#333333"
        }
      }
    });

    component.dispose();
    component.dispose();

    expect(component.enabled).toBe(false);
    expect(element.dataset.uiTheme).toBe("external");
    expect(element.style.getPropertyValue("--ui-color-text")).toBe("#111111");
    expect(element.style.getPropertyValue("--external-token")).toBe("#222222");
  });

  it("fails through the required dependency when the actor has no UI element", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, uiThemeComponentType)).toThrow(
      /Required component is missing/
    );
  });
});

function createActorWithElement(): {
  readonly actor: ReturnType<ActorSystem["createActor"]>;
  readonly element: FakeElement;
  readonly registry: ComponentRegistry;
} {
  const actorSystem = new ActorSystem();
  const registry = createRegistry(actorSystem);
  const actor = actorSystem.createActor({ id: "actor" });
  const document = new FakeDocument();
  const elementComponent = registry.addComponent(actor, uiElementComponentType, {
    document: document as unknown as Document
  });
  return {
    actor,
    element: elementComponent.element as unknown as FakeElement,
    registry
  };
}

function createRegistry(actorSystem: ActorSystem): ComponentRegistry {
  const registry = new ComponentRegistry({ actorSystem });
  registry.registerDefinition(uiElementComponentDefinition);
  registry.registerDefinition(uiThemeComponentDefinition);
  return registry;
}

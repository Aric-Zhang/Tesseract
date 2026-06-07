import { describe, expect, it } from "vitest";
import { ActorSystem } from "../actor-runtime";
import type {
  Component,
  ComponentAttachmentDescriptor,
  ComponentAttachmentRegistration,
  ComponentAttachmentRuntime
} from "../actor-runtime";
import { componentAttachmentKind } from "../actor-runtime";
import { CompositeComponentAttachmentRuntime } from "./composite-component-attachment-runtime";

const testAttachment: ComponentAttachmentDescriptor = {
  kind: componentAttachmentKind("test-attachment")
};

function createComponent(): { actorSystem: ActorSystem; component: Component } {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "actor" });
  return {
    actorSystem,
    component: {
      id: "component",
      type: "component",
      actor,
      enabled: true
    }
  };
}

function createRuntime(
  label: string,
  calls: string[],
  options: {
    readonly failAttach?: boolean;
    readonly failDispose?: boolean;
  } = {}
): ComponentAttachmentRuntime {
  return {
    attach(_actor, component, attachments): ComponentAttachmentRegistration {
      calls.push(`${label}:attach:${component.id}:${attachments[0]?.kind ?? "none"}`);
      if (options.failAttach) throw new Error(`${label} attach failed`);
      return {
        dispose() {
          calls.push(`${label}:dispose:${component.id}`);
          if (options.failDispose) throw new Error(`${label} dispose failed`);
        }
      };
    }
  };
}

describe("CompositeComponentAttachmentRuntime", () => {
  it("attaches runtimes in order and disposes them in reverse order", () => {
    const calls: string[] = [];
    const { component } = createComponent();
    const runtime = new CompositeComponentAttachmentRuntime([
      createRuntime("first", calls),
      createRuntime("second", calls)
    ]);

    const registration = runtime.attach(component.actor, component, [testAttachment]);
    registration.dispose();

    expect(calls).toEqual([
      "first:attach:component:test-attachment",
      "second:attach:component:test-attachment",
      "second:dispose:component",
      "first:dispose:component"
    ]);
  });

  it("rolls back earlier runtime registrations when a later runtime fails", () => {
    const calls: string[] = [];
    const { component } = createComponent();
    const runtime = new CompositeComponentAttachmentRuntime([
      createRuntime("first", calls),
      createRuntime("second", calls, { failAttach: true })
    ]);

    expect(() => runtime.attach(component.actor, component, [testAttachment])).toThrow("second attach failed");

    expect(calls).toEqual([
      "first:attach:component:test-attachment",
      "second:attach:component:test-attachment",
      "first:dispose:component"
    ]);
  });

  it("continues disposing earlier registrations when a later dispose fails", () => {
    const calls: string[] = [];
    const { component } = createComponent();
    const runtime = new CompositeComponentAttachmentRuntime([
      createRuntime("first", calls),
      createRuntime("second", calls, { failDispose: true }),
      createRuntime("third", calls)
    ]);

    const registration = runtime.attach(component.actor, component, [testAttachment]);

    expect(() => registration.dispose()).toThrow("second dispose failed");
    expect(calls).toEqual([
      "first:attach:component:test-attachment",
      "second:attach:component:test-attachment",
      "third:attach:component:test-attachment",
      "third:dispose:component",
      "second:dispose:component",
      "first:dispose:component"
    ]);
  });

  it("aggregates multiple dispose failures after releasing every registration", () => {
    const calls: string[] = [];
    const { component } = createComponent();
    const runtime = new CompositeComponentAttachmentRuntime([
      createRuntime("first", calls, { failDispose: true }),
      createRuntime("second", calls, { failDispose: true })
    ]);

    const registration = runtime.attach(component.actor, component, [testAttachment]);

    expect(() => registration.dispose()).toThrow(AggregateError);
    expect(calls).toEqual([
      "first:attach:component:test-attachment",
      "second:attach:component:test-attachment",
      "second:dispose:component",
      "first:dispose:component"
    ]);
  });
});

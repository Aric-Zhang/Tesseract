import { describe, expect, it } from "vitest";
import type {
  Actor,
  Component,
  ComponentAttachmentDescriptor,
  ComponentAttachmentRegistration,
  ComponentAttachmentRuntime
} from "./index";
import { CompositeComponentAttachmentRuntime } from "./composite-component-attachment-runtime";

const testActor = { id: "actor" } as Actor;
const testComponent = { id: "component", type: "component", actor: testActor, enabled: true } as Component;

describe("CompositeComponentAttachmentRuntime", () => {
  it("attaches and disposes runtimes in reverse order", () => {
    const calls: string[] = [];
    const runtime = new CompositeComponentAttachmentRuntime([
      createRuntime("a", calls),
      createRuntime("b", calls)
    ]);

    const registration = runtime.attach(testActor, testComponent, []);
    registration.dispose();

    expect(calls).toEqual(["attach:a", "attach:b", "dispose:b", "dispose:a"]);
  });

  it("rolls back already attached runtimes when a later runtime fails", () => {
    const calls: string[] = [];
    const runtime = new CompositeComponentAttachmentRuntime([
      createRuntime("a", calls),
      createRuntime("b", calls, "attach")
    ]);

    expect(() => runtime.attach(testActor, testComponent, [])).toThrow("attach:b failed");
    expect(calls).toEqual(["attach:a", "attach:b", "dispose:a"]);
  });

  it("reports multiple dispose failures", () => {
    const calls: string[] = [];
    const runtime = new CompositeComponentAttachmentRuntime([
      createRuntime("a", calls, "dispose"),
      createRuntime("b", calls, "dispose")
    ]);
    const registration = runtime.attach(testActor, testComponent, []);

    expect(() => registration.dispose()).toThrow(AggregateError);
    expect(calls).toEqual(["attach:a", "attach:b", "dispose:b", "dispose:a"]);
  });
});

function createRuntime(
  label: string,
  calls: string[],
  failAt?: "attach" | "dispose"
): ComponentAttachmentRuntime {
  return {
    attach(
      _actor: Actor,
      _component: Component,
      _attachments: readonly ComponentAttachmentDescriptor[]
    ): ComponentAttachmentRegistration {
      calls.push(`attach:${label}`);
      if (failAt === "attach") {
        throw new Error(`attach:${label} failed`);
      }
      return {
        dispose() {
          calls.push(`dispose:${label}`);
          if (failAt === "dispose") {
            throw new Error(`dispose:${label} failed`);
          }
        }
      };
    }
  };
}

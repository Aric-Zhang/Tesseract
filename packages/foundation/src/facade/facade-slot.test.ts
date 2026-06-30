import { describe, expect, it } from "vitest";

import { createFacadeSlot } from "./facade-slot";

describe("createFacadeSlot", () => {
  it("throws before a provider is installed", () => {
    const slot = createFacadeSlot<{ readonly value: string }>("test-slot");

    expect(() => slot.current()).toThrow("test-slot");
    expect(slot.isInstalled()).toBe(false);
  });

  it("installs and disposes one provider", () => {
    const slot = createFacadeSlot<{ readonly value: string }>("test-slot");
    const provider = { value: "a" };
    const registration = slot.install(provider);

    expect(slot.isInstalled()).toBe(true);
    expect(slot.current()).toBe(provider);

    registration.dispose();

    expect(slot.isInstalled()).toBe(false);
    expect(() => slot.current()).toThrow("test-slot");
  });

  it("rejects installing a second provider while installed", () => {
    const slot = createFacadeSlot<{ readonly value: string }>("test-slot");
    slot.install({ value: "a" });

    expect(() => slot.install({ value: "b" })).toThrow("already installed");
  });

  it("makes dispose idempotent", () => {
    const slot = createFacadeSlot<{ readonly value: string }>("test-slot");
    const registration = slot.install({ value: "a" });

    registration.dispose();
    registration.dispose();

    expect(slot.isInstalled()).toBe(false);
  });

  it("does not let a stale registration remove a newer provider", () => {
    const slot = createFacadeSlot<{ readonly value: string }>("test-slot");
    const first = { value: "first" };
    const second = { value: "second" };
    const firstRegistration = slot.install(first);

    firstRegistration.dispose();
    const secondRegistration = slot.install(second);
    firstRegistration.dispose();

    expect(slot.current()).toBe(second);

    secondRegistration.dispose();
    expect(slot.isInstalled()).toBe(false);
  });

  it("keeps different slots independent", () => {
    const firstSlot = createFacadeSlot<{ readonly value: string }>("first-slot");
    const secondSlot = createFacadeSlot<{ readonly value: string }>("second-slot");
    const firstProvider = { value: "first" };
    const secondProvider = { value: "second" };

    firstSlot.install(firstProvider);
    secondSlot.install(secondProvider);

    expect(firstSlot.current()).toBe(firstProvider);
    expect(secondSlot.current()).toBe(secondProvider);
  });

  it("allows null as an explicit provider value", () => {
    const slot = createFacadeSlot<null>("nullable-slot");
    const registration = slot.install(null);

    expect(slot.isInstalled()).toBe(true);
    expect(slot.current()).toBe(null);

    registration.dispose();
    expect(slot.isInstalled()).toBe(false);
  });
});

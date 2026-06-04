import { describe, expect, it } from "vitest";
import { ComponentTransaction } from "./component-transaction";

describe("ComponentTransaction", () => {
  it("runs rollback actions in reverse order", () => {
    const calls: string[] = [];
    const transaction = new ComponentTransaction();

    transaction.addRollback(() => calls.push("first"));
    transaction.addRollback(() => calls.push("second"));
    transaction.rollback();

    expect(calls).toEqual(["second", "first"]);
  });

  it("reports rollback errors while continuing the rollback stack", () => {
    const calls: string[] = [];
    const errors: unknown[][] = [];
    const transaction = new ComponentTransaction((rollbackErrors) => errors.push([...rollbackErrors]));

    transaction.addRollback(() => calls.push("first"));
    transaction.addRollback(() => {
      calls.push("second");
      throw new Error("second failed");
    });
    transaction.rollback();

    expect(calls).toEqual(["second", "first"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveLength(1);
  });

  it("does not rollback after commit", () => {
    const calls: string[] = [];
    const transaction = new ComponentTransaction();

    transaction.addRollback(() => calls.push("rollback"));
    transaction.commit();
    transaction.rollback();

    expect(calls).toEqual([]);
  });
});

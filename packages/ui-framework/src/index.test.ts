import { describe, expect, it } from "vitest";
import { uiFrameworkPackageName } from ".";

describe("ui-framework package scaffold", () => {
  it("exports a package marker", () => {
    expect(uiFrameworkPackageName).toBe("ui-framework");
  });
});

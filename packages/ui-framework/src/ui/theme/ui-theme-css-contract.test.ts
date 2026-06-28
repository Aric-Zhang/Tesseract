import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { uiThemeTokenDefinitions } from "./ui-theme-tokens";

describe("UI framework CSS theme token contract", () => {
  it("only references declared --ui-* theme tokens from controls CSS", () => {
    const css = readFileSync(new URL("../ui-framework-controls.css", import.meta.url), "utf8");
    const declaredTokens = new Set(uiThemeTokenDefinitions.map((definition) => definition.name));
    const referencedTokens = [...css.matchAll(/var\((--ui-[\w-]+)/g)]
      .map((match) => match[1])
      .sort();
    const unknownTokens = referencedTokens.filter((token) => !declaredTokens.has(token));

    expect(unknownTokens).toEqual([]);
  });

  it("uses the scrollbar theme token set for native scrollbars", () => {
    const css = readFileSync(new URL("../ui-framework-controls.css", import.meta.url), "utf8");

    expect(css).toMatch(/--ui-scrollbar-size/);
    expect(css).toMatch(/--ui-scrollbar-track/);
    expect(css).toMatch(/--ui-scrollbar-thumb/);
    expect(css).toMatch(/--ui-scrollbar-thumb-hover/);
    expect(css).not.toMatch(/--ui-color-border-strong/);
  });
});

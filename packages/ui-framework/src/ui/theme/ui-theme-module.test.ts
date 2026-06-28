import { describe, expect, it } from "vitest";
import {
  createUiThemeModule,
  generateUiThemeCss,
  getUiThemeDefaultTokens,
  parseUiThemeModule,
  uiThemeTokenDefinitions,
  validateUiThemeModule
} from "./index";

describe("ui theme module", () => {
  it("fills omitted tokens from defaults", () => {
    const defaults = getUiThemeDefaultTokens();

    const theme = createUiThemeModule({
      id: "partial",
      tokens: {
        "--ui-color-panel-bg": "#223344"
      }
    });

    expect(theme.tokens["--ui-color-panel-bg"]).toBe("#223344");
    expect(theme.tokens["--ui-color-text"]).toBe(defaults["--ui-color-text"]);
    expect(Object.keys(theme.tokens)).toHaveLength(uiThemeTokenDefinitions.length);
  });

  it("handles unknown tokens according to policy", () => {
    expect(parseUiThemeModule({
      id: "ignored",
      tokens: { "--old-token": "red" }
    }, { unknownTokenPolicy: "ignore" }).diagnostics).toEqual([]);

    expect(parseUiThemeModule({
      id: "warned",
      tokens: { "--old-token": "red" }
    }, { unknownTokenPolicy: "warn" }).diagnostics).toEqual([{
      kind: "unknown-token",
      token: "--old-token",
      message: "Unknown UI theme token: --old-token",
      action: "ignored"
    }]);

    expect(parseUiThemeModule({
      id: "stripped",
      tokens: { "--old-token": "red" }
    }, { unknownTokenPolicy: "strip" }).diagnostics).toEqual([{
      kind: "unknown-token",
      token: "--old-token",
      message: "Unknown UI theme token: --old-token",
      action: "stripped"
    }]);

    expect(() => parseUiThemeModule({
      id: "strict",
      tokens: { "--old-token": "red" }
    }, { unknownTokenPolicy: "strict" })).toThrow(/Unknown UI theme token/);
  });

  it("defaults invalid known token values outside strict mode", () => {
    const defaults = getUiThemeDefaultTokens();

    const result = parseUiThemeModule({
      id: "invalid",
      tokens: {
        "--ui-color-panel-bg": "not a color"
      }
    });

    expect(result.module.tokens["--ui-color-panel-bg"]).toBe(defaults["--ui-color-panel-bg"]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      kind: "invalid-token-value",
      token: "--ui-color-panel-bg",
      action: "defaulted"
    });
    expect(() => parseUiThemeModule({
      id: "invalid",
      tokens: {
        "--ui-color-panel-bg": "not a color"
      }
    }, { unknownTokenPolicy: "strict" })).toThrow(/Invalid CSS color/);
  });

  it("validates theme modules without owning file paths", () => {
    const diagnostics = validateUiThemeModule({
      id: "diagnostics",
      tokens: {
        "--unknown": "value",
        "--ui-border-width": "wide"
      }
    }, { unknownTokenPolicy: "warn" });

    expect(diagnostics.map((diagnostic) => diagnostic.kind)).toEqual([
      "unknown-token",
      "invalid-token-value"
    ]);
  });

  it("generates CSS defaults from token definitions", () => {
    const css = generateUiThemeCss();
    const defaults = getUiThemeDefaultTokens();

    for (const definition of uiThemeTokenDefinitions) {
      expect(css).toContain(`${definition.name}: ${defaults[definition.name]};`);
    }
    expect(css).toContain("Generated from ui-theme-tokens.ts");
  });
});

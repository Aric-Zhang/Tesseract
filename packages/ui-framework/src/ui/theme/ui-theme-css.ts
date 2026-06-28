import { uiThemeTokenDefinitions } from "./ui-theme-tokens.js";

export function generateUiThemeCss(): string {
  const declarations = uiThemeTokenDefinitions
    .map((definition) => `  ${definition.name}: ${definition.defaultValue};`)
    .join("\n");
  return [
    "/* Generated from ui-theme-tokens.ts. Do not edit defaults by hand. */",
    ":root,",
    ".ui-theme {",
    declarations,
    "}",
    ""
  ].join("\n");
}

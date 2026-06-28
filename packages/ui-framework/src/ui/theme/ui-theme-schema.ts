import type {
  UiThemeTokenDefinition,
  UiThemeTokenValueKind
} from "./ui-theme-tokens";

export interface UiThemeTokenValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export function validateUiThemeTokenValue(
  definition: UiThemeTokenDefinition,
  value: string
): UiThemeTokenValidationResult {
  if (value.trim() !== value || value.length === 0) {
    return { valid: false, reason: "Theme token value must be a non-empty trimmed string." };
  }
  return validateByKind(definition.kind, value);
}

function validateByKind(kind: UiThemeTokenValueKind, value: string): UiThemeTokenValidationResult {
  switch (kind) {
    case "color":
      return validateColor(value);
    case "length":
    case "fontSize":
    case "borderWidth":
    case "radius":
      return validateCssLength(value);
    case "fontFamily":
      return value.includes(";")
        ? { valid: false, reason: "Font-family token cannot contain semicolons." }
        : { valid: true };
    case "lineHeight":
      return validateLineHeight(value);
    case "shadow":
      return value.includes(";")
        ? { valid: false, reason: "Shadow token cannot contain semicolons." }
        : { valid: true };
  }
}

function validateColor(value: string): UiThemeTokenValidationResult {
  if (
    /^#[0-9a-fA-F]{3,8}$/.test(value) ||
    /^(rgba?|hsla?)\([^)]+\)$/.test(value) ||
    value === "transparent" ||
    value === "currentColor" ||
    /^var\(--[a-zA-Z0-9-]+\)$/.test(value)
  ) {
    return { valid: true };
  }
  return { valid: false, reason: `Invalid CSS color token value: ${value}` };
}

function validateCssLength(value: string): UiThemeTokenValidationResult {
  if (value === "0" || /^-?\d+(\.\d+)?(px|rem|em|%)$/.test(value)) {
    return { valid: true };
  }
  return { valid: false, reason: `Invalid CSS length token value: ${value}` };
}

function validateLineHeight(value: string): UiThemeTokenValidationResult {
  if (/^\d+(\.\d+)?$/.test(value)) {
    return { valid: true };
  }
  return validateCssLength(value);
}

import {
  getUiThemeDefaultTokens,
  getUiThemeTokenDefinition,
  uiThemeTokenDefinitions,
  type UiThemeTokenName
} from "./ui-theme-tokens";
import { validateUiThemeTokenValue } from "./ui-theme-schema";

export type UiThemeUnknownTokenPolicy = "ignore" | "warn" | "strip" | "strict";

export type UiThemeDiagnosticKind = "unknown-token" | "invalid-token-value";

export interface UiThemeDiagnostic {
  readonly kind: UiThemeDiagnosticKind;
  readonly token: string;
  readonly message: string;
  readonly action: "ignored" | "stripped" | "defaulted";
}

export interface UiThemeModule {
  readonly id: string;
  readonly label?: string;
  readonly tokens: Readonly<Record<UiThemeTokenName, string>>;
}

export interface UiThemeModuleInput {
  readonly id?: unknown;
  readonly label?: unknown;
  readonly tokens?: unknown;
}

export interface UiThemeParseOptions {
  readonly unknownTokenPolicy?: UiThemeUnknownTokenPolicy;
}

export interface UiThemeParseResult {
  readonly module: UiThemeModule;
  readonly diagnostics: readonly UiThemeDiagnostic[];
}

export function parseUiThemeModule(
  input: UiThemeModuleInput,
  options: UiThemeParseOptions = {}
): UiThemeParseResult {
  const unknownTokenPolicy = options.unknownTokenPolicy ?? "warn";
  const id = typeof input.id === "string" && input.id.trim().length > 0
    ? input.id
    : "theme";
  const label = typeof input.label === "string" && input.label.trim().length > 0
    ? input.label
    : undefined;
  const providedTokens = isTokenRecord(input.tokens) ? input.tokens : {};
  const tokens = getUiThemeDefaultTokens();
  const diagnostics: UiThemeDiagnostic[] = [];

  for (const [name, value] of Object.entries(providedTokens)) {
    const definition = getUiThemeTokenDefinition(name);
    if (!definition) {
      const diagnostic = createUnknownTokenDiagnostic(name, unknownTokenPolicy);
      if (diagnostic) diagnostics.push(diagnostic);
      if (unknownTokenPolicy === "strict") {
        throw new Error(diagnostic?.message ?? `Unknown UI theme token: ${name}`);
      }
      continue;
    }

    if (typeof value !== "string") {
      const diagnostic = createInvalidValueDiagnostic(name, "Theme token value must be a string.");
      diagnostics.push(diagnostic);
      if (unknownTokenPolicy === "strict") {
        throw new Error(diagnostic.message);
      }
      continue;
    }

    const validation = validateUiThemeTokenValue(definition, value);
    if (!validation.valid) {
      const diagnostic = createInvalidValueDiagnostic(name, validation.reason ?? "Invalid theme token value.");
      diagnostics.push(diagnostic);
      if (unknownTokenPolicy === "strict") {
        throw new Error(diagnostic.message);
      }
      continue;
    }

    tokens[definition.name] = value;
  }

  return {
    module: freezeThemeModule({ id, label, tokens }),
    diagnostics
  };
}

export function createUiThemeModule(input: UiThemeModuleInput): UiThemeModule {
  return parseUiThemeModule(input, { unknownTokenPolicy: "strip" }).module;
}

export function validateUiThemeModule(
  input: UiThemeModuleInput,
  options: UiThemeParseOptions = {}
): readonly UiThemeDiagnostic[] {
  return parseUiThemeModule(input, options).diagnostics;
}

export function createUiThemeTokenStyleText(tokens: Readonly<Record<UiThemeTokenName, string>>): string {
  return uiThemeTokenDefinitions
    .map((definition) => `${definition.name}: ${tokens[definition.name]};`)
    .join(" ");
}

function isTokenRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createUnknownTokenDiagnostic(
  token: string,
  policy: UiThemeUnknownTokenPolicy
): UiThemeDiagnostic | null {
  if (policy === "ignore") return null;
  return {
    kind: "unknown-token",
    token,
    message: `Unknown UI theme token: ${token}`,
    action: policy === "strip" ? "stripped" : "ignored"
  };
}

function createInvalidValueDiagnostic(token: string, reason: string): UiThemeDiagnostic {
  return {
    kind: "invalid-token-value",
    token,
    message: `${token}: ${reason}`,
    action: "defaulted"
  };
}

function freezeThemeModule(module: {
  readonly id: string;
  readonly label?: string;
  readonly tokens: Record<UiThemeTokenName, string>;
}): UiThemeModule {
  return Object.freeze({
    id: module.id,
    label: module.label,
    tokens: Object.freeze({ ...module.tokens })
  });
}

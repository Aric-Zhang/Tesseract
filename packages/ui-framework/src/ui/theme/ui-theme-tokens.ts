export type UiThemeTokenGroup =
  | "font"
  | "surface"
  | "text"
  | "state"
  | "border"
  | "scrollbar"
  | "window"
  | "shadow";

export type UiThemeTokenValueKind =
  | "color"
  | "length"
  | "fontFamily"
  | "fontSize"
  | "lineHeight"
  | "borderWidth"
  | "radius"
  | "shadow";

export interface UiThemeTokenDefinition {
  readonly name: string;
  readonly group: UiThemeTokenGroup;
  readonly kind: UiThemeTokenValueKind;
  readonly defaultValue: string;
  readonly description: string;
}

export const uiThemeTokenDefinitions = [
  token("--ui-font-family", "font", "fontFamily", "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif", "Default proportional UI font stack."),
  token("--ui-font-family-mono", "font", "fontFamily", "\"Cascadia Mono\", \"Consolas\", monospace", "Default monospace UI font stack."),
  token("--ui-font-size", "font", "fontSize", "12px", "Default compact UI font size."),
  token("--ui-line-height", "font", "lineHeight", "1.25", "Default compact UI line height."),

  token("--ui-color-app-bg", "surface", "color", "#10161c", "Application background."),
  token("--ui-color-panel-bg", "surface", "color", "#151b21", "Panel background."),
  token("--ui-color-surface", "surface", "color", "#141a20", "Default control surface."),
  token("--ui-color-surface-elevated", "surface", "color", "#101419", "Elevated surface or popup background."),
  token("--ui-color-content-bg", "surface", "color", "#080c10", "Content viewport background."),

  token("--ui-color-text", "text", "color", "rgba(232, 242, 252, 0.94)", "Default text color."),
  token("--ui-color-text-muted", "text", "color", "rgba(188, 205, 220, 0.58)", "Muted secondary text color."),
  token("--ui-color-text-disabled", "text", "color", "rgba(188, 205, 220, 0.45)", "Disabled text color."),
  token("--ui-color-text-selected", "text", "color", "#ffffff", "Text or mark color on selected/accented controls."),

  token("--ui-color-accent", "state", "color", "rgba(124, 195, 255, 0.92)", "Primary UI accent."),
  token("--ui-color-accent-muted", "state", "color", "rgba(124, 195, 255, 0.55)", "Muted accent state."),
  token("--ui-color-hover-bg", "state", "color", "rgba(124, 195, 255, 0.14)", "Hover background."),
  token("--ui-color-selected-bg", "state", "color", "rgba(42, 58, 70, 0.92)", "Selected/open background."),
  token("--ui-color-focus-ring", "state", "color", "rgba(234, 248, 255, 0.72)", "Keyboard focus outline or border."),
  token("--ui-button-bg", "state", "color", "var(--ui-color-surface)", "Default button background."),
  token("--ui-button-hover-bg", "state", "color", "var(--ui-color-hover-bg)", "Button hover background."),
  token("--ui-button-active-bg", "state", "color", "var(--ui-color-selected-bg)", "Button active background."),
  token("--ui-button-pressed-bg", "state", "color", "rgba(124, 195, 255, 0.22)", "Pressed toggle button background."),
  token("--ui-button-disabled-bg", "state", "color", "rgba(98, 112, 124, 0.14)", "Disabled button background."),
  token("--ui-button-text", "state", "color", "var(--ui-color-text)", "Button text and icon color."),
  token("--ui-button-disabled-text", "state", "color", "var(--ui-color-text-disabled)", "Disabled button text and icon color."),
  token("--ui-button-border", "state", "color", "var(--ui-border-color)", "Button border color."),
  token("--ui-button-pressed-border", "state", "color", "var(--ui-color-accent-muted)", "Pressed toggle button border color."),
  token("--ui-toolbar-bg", "state", "color", "rgba(15, 21, 27, 0.92)", "Toolbar background."),
  token("--ui-toolbar-border", "state", "color", "var(--ui-border-color)", "Toolbar border color."),
  token("--ui-control-icon-color", "state", "color", "currentColor", "Generic control icon color."),

  token("--ui-border-color", "border", "color", "rgba(174, 203, 228, 0.2)", "Default border color."),
  token("--ui-border-color-strong", "border", "color", "rgba(174, 203, 228, 0.52)", "Stronger border color."),
  token("--ui-border-width", "border", "borderWidth", "1px", "Default border width."),
  token("--ui-radius-control", "border", "radius", "4px", "Default compact control radius."),
  token("--ui-radius-panel", "border", "radius", "6px", "Default panel or popup radius."),

  token("--ui-scrollbar-size", "scrollbar", "length", "10px", "Native scrollbar preferred size."),
  token("--ui-scrollbar-track", "scrollbar", "color", "rgba(16, 20, 25, 0.94)", "Scrollbar track color."),
  token("--ui-scrollbar-thumb", "scrollbar", "color", "rgba(188, 205, 220, 0.48)", "Scrollbar thumb color."),
  token("--ui-scrollbar-thumb-hover", "scrollbar", "color", "rgba(188, 205, 220, 0.7)", "Scrollbar thumb hover color."),

  token("--ui-window-bg", "window", "color", "#151b21", "Window body background."),
  token("--ui-window-border", "window", "color", "rgba(174, 203, 228, 0.2)", "Window border color."),
  token("--ui-window-titlebar-bg", "window", "color", "#121922", "Window titlebar background."),
  token("--ui-window-tab-bg", "window", "color", "#1a2f40", "Window tab background."),
  token("--ui-window-tab-active-bg", "window", "color", "#25445c", "Active window tab background."),
  token("--ui-window-splitter-bg", "window", "color", "#26323d", "Window splitter background."),
  token("--ui-window-splitter-line", "window", "color", "rgba(160, 215, 255, 0.28)", "Window splitter line color."),
  token("--ui-window-resize-grip", "window", "color", "rgba(180, 222, 255, 0.45)", "Floating window resize grip color."),
  token("--ui-dock-preview-border", "window", "color", "rgba(120, 190, 255, 0.78)", "Dock preview border color."),
  token("--ui-dock-preview-bg", "window", "color", "rgba(52, 132, 224, 0.24)", "Dock preview background."),
  token("--ui-dock-preview-shadow", "shadow", "shadow", "inset 0 0 0 1px rgba(230, 246, 255, 0.18), 0 8px 22px rgba(0, 0, 0, 0.28)", "Dock preview shadow."),
  token("--ui-dock-preview-merge-border", "window", "color", "rgba(165, 216, 255, 0.92)", "Dock preview merge border color."),
  token("--ui-dock-preview-merge-bg", "window", "color", "rgba(95, 156, 232, 0.34)", "Dock preview merge background."),
  token("--ui-dock-preview-merge-shadow", "shadow", "shadow", "inset 0 -2px 0 rgba(215, 241, 255, 0.68), 0 8px 22px rgba(0, 0, 0, 0.28)", "Dock preview merge shadow."),
  token("--ui-dock-preview-split-bg", "window", "color", "rgba(52, 132, 224, 0.18)", "Dock preview split background."),
  token("--ui-dock-preview-marker-bg", "window", "color", "rgba(214, 241, 255, 0.86)", "Dock preview split marker background."),
  token("--ui-dock-preview-floating-border", "window", "color", "rgba(210, 220, 232, 0.62)", "Dock preview floating border color."),
  token("--ui-dock-preview-floating-bg", "window", "color", "rgba(190, 207, 225, 0.10)", "Dock preview floating background."),
  token("--ui-dock-preview-floating-shadow", "shadow", "shadow", "inset 0 0 0 1px rgba(230, 246, 255, 0.10)", "Dock preview floating shadow."),

  token("--ui-shadow-elevated", "shadow", "shadow", "0 8px 24px rgba(0, 0, 0, 0.32)", "Default elevated popup shadow.")
] as const satisfies readonly UiThemeTokenDefinition[];

export type UiThemeTokenName = typeof uiThemeTokenDefinitions[number]["name"];

export function getUiThemeDefaultTokens(): Record<UiThemeTokenName, string> {
  const tokens = {} as Record<UiThemeTokenName, string>;
  for (const definition of uiThemeTokenDefinitions) {
    tokens[definition.name] = definition.defaultValue;
  }
  return tokens;
}

export function getUiThemeTokenDefinition(name: string): UiThemeTokenDefinition | undefined {
  return uiThemeTokenDefinitions.find((definition) => definition.name === name);
}

export function isUiThemeTokenName(name: string): name is UiThemeTokenName {
  return getUiThemeTokenDefinition(name) !== undefined;
}

function token(
  name: string,
  group: UiThemeTokenGroup,
  kind: UiThemeTokenValueKind,
  defaultValue: string,
  description: string
): UiThemeTokenDefinition {
  return { name, group, kind, defaultValue, description };
}

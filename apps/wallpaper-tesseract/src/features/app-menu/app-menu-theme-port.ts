import { type UiThemeDiagnostic, type UiThemeModule } from "ui-framework/theme";

export interface AppMenuThemeDescriptor {
  readonly id: string;
  readonly label: string;
  readonly diagnostics: readonly UiThemeDiagnostic[];
}

export interface AppMenuThemeController {
  listThemes(): readonly AppMenuThemeDescriptor[];
  getSelectedThemeId(): string;
  getSelectedThemeDiagnostics(): readonly UiThemeDiagnostic[];
  setTheme(themeId: string): UiThemeModule;
}

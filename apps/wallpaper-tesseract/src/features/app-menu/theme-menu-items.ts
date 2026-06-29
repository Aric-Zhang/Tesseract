import type { MenuItemDescriptor } from "ui-framework";
import type { AppMenuThemeDescriptor } from "./app-menu-theme-port";

export interface ThemeMenuPayload {
  readonly action: {
    readonly kind: "select-theme";
    readonly themeId: string;
  };
}

export function createThemeMenuItems(
  themes: readonly AppMenuThemeDescriptor[],
  selectedThemeId: string
): readonly MenuItemDescriptor<ThemeMenuPayload>[] {
  return themes.map((theme) => ({
    id: `theme:${theme.id}`,
    label: theme.label,
    role: "checkbox",
    checked: theme.id === selectedThemeId,
    leading: { kind: "checkbox" },
    payload: {
      action: {
        kind: "select-theme",
        themeId: theme.id
      }
    }
  }));
}

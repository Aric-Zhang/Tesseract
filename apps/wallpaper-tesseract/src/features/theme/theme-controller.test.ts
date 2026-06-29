import { describe, expect, it } from "vitest";
import { createUiThemeModule, getUiThemeDefaultTokens, type UiThemeModuleInput } from "ui-framework/theme";
import { createAppThemeController } from "./theme-controller";

class FakeThemeComponent {
  theme = createUiThemeModule({ id: "initial" });

  setTheme(theme: UiThemeModuleInput) {
    this.theme = createUiThemeModule(theme);
    return this.theme;
  }
}

describe("createAppThemeController", () => {
  it("applies selected parsed theme modules to the root theme component", () => {
    const rootTheme = new FakeThemeComponent();
    const controller = createAppThemeController({
      rootTheme: rootTheme as never,
      themes: [
        { id: "default-dark", label: "Default Dark" },
        {
          id: "contrast",
          label: "Contrast",
          tokens: {
            "--ui-color-app-bg": "#001122"
          }
        }
      ]
    });

    controller.setTheme("contrast");

    expect(controller.getSelectedThemeId()).toBe("contrast");
    expect(rootTheme.theme.id).toBe("contrast");
    expect(rootTheme.theme.tokens["--ui-color-app-bg"]).toBe("#001122");
    expect(rootTheme.theme.tokens["--ui-color-panel-bg"]).toBe(getUiThemeDefaultTokens()["--ui-color-panel-bg"]);
  });

  it("keeps unknown token diagnostics in the app-local controller", () => {
    const controller = createAppThemeController({
      rootTheme: new FakeThemeComponent() as never,
      themes: [
        {
          id: "default-dark",
          tokens: {
            "--obsolete-token": "#ffffff"
          }
        }
      ]
    });

    expect(controller.getSelectedThemeDiagnostics()).toEqual([{
      kind: "unknown-token",
      token: "--obsolete-token",
      message: "Unknown UI theme token: --obsolete-token",
      action: "ignored"
    }]);
  });

  it("falls back to default-dark for unknown selected theme ids", () => {
    const rootTheme = new FakeThemeComponent();
    const controller = createAppThemeController({
      rootTheme: rootTheme as never,
      themes: [
        { id: "default-dark", label: "Default Dark" },
        { id: "other", label: "Other" }
      ],
      initialThemeId: "missing"
    });

    const module = controller.setTheme("still-missing");

    expect(module.id).toBe("default-dark");
    expect(controller.getSelectedThemeId()).toBe("default-dark");
    expect(rootTheme.theme.id).toBe("default-dark");
  });
});

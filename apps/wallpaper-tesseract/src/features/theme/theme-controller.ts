import {
  createUiThemeModule,
  parseUiThemeModule,
  type UiThemeComponent,
  type UiThemeDiagnostic,
  type UiThemeModule,
  type UiThemeModuleInput
} from "ui-framework";

export interface AppThemeDescriptor {
  readonly id: string;
  readonly label: string;
  readonly diagnostics: readonly UiThemeDiagnostic[];
}

export interface AppThemeController {
  listThemes(): readonly AppThemeDescriptor[];
  getSelectedThemeId(): string;
  getSelectedThemeDiagnostics(): readonly UiThemeDiagnostic[];
  setTheme(themeId: string): UiThemeModule;
}

interface ThemeRecord {
  readonly module: UiThemeModule;
  readonly diagnostics: readonly UiThemeDiagnostic[];
}

export interface CreateAppThemeControllerOptions {
  readonly rootTheme: UiThemeComponent;
  readonly themes?: readonly UiThemeModuleInput[];
  readonly initialThemeId?: string;
}

export function createAppThemeController(options: CreateAppThemeControllerOptions): AppThemeController {
  const records = new Map<string, ThemeRecord>();
  for (const input of options.themes ?? createBuiltInThemes()) {
    const result = parseUiThemeModule(input, { unknownTokenPolicy: "warn" });
    records.set(result.module.id, {
      module: result.module,
      diagnostics: result.diagnostics
    });
  }
  if (!records.has("default-dark")) {
    const fallback = createUiThemeModule({ id: "default-dark", label: "Default Dark" });
    records.set(fallback.id, { module: fallback, diagnostics: [] });
  }

  let selectedThemeId = records.has(options.initialThemeId ?? "")
    ? options.initialThemeId!
    : "default-dark";
  options.rootTheme.setTheme(records.get(selectedThemeId)!.module);

  return {
    listThemes() {
      return [...records.values()].map(({ module, diagnostics }) => ({
        id: module.id,
        label: module.label ?? module.id,
        diagnostics
      }));
    },
    getSelectedThemeId() {
      return selectedThemeId;
    },
    getSelectedThemeDiagnostics() {
      return records.get(selectedThemeId)?.diagnostics ?? [];
    },
    setTheme(themeId: string) {
      const record = records.get(themeId) ?? records.get("default-dark")!;
      selectedThemeId = record.module.id;
      options.rootTheme.setTheme(record.module);
      return record.module;
    }
  };
}

function createBuiltInThemes(): readonly UiThemeModuleInput[] {
  return [
    {
      id: "default-dark",
      label: "Default Dark"
    },
    {
      id: "graphite-blue",
      label: "Graphite Blue",
      tokens: {
        "--ui-color-app-bg": "#0f1720",
        "--ui-color-panel-bg": "#182431",
        "--ui-color-surface": "#1d2d3b",
        "--ui-color-surface-elevated": "#121d28",
        "--ui-color-content-bg": "#071019",
        "--ui-color-text": "rgba(216, 236, 255, 0.96)",
        "--ui-color-text-muted": "rgba(176, 210, 238, 0.68)",
        "--ui-color-accent": "rgba(112, 191, 255, 0.95)",
        "--ui-color-hover-bg": "rgba(112, 191, 255, 0.18)",
        "--ui-color-selected-bg": "rgba(44, 80, 108, 0.95)",
        "--ui-window-titlebar-bg": "#142131",
        "--ui-window-tab-bg": "#203c52",
        "--ui-window-tab-active-bg": "#2f5f80",
        "--ui-window-border": "rgba(140, 201, 244, 0.32)",
        "--ui-scrollbar-thumb": "rgba(144, 202, 246, 0.55)",
        "--ui-scrollbar-thumb-hover": "rgba(180, 224, 255, 0.78)",
        "--ui-dock-preview-border": "rgba(125, 202, 255, 0.86)",
        "--ui-dock-preview-bg": "rgba(50, 142, 230, 0.28)",
        "--ui-dock-preview-merge-border": "rgba(174, 224, 255, 0.96)",
        "--ui-dock-preview-merge-bg": "rgba(88, 169, 238, 0.38)"
      }
    }
  ];
}

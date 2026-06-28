import type { Actor, Component, ComponentType } from "actor-core";
import type { UiElementComponent } from "../element";
import {
  createUiThemeModule,
  type UiThemeModule,
  type UiThemeModuleInput
} from "./ui-theme-module";
import { uiThemeTokenDefinitions, type UiThemeTokenName } from "./ui-theme-tokens";

export const uiThemeComponentType =
  "ui-theme-component" as ComponentType<UiThemeComponent>;

export interface UiThemeComponentOptions {
  readonly id?: string;
  readonly theme?: UiThemeModuleInput;
}

interface AppliedStyleState {
  readonly property: string;
  readonly present: boolean;
  readonly value: string;
}

export class UiThemeComponent implements Component {
  readonly type = uiThemeComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  #theme: UiThemeModule;
  #disposed = false;
  #themeDatasetState: { readonly present: boolean; readonly value: string | undefined } | null = null;
  readonly #styleState = new Map<string, AppliedStyleState>();

  constructor(actor: Actor, uiElement: UiElementComponent, options: UiThemeComponentOptions = {}) {
    this.actor = actor;
    this.id = options.id ?? "ui-theme";
    this.element = uiElement.element;
    this.#theme = createUiThemeModule(options.theme ?? { id: "default" });
    this.applyTheme();
  }

  get theme(): UiThemeModule {
    return this.#theme;
  }

  setTheme(theme: UiThemeModuleInput): UiThemeModule {
    if (this.#disposed) return this.#theme;
    this.#theme = createUiThemeModule(theme);
    this.applyTheme();
    return this.#theme;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    for (const state of this.#styleState.values()) {
      if (state.present) {
        this.element.style.setProperty(state.property, state.value);
      } else {
        this.element.style.removeProperty(state.property);
      }
    }
    if (this.#themeDatasetState) {
      if (this.#themeDatasetState.present) {
        this.element.dataset.uiTheme = this.#themeDatasetState.value ?? "";
      } else {
        delete this.element.dataset.uiTheme;
      }
    }
  }

  private applyTheme(): void {
    this.captureThemeDatasetState();
    this.element.dataset.uiTheme = this.#theme.id;
    for (const definition of uiThemeTokenDefinitions) {
      this.captureStyleState(definition.name);
      this.element.style.setProperty(definition.name, this.#theme.tokens[definition.name as UiThemeTokenName]);
    }
  }

  private captureThemeDatasetState(): void {
    if (this.#themeDatasetState) return;
    this.#themeDatasetState = {
      present: Object.hasOwn(this.element.dataset, "uiTheme"),
      value: this.element.dataset.uiTheme
    };
  }

  private captureStyleState(property: string): void {
    if (this.#styleState.has(property)) return;
    const value = this.element.style.getPropertyValue(property);
    this.#styleState.set(property, {
      property,
      present: value.length > 0,
      value
    });
  }
}

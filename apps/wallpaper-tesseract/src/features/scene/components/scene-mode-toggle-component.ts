import type { ScreenPoint } from "gizmo-core";
import type { Actor, Component, ComponentType } from "../../../actor-runtime";
import type {
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputParticipant
} from "../../../gizmo-runtime";
import {
  sceneParameterPaths,
  type SceneCommandSink,
  type SceneStateChangedEvent
} from "../../../scene-runtime";
import type { StateObserverResponder } from "../../../state-runtime";
import type { SceneViewportComponent } from "./scene-viewport-component";

export const sceneModeToggleComponentType =
  "scene-mode-toggle-component" as ComponentType<SceneModeToggleComponent>;

export type SceneWorkspaceMode = "run" | "develop";

export const SCENE_MODE_TOGGLE_SOURCE = {
  id: "scene-mode-toggle",
  kind: "gizmo"
} as const;

export interface SceneModeToggleComponentOptions {
  id?: string;
  initialMode?: SceneWorkspaceMode;
  document?: Pick<Document, "createElement">;
}

export interface SceneModeToggleComponentServices {
  commandSink: SceneCommandSink;
}

export class SceneModeToggleComponent
  implements Component, ActorInputParticipant, StateObserverResponder {
  readonly type = sceneModeToggleComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly #commandSink: SceneCommandSink;
  readonly #controlsElement: HTMLDivElement;
  readonly #buttonElement: HTMLButtonElement;
  #mode: SceneWorkspaceMode;

  constructor(
    actor: Actor,
    viewport: SceneViewportComponent,
    options: SceneModeToggleComponentOptions,
    services: SceneModeToggleComponentServices
  ) {
    this.actor = actor;
    this.id = options.id ?? "scene-mode-toggle";
    this.#mode = options.initialMode ?? "develop";
    this.#commandSink = services.commandSink;
    const documentRef = resolveDocument(options);
    this.#controlsElement = documentRef.createElement("div");
    this.#controlsElement.className = "scene-window__view-controls";
    this.#buttonElement = documentRef.createElement("button");
    this.#buttonElement.className = "scene-window__mode-toggle-button";
    this.#buttonElement.type = "button";
    this.#buttonElement.tabIndex = 0;
    this.#controlsElement.append(this.#buttonElement);
    viewport.overlayElement.append(this.#controlsElement);
    this.applyMode();
  }

  get controlsElement(): HTMLDivElement {
    return this.#controlsElement;
  }

  get zoneElement(): HTMLDivElement {
    return this.#controlsElement;
  }

  get buttonElement(): HTMLButtonElement {
    return this.#buttonElement;
  }

  onSceneStateChanged(event: SceneStateChangedEvent): void {
    const modeChange = event.changes.find((change) => change.path === sceneParameterPaths.workspace.mode);
    if (!modeChange) return;
    this.#mode = modeChange.nextValue as SceneWorkspaceMode;
    this.applyMode();
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.enabled) return null;
    if (!isPointInsideRect(point, this.#buttonElement.getBoundingClientRect())) return null;
    return {
      componentId: this.id,
      partId: "scene-mode-toggle",
      kind: "chrome",
      region: "actor-overlay",
      localRoutePriority: 2000,
      hitPriority: 60,
      path: [{
        componentId: this.id,
        role: "control",
        partId: "scene-mode-toggle"
      }]
    };
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick) return;
    this.#commandSink.submit({
      source: SCENE_MODE_TOGGLE_SOURCE,
      target: sceneParameterPaths.workspace.mode,
      operation: "set",
      value: this.#mode === "run" ? "develop" : "run",
      timeStamp: event.timeStamp
    });
  }

  dispose(): void {
    this.enabled = false;
    this.#controlsElement.remove();
  }

  private applyMode(): void {
    const isRunMode = this.#mode === "run";
    this.#buttonElement.className = [
      "scene-window__mode-toggle-button",
      isRunMode
        ? "scene-window__mode-toggle-button--windowed"
        : "scene-window__mode-toggle-button--fullscreen"
    ].join(" ");
    this.#buttonElement.ariaLabel = isRunMode ? "Shrink Scene to window" : "Expand Scene to fullscreen";
    this.#buttonElement.title = this.#buttonElement.ariaLabel;
  }
}

function resolveDocument(options: SceneModeToggleComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (typeof document !== "undefined") return document;
  throw new Error("SceneModeToggleComponent requires a document.");
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

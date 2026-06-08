import {
  cloneUiVec2,
  uiVec2,
  type UiVec2
} from "../ports/ui-geometry";
import type { UiLayoutPath } from "../ports/ui-layout-state";

export interface FloatingWindowState {
  position: UiVec2;
  size: UiVec2;
  visible: boolean;
}

export interface FloatingWindowParameterPaths {
  position: UiLayoutPath<UiVec2>;
  size: UiLayoutPath<UiVec2>;
  visible: UiLayoutPath<boolean>;
}

export interface FloatingWindowStateOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  width?: number;
  height?: number;
  minSize?: UiVec2;
  maxSize?: UiVec2;
  margin?: number;
  visible?: boolean;
}

export const DEFAULT_FLOATING_WINDOW_MIN_SIZE = uiVec2(240, 120);

export function createDefaultFloatingWindowState(options: FloatingWindowStateOptions = {}): FloatingWindowState {
  const viewportWidth = options.viewportWidth ?? getViewportWidth();
  const viewportHeight = options.viewportHeight ?? getViewportHeight();
  const margin = options.margin ?? 14;
  const minSize = options.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE;
  const maxSize = options.maxSize ?? uiVec2(720, 240);
  const width = constrainDimension(
    options.width ?? Math.min(maxSize.x, Math.max(minSize.x, viewportWidth - margin * 2)),
    minSize.x,
    maxSize.x
  );
  const height = constrainDimension(
    options.height ?? Math.min(maxSize.y, Math.max(minSize.y, viewportHeight * 0.38)),
    minSize.y,
    maxSize.y
  );
  return {
    position: uiVec2(margin, Math.max(margin, viewportHeight - height - margin)),
    size: uiVec2(width, height),
    visible: options.visible ?? true
  };
}

export function cloneFloatingWindowState(state: FloatingWindowState): FloatingWindowState {
  return {
    position: cloneUiVec2(state.position),
    size: cloneUiVec2(state.size),
    visible: state.visible
  };
}

function constrainDimension(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getViewportWidth(): number {
  return typeof window === "undefined" ? 720 : window.innerWidth;
}

function getViewportHeight(): number {
  return typeof window === "undefined" ? 720 : window.innerHeight;
}

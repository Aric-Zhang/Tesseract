import {
  uiLayoutPath,
  type FloatingWindowParameterPaths,
  type UiVec2
} from "ui-framework";

export const editorWindowLayoutPaths = {
  debugWindow: createFloatingWindowPaths("debugWindow"),
  hierarchyWindow: createFloatingWindowPaths("hierarchyWindow"),
  sceneWindow: createFloatingWindowPaths("sceneWindow")
} as const;

function createFloatingWindowPaths(prefix: string): FloatingWindowParameterPaths {
  return {
    position: uiLayoutPath<UiVec2>(`${prefix}.position`),
    size: uiLayoutPath<UiVec2>(`${prefix}.size`),
    visible: uiLayoutPath<boolean>(`${prefix}.visible`)
  };
}

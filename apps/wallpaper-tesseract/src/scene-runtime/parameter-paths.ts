import { parameterPath } from "./scene-update-command";
import type { Vec2 } from "./vec2";

export const sceneParameterPaths = {
  debugWindow: {
    position: parameterPath<Vec2>("debugWindow.position"),
    size: parameterPath<Vec2>("debugWindow.size"),
    visible: parameterPath<boolean>("debugWindow.visible")
  },
  hierarchyWindow: {
    position: parameterPath<Vec2>("hierarchyWindow.position"),
    size: parameterPath<Vec2>("hierarchyWindow.size"),
    visible: parameterPath<boolean>("hierarchyWindow.visible")
  },
  sceneWindow: {
    position: parameterPath<Vec2>("sceneWindow.position"),
    size: parameterPath<Vec2>("sceneWindow.size"),
    visible: parameterPath<boolean>("sceneWindow.visible")
  },
  selection: {
    activeObject: parameterPath<string | null>("selection.activeObject")
  },
  workspace: {
    mode: parameterPath<"run" | "develop">("workspace.mode")
  }
} as const;

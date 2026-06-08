import {
  loadPersistedWindowWorkspaceFrameLayout as loadPersistedWindowWorkspaceFrameLayoutWithKey,
  WindowWorkspaceFrameLayoutPersistenceController as BaseWindowWorkspaceFrameLayoutPersistenceController,
  type WindowWorkspaceFrameLayoutPersistenceControllerOptions,
  type WindowWorkspaceFrameLayoutStorage
} from "ui-framework";

export const WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY =
  "wallpaper-tesseract.windowWorkspaceFrameLayout.v1";

export const WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_CONTROLLER_ID =
  "window-workspace-frame-layout-persistence-controller";

export type {
  WindowWorkspaceFrameLayoutPersistenceControllerOptions,
  WindowWorkspaceFrameLayoutStorage
};

export class WindowWorkspaceFrameLayoutPersistenceController
  extends BaseWindowWorkspaceFrameLayoutPersistenceController {
  constructor(options: WindowWorkspaceFrameLayoutPersistenceControllerOptions) {
    super({
      ...options,
      key: options.key ?? WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY
    });
  }
}

export function loadPersistedWindowWorkspaceFrameLayout(
  storage: WindowWorkspaceFrameLayoutStorage | null,
  key = WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY
) {
  return loadPersistedWindowWorkspaceFrameLayoutWithKey(storage, key);
}

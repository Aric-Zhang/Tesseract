# Project Prism Phase 0B Browser Smoke Report

Status: passed

URL: http://127.0.0.1:5183/
Layout reset: resetWorkspaceLayout=1
Validation errors: 0

## Scenarios

- 1280x720: 6 interactions, console errors 0
  - desktop-root-tab-uncovered: actor workspace-root-frame/window-tab, dom DIV.window-frame-tab workspace-root-dock-frame__tab is-active, result {"rootTabHit":true}
  - desktop-floating-over-root-tab: actor hierarchy-panel/window-tab, dom DIV.window-frame-tab floating-gizmo-window__title floating-gizmo-window__tab is-active, result {"floatingAboveRoot":true}
  - desktop-scene-fullscreen: actor scene-window:view/scene-mode-toggle, dom BUTTON.scene-window__mode-toggle-button scene-window__mode-toggle-button--fullscreen, result {"fullscreen":true,"floatingVisibleCount":1}
  - desktop-scene-restore: actor scene-window:view/scene-mode-toggle, dom BUTTON.scene-window__mode-toggle-button scene-window__mode-toggle-button--windowed, result {"restored":true,"floatingVisibleCount":2}
  - desktop-app-menu-button: actor app-menu-bar/menu-button, dom DIV.app-shell__menu, result {"menuOpen":true}
  - desktop-app-menu-scene-focus: actor app-menu-bar/window-command-item, dom CANVAS., result {"sceneTabVisible":true}
- 390x720: 3 interactions, console errors 0
  - mobile-floating-tab-close: actor hierarchy-panel/window-tab-action, dom BUTTON.window-frame-tab__close floating-gizmo-window__tab-close, result {"hierarchyClosed":true,"closeInsideTab":true,"preClickCloseRect":{"x":153,"y":21.5,"width":16,"height":16},"preClickTabRect":{"x":25,"y":17.5,"width":150,"height":24}}
  - mobile-app-menu-button: actor app-menu-bar/menu-button, dom DIV.app-shell__menu, result {"menuOpen":true}
  - mobile-app-menu-hierarchy-restore: actor app-menu-bar/window-command-item, dom CANVAS.camera3-gizmo__canvas, result {"hierarchyRestored":true}

## Geometry Note

- mobile-floating-tab-close closeInsideTab was measured before click: true

## Artifacts

- temp/project-prism-phase-0b-browser-smoke-data.json
- temp/project-prism-phase-0b-*.png


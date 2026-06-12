# Project Prism Phase 6 Smoke Report

URL: http://127.0.0.1:5173/?resetWorkspaceLayout=1
Viewport: 1280x720
Console errors: 0

Scenarios:
- boot-baseline: passed (D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-boot-baseline.png)
- window-menu-open-focus: passed (D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-menu-inspector-opened.png)
- root-tab-close-reopen: passed (D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-boot-baseline.png)
- dock-mutation-5b-5c: passed (D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-boot-baseline.png)
- splitter-resize: passed (D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-boot-baseline.png)
- scene-fullscreen-restore: passed (D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-scene-fullscreen.png, D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-scene-restored.png)
- persistence-reload: passed (D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-boot-baseline.png)
- mobile-viewport: passed (D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-mobile-viewport.png)
- render-input-sanity: passed (D:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/tesseract/temp/phase6-smoke/phase6-camera3-projection-toggle.png)

Notes:
- Camera3 gizmo CSS loaded from packages/editor/src/camera3/camera3-gizmo.css.
- Camera3 projection toggle changed label to || Iso.
- Scene fullscreen toggled and Escape restored normal presentation.
- Persistence evidence uses v2 logical descriptors only.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceFiles = import.meta.glob("./**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>;

function findForbiddenMethodCalls(
  methodNames: readonly string[],
  allowedFiles: ReadonlySet<string>
): string[] {
  const violations: string[] = [];
  for (const [file, source] of Object.entries(sourceFiles)) {
    if (file === "./architecture-boundaries.test.ts" || allowedFiles.has(file)) continue;
    for (const methodName of methodNames) {
      const pattern = new RegExp(`\\.${methodName}\\s*\\(`);
      if (pattern.test(source)) {
        violations.push(`${file}: ${methodName}`);
      }
    }
  }
  return violations.sort();
}

function findForbiddenSourceMatches(
  pattern: RegExp,
  allowedFiles: ReadonlySet<string> = new Set()
): string[] {
  const violations: string[] = [];
  for (const [file, source] of Object.entries(sourceFiles)) {
    if (file === "./architecture-boundaries.test.ts" || allowedFiles.has(file)) continue;
    if (pattern.test(source)) {
      violations.push(file);
    }
  }
  return violations.sort();
}

function readSourceFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("architecture boundaries", () => {
  it("removes deprecated AppRuntimeContext legacy registration calls", () => {
    expect(findForbiddenMethodCalls([
      "registerLegacyRuntimeObject",
      "registerLegacyGizmoObject",
      "registerLegacyStatefulGizmoObject"
    ], new Set())).toEqual([]);
  });

  it("removes the old non-legacy AppRuntimeContext registration names", () => {
    expect(findForbiddenSourceMatches(
      /\bregister(?:RuntimeObject|GizmoObject|StatefulGizmoObject)\b/
    )).toEqual([]);
  });

  it("keeps demo from directly constructing gizmo UI objects before actor factories", () => {
    const demoSource = sourceFiles["./demo.ts"] ?? "";

    expect(demoSource).not.toMatch(/\bnew\s+(DebugLogWindow|Camera3Gizmo|Tesseract4RuntimeObject)\s*\(/);
  });

  it("removes legacy DebugLogWindow imports and factories", () => {
    expect(findForbiddenSourceMatches(
      /(?:from\s+["'](?:\.\/|\.\.\/)debug-log-window["'])|(?:new\s+DebugLogWindow\s*\()|(?:debug\/legacy)/
    )).toEqual([]);
    expect(sourceFiles["./debug/components/debug-log-window-actor-factory.ts"] ?? "").not.toMatch(
      /(?:from\s+["']\.\.\/debug-log-window["'])|(?:new\s+DebugLogWindow\s*\()/
    );
    expect(sourceFiles["./debug/components/debug-log-content-component.ts"] ?? "").not.toMatch(
      /(?:from\s+["']\.\.\/debug-log-window["'])|(?:new\s+DebugLogWindow\s*\()/
    );
  });

  it("keeps the normal debug entrypoint off the legacy window factory", () => {
    expect(sourceFiles["./debug/index.ts"] ?? "").not.toMatch(/\bcreateDebugLogWindow\b/);
    expect(sourceFiles["./debug/index.ts"] ?? "").not.toMatch(/\bGizmoDebugPanel\b/);
    expect(sourceFiles["./debug/index.ts"] ?? "").toMatch(/\bcreateDebugLogWindowActor\b/);
    expect(sourceFiles["./debug/index.ts"] ?? "").toMatch(/\bcreateDefaultDebugWindowState\b/);
    expect(sourceFiles["./debug/index.ts"] ?? "").toMatch(/\bregisterDebugWindowParameters\b/);
  });

  it("removes the unused legacy GizmoDebugPanel surface", () => {
    expect(findForbiddenSourceMatches(/\bGizmoDebugPanel\b|gizmo-debug-panel/)).toEqual([]);
  });

  it("keeps floating window content components behind the host interface", () => {
    const contentFiles = [
      "./debug/components/debug-log-content-component.ts",
      "./hierarchy/hierarchy-panel-component.ts"
    ];
    const violations = contentFiles
      .filter((file) => /\b(?:rootElement|contentElement)\b/.test(sourceFiles[file] ?? ""))
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps hierarchy pointer selection on the gizmo path instead of DOM click mutation", () => {
    const source = sourceFiles["./hierarchy/hierarchy-panel-component.ts"] ?? "";

    expect(source).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(source).not.toMatch(/\.onclick\s*=/);
    expect(source).toMatch(/hitTestInput/);
    expect(source).toMatch(/onInputEnd/);
    expect(source).toMatch(/submitSelection\s*\([^)]*["']keyboard["']/);
  });

  it("keeps production hierarchy rows actor-backed instead of static app lists", () => {
    const allowedFiles = new Set([
      "./hierarchy/hierarchy-object-source.ts"
    ]);
    const staticSourceCallViolations = Object.entries(sourceFiles)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts") &&
        !allowedFiles.has(file)
      ))
      .filter(([, source]) => /\bcreateStaticHierarchyObjectSource\s*\(/.test(source))
      .map(([file]) => file)
      .sort();
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";

    expect(staticSourceCallViolations).toEqual([]);
    expect(appSource).toMatch(/\bcreateActorHierarchyObjectSource\b/);
    expect(appSource).toMatch(/\bSCENE_WINDOW_ACTOR_ID\b/);
    expect(appSource).toMatch(/\bHIERARCHY_PANEL_ACTOR_ID\b/);
  });

  it("keeps migrated window and hierarchy input off legacy GizmoResponder", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./window-runtime/") || file.startsWith("./hierarchy/"))
      .filter(([, source]) => (
        /\bGizmoResponder\b/.test(source) ||
        /\bhitTestGizmo\b/.test(source) ||
        /\bonGizmo(?:Start|Move|End|Cancel|Click|DoubleClick)\b/.test(source) ||
        /\bgizmoPriority\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("removes the legacy GizmoResponder adapter from production code", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts")
      ))
      .filter(([, source]) => (
        /\bGizmoResponder\b/.test(source) ||
        /\bisGizmoResponder\b/.test(source) ||
        /\bhitTestGizmo\b/.test(source) ||
        /\bgizmoPriority\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });


  it("keeps window and hierarchy definitions out of core installer", () => {
    const source = sourceFiles["./component-definitions.ts"] ?? "";
    const coreBody = /export function installCoreComponentDefinitions[\s\S]*?\n}/.exec(source)?.[0] ?? "";

    expect(coreBody).not.toMatch(/floatingWindowComponentDefinition/);
    expect(coreBody).not.toMatch(/hierarchyPanelComponentDefinition/);
    expect(coreBody).not.toMatch(/sceneViewportComponentDefinition/);
  });

  it("keeps scene feature components independent from app-runtime", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./features/scene/"))
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => /from\s+["'](?:\.\.\/)+app-runtime(?:\/index)?["']/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps app composition from owning the WebGL renderer canvas directly", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const sceneFeatureInstallerSource = sourceFiles["./features/scene/install-scene-view-feature.ts"] ?? "";
    const sceneViewInstallerSource = sourceFiles["./features/scene/scene-view-content-installer.ts"] ?? "";
    const renderableSceneViewSource = sourceFiles["./features/scene/renderable-scene-view.ts"] ?? "";

    expect(appSource).not.toMatch(/\bnew\s+THREE\.WebGLRenderer\b/);
    expect(appSource).not.toMatch(/replaceChildren\s*\(\s*renderer\.domElement\s*\)/);
    expect(appSource).not.toMatch(/\bnew\s+SceneViewRuntime\b/);
    expect(appSource).toMatch(/\binstallSceneViewFeature\b/);
    expect(appSource).not.toMatch(/\binstallSceneViewContent\b/);
    expect(appSource).not.toMatch(/\bcreateRenderableSceneView\b/);
    expect(appSource).not.toMatch(/\bCurrentRenderableSceneViewRegistry\b/);
    expect(appSource).toMatch(/sceneFeature\.renderableSceneViews\.current\?\.render\(\)/);
    expect(appSource).not.toMatch(/\bCurrentSceneViewSource\b|\bcurrentSceneView\b|\bSceneViewRuntime\b/);
    expect(appSource).not.toMatch(/\bcreateSceneWindowActor\b/);
    expect(appSource).not.toMatch(/sceneWindow\.viewport\.render/);
    expect(appSource).not.toMatch(/sceneView\.viewport\.render/);
    expect(renderableSceneViewSource).toMatch(/\binterface RenderableSceneView\b/);
    expect(renderableSceneViewSource).toMatch(/\bisRenderable\s*\(\)\s*:\s*boolean/);
    expect(renderableSceneViewSource).toMatch(/\brender\s*\(\)\s*:\s*void/);
    expect(renderableSceneViewSource).not.toMatch(/\bdispose/);
    expect(sceneFeatureInstallerSource).toMatch(/\binstallSceneViewContent\b/);
    expect(sceneFeatureInstallerSource).toMatch(/\bcreateRenderableSceneView\b/);
    expect(sceneFeatureInstallerSource).toMatch(/\bCurrentRenderableSceneViewRegistry\b/);
    expect(sceneViewInstallerSource).toMatch(/\bcreateSceneWindowActor\b/);
    expect(sceneViewInstallerSource).toMatch(/\bcreateSceneViewActor\b/);
    expect(renderableSceneViewSource).toMatch(/sceneView\.viewport\.render/);
  });

  it("guards Scene viewport rendering behind current view ownership and active state", () => {
    const renderableSceneViewSource = sourceFiles["./features/scene/renderable-scene-view.ts"] ?? "";

    expect(renderableSceneViewSource).toMatch(/\bisRenderable\s*\(\)\s*{/);
    expect(renderableSceneViewSource).not.toMatch(/sceneWindow\.window\.state\.visible/);
    expect(renderableSceneViewSource).toMatch(/locations\.getLocationByViewActorId/);
    expect(renderableSceneViewSource).toMatch(/location\.ownerFrameVisible/);
    expect(renderableSceneViewSource).toMatch(/location\.visibleInFrame/);
    expect(renderableSceneViewSource).toMatch(/actorSystem\.isActorActive\s*\(\s*options\.sceneView\.viewport\.actor\s*\)/);
    expect(renderableSceneViewSource).toMatch(/sceneView\.viewport\.render\(options\.camera3Motion\.activeCamera\)/);
  });

  it("keeps Camera3 rig, motion, and viewport subscriptions in components", () => {
    const sceneViewInstallerSource = sourceFiles["./features/scene/scene-view-content-installer.ts"] ?? "";
    const camera3ComponentsSource = sourceFiles["./features/camera3/components/index.ts"] ?? "";
    const camera3BindingSource =
      sourceFiles["./features/camera3/components/scene-camera3-viewport-binding-component.ts"] ?? "";
    const camera3MotionDefinitionSource =
      sourceFiles["./features/camera3/components/camera3-motion-definition.ts"] ?? "";
    const appInstallSource = sourceFiles["./app/install-component-definitions.ts"] ?? "";

    expect(sceneViewInstallerSource).not.toMatch(/\bnew\s+Camera3MotionController\b/);
    expect(sceneViewInstallerSource).not.toMatch(/\bnew\s+Camera3Rig\b/);
    expect(sceneViewInstallerSource).not.toMatch(/\bnew\s+Camera3ProjectionModeController\b/);
    expect(sceneViewInstallerSource).not.toMatch(/subscribeResize\s*\(/);
    expect(sceneViewInstallerSource).not.toMatch(/onCamera3MotionChanged/);
    expect(sceneViewInstallerSource).toMatch(/\bcamera3RigComponentType\b/);
    expect(sceneViewInstallerSource).toMatch(/\bcamera3MotionComponentType\b/);
    expect(sceneViewInstallerSource).toMatch(/\bsceneCamera3ViewportBindingComponentType\b/);
    expect(camera3ComponentsSource).toMatch(/\bCamera3RigComponent\b/);
    expect(camera3ComponentsSource).toMatch(/\bCamera3MotionComponent\b/);
    expect(camera3ComponentsSource).toMatch(/\bSceneCamera3ViewportBindingComponent\b/);
    expect(camera3BindingSource).toMatch(/subscribeResize\s*\(/);
    expect(camera3BindingSource).toMatch(/onCamera3MotionChanged/);
    expect(camera3MotionDefinitionSource).not.toMatch(/\bruntime-object\b/);
    expect(camera3MotionDefinitionSource).toMatch(/\brequires:\s*\[\s*{/);
    expect(camera3MotionDefinitionSource).toMatch(/\bcamera3RigComponentType\b/);
    expect(appInstallSource).toMatch(/installSceneComponentDefinitions[\s\S]*installCamera3FeatureComponentDefinitions/);
  });

  it("keeps Camera3 UI controls on actor input instead of DOM click handlers", () => {
    const camera3GizmoSource = sourceFiles["./gizmos/camera3/camera3-gizmo.ts"] ?? "";
    const camera3ComponentSource = sourceFiles["./gizmos/camera3/components/camera3-gizmo-component.ts"] ?? "";

    expect(camera3GizmoSource).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(camera3GizmoSource).not.toMatch(/\.onclick\s*=/);
    expect(camera3GizmoSource).toMatch(/projection-mode/);
    expect(camera3ComponentSource).toMatch(/\bonInputClick\b/);
  });

  it("keeps Scene view content installation transactional", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const sceneViewInstallerSource = sourceFiles["./features/scene/scene-view-content-installer.ts"] ?? "";

    expect(appSource).not.toMatch(/registerLegacyRuntimeObject\s*\(\s*content\.camera3Motion\s*\)/);
    expect(appSource).not.toMatch(/motionRegistration\?\.dispose\s*\(\s*\)/);
    expect(appSource).not.toMatch(/content\.camera3Motion\.dispose\s*\(\s*\)/);
    expect(sceneViewInstallerSource).toMatch(/\btry\s*{/);
    expect(sceneViewInstallerSource).toMatch(/\bcatch\s*\(\s*error\s*\)/);
    expect(sceneViewInstallerSource).toMatch(/\(sceneWindow\s*\?\?\s*sceneView\)\?\.dispose\s*\(\s*\)/);
    expect(sceneViewInstallerSource).not.toMatch(/\bregisterLegacyRuntimeObject\b/);
    expect(sceneViewInstallerSource).not.toMatch(/\brender\s*\(\)\s*:/);
    expect(sceneViewInstallerSource).not.toMatch(/\bmeasureNow\s*\(\)\s*:/);
  });

  it("parents the Camera3 actor gizmo inside the Scene viewport overlay", () => {
    const sceneViewInstallerSource = sourceFiles["./features/scene/scene-view-content-installer.ts"] ?? "";
    const camera3Styles = readSourceFile("./gizmos/camera3/camera3-gizmo.css");
    const camera3ActorCall = /createCamera3GizmoActor\s*\(\s*context\s*,\s*{[\s\S]*?parentActor:\s*sceneView\.viewport\.actor[\s\S]*?}/
      .exec(sceneViewInstallerSource)?.[0] ?? "";

    expect(camera3ActorCall).toMatch(/parent:\s*sceneView\.viewport\.overlayElement/);
    expect(camera3ActorCall).toMatch(/parentActor:\s*sceneView\.viewport\.actor/);
    expect(camera3ActorCall).not.toMatch(/parent:\s*mount/);
    expect(camera3Styles).toMatch(/\.scene-window__overlay\s+\.camera3-gizmo\s*{[\s\S]*position:\s*absolute/);
  });

  it("keeps the Scene window recoverable through ordinary Window menu control", () => {
    const sceneWindowFactory = sourceFiles["./features/scene/scene-window-actor-factory.ts"] ?? "";
    const appMenuActorFactory = sourceFiles["./features/app-menu/app-menu-bar-actor-factory.ts"] ?? "";

    expect(sceneWindowFactory).not.toMatch(/windowMenu:\s*{\s*include:\s*false/);
    expect(sceneWindowFactory).toMatch(/activationMode:\s*["']visible["']/);
    expect(sceneWindowFactory).toMatch(/order:\s*0/);
    expect(appMenuActorFactory).not.toMatch(/\bfloatingWindowComponentType\b/);
  });

  it("composes the window workspace through a feature installer", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const appRuntimeSource = sourceFiles["./app-runtime/app-runtime-context.ts"] ?? "";
    const workspaceInstallerSource =
      sourceFiles["./features/window-workspace/install-window-workspace-feature.ts"] ?? "";

    expect(appSource).toMatch(/\bcreateActorWindowFocusServiceProxy\b/);
    expect(appSource).toMatch(/\binstallWindowWorkspaceFeature\b/);
    expect(appSource).not.toMatch(/\bnew\s+(WindowWorkspaceController|WindowViewFactoryRegistry|WindowDockPreviewController|WindowWorkspacePresentationController)\b/);
    expect(appSource).not.toMatch(/\bnew\s+WindowFramePortRegistry\b/);
    expect(appSource).not.toMatch(/\bcreateDockTargetRegionSource\b/);
    expect(workspaceInstallerSource).toMatch(/\bnew\s+WindowWorkspaceController\b/);
    expect(workspaceInstallerSource).toMatch(/actorWindowFocus\.bind\s*\(\s*workspaceController\s*\)/);
    expect(appSource).toMatch(/actorWindowFocus\.dispose\s*\(\s*\)/);
    expect(appRuntimeSource).toMatch(/\bactorWindowFocus:\s*options\.actorWindowFocus\b/);
  });

  it("keeps run-mode fullscreen on the workspace presentation session path", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const workspaceModeSource = sourceFiles["./app/workspace-mode.ts"] ?? "";
    const workspaceModeConstruction = /new\s+WorkspaceModeController\s*\(\s*{[\s\S]*?\n  }\);/
      .exec(appSource)?.[0] ?? "";

    expect(appSource).not.toMatch(/\bnew\s+WindowWorkspacePresentationController\b/);
    expect(workspaceModeConstruction).toMatch(/\bworkspacePresentation:\s*windowWorkspace\.presentationController\b/);
    expect(workspaceModeConstruction).not.toMatch(/sceneParameterPaths\.(?:debugWindow|hierarchyWindow)/);
    expect(workspaceModeSource).toMatch(/\benterRunFullscreenForView\b/);
    expect(workspaceModeSource).toMatch(/\bexitRunFullscreen\b/);
  });

  it("keeps actor-local input route scores out of gizmo-core hit priority", () => {
    const bindingSource = sourceFiles["./gizmo-runtime/gizmo-event-binding-component.ts"] ?? "";
    const routerSource = sourceFiles["./gizmo-runtime/actor-input-router.ts"] ?? "";

    expect(bindingSource).not.toMatch(/priority:\s*selection\.routeScore\b/);
    expect(bindingSource).toMatch(/priority:\s*selection\.scopeRouteScore\b/);
    expect(routerSource).toMatch(/\bscopeRouteScore\b/);
    expect(routerSource).toMatch(/\bgetActorInputScopeRoutePriority\b/);
  });

  it("keeps pointer active interaction policy in gizmo-core instead of app-level fallbacks", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";

    expect(appSource).not.toMatch(/\bbuttonsReleasedFallback\b/);
  });

  it("keeps feature definition installation owned by features and composed by app", () => {
    const coreSource = sourceFiles["./component-definitions.ts"] ?? "";
    const appInstallerSource = sourceFiles["./app/install-component-definitions.ts"] ?? "";

    expect(coreSource).not.toMatch(/(?:camera3Gizmo|debugLogContent|hierarchyPanel|floatingWindow|tesseract4)ComponentDefinition/);
    expect(coreSource).not.toMatch(/install(?:Camera3|DebugLog|Hierarchy|Window|Tesseract4)ComponentDefinitions/);
    expect(appInstallerSource).toMatch(/\binstallWallpaperComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallCoreComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallWindowComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallAppMenuComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallSceneComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallCamera3ComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallDebugLogComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallHierarchyComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallTesseract4ComponentDefinitions\b/);
  });

  it("keeps feature styles colocated and imported from the app style manifest", () => {
    const appRootStyles = readSourceFile("./style.css");
    const floatingWindowStyles = readSourceFile("./window-runtime/floating-window.css");
    const debugLogStyles = readSourceFile("./debug/debug-log.css");
    const hierarchyStyles = readSourceFile("./hierarchy/hierarchy.css");
    const camera3GizmoStyles = readSourceFile("./gizmos/camera3/camera3-gizmo.css");
    const sceneWindowStyles = readSourceFile("./features/scene/scene-window.css");
    const appMenuStyles = readSourceFile("./features/app-menu/app-menu.css");
    const appShellStyles = readSourceFile("./app/app-shell.css");
    const appStyleManifestSource = sourceFiles["./app/styles.ts"] ?? "";

    expect(appRootStyles).not.toMatch(/floating-gizmo-window|debug-log-window|hierarchy-panel|camera3-gizmo|scene-window|app-menu-bar/);
    expect(appShellStyles).toMatch(/app-shell/);
    expect(appShellStyles).not.toMatch(/floating-gizmo-window|debug-log-window|hierarchy-panel|camera3-gizmo|scene-window|app-menu-bar/);
    expect(floatingWindowStyles).toMatch(/floating-gizmo-window/);
    expect(debugLogStyles).toMatch(/debug-log-window/);
    expect(hierarchyStyles).toMatch(/hierarchy-panel/);
    expect(camera3GizmoStyles).toMatch(/camera3-gizmo/);
    expect(sceneWindowStyles).toMatch(/scene-window/);
    expect(appMenuStyles).toMatch(/app-menu-bar/);
    expect(appStyleManifestSource).toMatch(/["']\.\.\/style\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']\.\/app-shell\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']\.\.\/features\/app-menu\/app-menu\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']\.\.\/window-runtime\/floating-window\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']\.\.\/features\/scene\/scene-window\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']\.\.\/debug\/debug-log\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']\.\.\/hierarchy\/hierarchy\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']\.\.\/gizmos\/camera3\/camera3-gizmo\.css["']/);
  });

  it("keeps App Menu routed through actor input and state observer bindings", () => {
    const componentSource = sourceFiles["./features/app-menu/app-menu-bar-component.ts"] ?? "";
    const definitionSource = sourceFiles["./features/app-menu/app-menu-bar-definition.ts"] ?? "";
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";

    expect(appSource).toMatch(/\binstallAppMenuFeature\b/);
    expect(appSource).not.toMatch(/\bcreateAppMenuBarActor\b/);
    expect(componentSource).toMatch(/\bhitTestInput\b/);
    expect(componentSource).toMatch(/\bonInputEnd\b/);
    expect(componentSource).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(componentSource).not.toMatch(/document\.addEventListener\s*\(\s*["']click["']/);
    expect(componentSource).not.toMatch(/\.onclick\s*=/);
    expect(componentSource).toMatch(/\bmenu-dismiss\b/);
    expect(componentSource).toMatch(/activateOpenViewRow\(row,\s*event\.timeStamp\)/);
    expect(componentSource).toMatch(/requestOpenView\(row\.viewKey,\s*["']menu["']\)/);
    expect(componentSource).not.toMatch(/requestOpenView\([^)]*actorId/);
    expect(definitionSource).toMatch(/\bgizmoEventBindingComponentType\b/);
    expect(definitionSource).toMatch(/\bstateObserverBindingComponentType\b/);
  });

  it("keeps tab-local window actions on actor input lifecycle intents", () => {
    const floatingWindowSource = sourceFiles["./window-runtime/floating-window-component.ts"] ?? "";
    const tabActionSource = sourceFiles["./window-runtime/window-tab-action.ts"] ?? "";

    expect(floatingWindowSource).toMatch(/partId\s*===\s*["']window-tab-action["']/);
    expect(floatingWindowSource).toMatch(/requestCloseView\(event\.hit\.data\.viewActorId,\s*["']tab-action["'],\s*\{/);
    expect(floatingWindowSource).toMatch(/ownerFrameId:\s*this\.#frameId/);
    expect(floatingWindowSource).toMatch(/viewKey:\s*event\.hit\.data\.viewKey/);
    expect(floatingWindowSource).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(floatingWindowSource).not.toMatch(/\.onclick\s*=/);
    expect(tabActionSource).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(tabActionSource).not.toMatch(/\.onclick\s*=/);
    expect(tabActionSource).not.toMatch(/\brequestCloseFrame\b|\bcloseFrame\b/);
  });

  it("keeps dock surface behavior in the shared frame surface component", () => {
    const floatingWindowSource = sourceFiles["./window-runtime/floating-window-component.ts"] ?? "";
    const rootFrameSource = sourceFiles["./window-runtime/workspace-root-dock-frame-component.ts"] ?? "";
    const floatingDefinitionSource = sourceFiles["./window-runtime/floating-window-definition.ts"] ?? "";
    const rootDefinitionSource = sourceFiles["./window-runtime/workspace-root-dock-frame-definition.ts"] ?? "";
    const installSource = sourceFiles["./window-runtime/install-component-definitions.ts"] ?? "";
    const surfaceSource = sourceFiles["./window-runtime/window-frame-surface-component.ts"] ?? "";

    expect(surfaceSource).toMatch(/\bWindowDockSurfaceModel\b/);
    expect(surfaceSource).toMatch(/\brenderWindowFrameTabsetTabs\b/);
    expect(surfaceSource).toMatch(/\bcreateWindowContentAttachment\b/);
    expect(floatingWindowSource).not.toMatch(/\bWindowDockSurfaceModel\b/);
    expect(rootFrameSource).not.toMatch(/\bWindowDockSurfaceModel\b/);
    expect(floatingWindowSource).not.toMatch(/#contentAttachments|#tabElementsByViewActorId|renderTabsetTabs|renderSplitNode/);
    expect(rootFrameSource).not.toMatch(/#contentAttachments|#tabElementsByViewActorId|renderTabsetTabs|renderSplitNode/);
    expect(floatingWindowSource).not.toMatch(/new\s+WindowFrameSurfaceComponent/);
    expect(rootFrameSource).not.toMatch(/new\s+WindowFrameSurfaceComponent/);
    expect(floatingWindowSource).not.toMatch(/#surface\.dispose\(/);
    expect(rootFrameSource).not.toMatch(/#surface\.dispose\(/);
    expect(floatingDefinitionSource).toMatch(/\bwindowFrameSurfaceComponentType\b/);
    expect(rootDefinitionSource).toMatch(/\bwindowFrameSurfaceComponentType\b/);
    expect(installSource).toMatch(/windowFrameSurfaceComponentDefinition[\s\S]*floatingWindowComponentDefinition/);
    expect(installSource).toMatch(/windowFrameSurfaceComponentDefinition[\s\S]*workspaceRootDockFrameComponentDefinition/);
  });

  it("keeps the window workspace catalog as a read-only projection", () => {
    const catalogSource = sourceFiles["./window-runtime/window-workspace-view-catalog.ts"] ?? "";
    const controllerSource = sourceFiles["./window-runtime/window-workspace-controller.ts"] ?? "";
    const priorityPortSource = sourceFiles["./window-runtime/window-workspace-stack-priority-port.ts"] ?? "";

    expect(catalogSource).not.toMatch(/\bsetStackPriority\b/);
    expect(controllerSource).toMatch(/\bWindowWorkspaceStackPriorityPort\b/);
    expect(priorityPortSource).toMatch(/\bsetFrameStackPriority\b/);
  });

  it("keeps App Menu model as a feature-level adapter over window runtime facts", () => {
    const appMenuModelSource = sourceFiles["./features/app-menu/app-menu-model.ts"] ?? "";
    const windowRuntimeViolations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./window-runtime/"))
      .filter(([, source]) => /features\/app-menu/.test(source))
      .map(([file]) => file)
      .sort();

    expect(appMenuModelSource).toMatch(/from\s+["']\.\.\/\.\.\/window-runtime["']/);
    expect(appMenuModelSource).toMatch(/\bkind:\s*["']open-view["']/);
    expect(appMenuModelSource).toMatch(/\bviewKey\b/);
    expect(appMenuModelSource).toMatch(/\bWindowWorkspaceViewEntry\b/);
    expect(appMenuModelSource).not.toMatch(/\bdata\s*\?:\s*unknown\b/);
    expect(windowRuntimeViolations).toEqual([]);
  });

  it("keeps old window source and visible-activation adapters deleted", () => {
    expect(sourceFiles["./window-runtime/window-control-source.ts"]).toBeUndefined();
    expect(sourceFiles["./window-runtime/window-menu-view-source.ts"]).toBeUndefined();
    expect(sourceFiles["./window-runtime/window-visibility-activation-controller.ts"]).toBeUndefined();
  });

  it("keeps window view factories limited to view runtime creation", () => {
    const factoryRegistrySource = sourceFiles["./window-runtime/window-view-factory-registry.ts"] ?? "";
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";

    expect(factoryRegistrySource).not.toMatch(/\bWindowViewFactoryResult\b/);
    expect(factoryRegistrySource).not.toMatch(/\bcreate\s*\(\s*options:\s*WindowViewFactoryCreateOptions/);
    expect(factoryRegistrySource).not.toMatch(/\bdispose\?\s*\(/);
    expect(factoryRegistrySource).toMatch(/\bcreateViewRuntime\s*\(/);
    expect(appSource).not.toMatch(/\bcreateDebugLogWindowActor\b/);
    expect(appSource).not.toMatch(/\bcreateDebugLogViewActor\b/);
    expect(appSource).not.toMatch(/\bcreateHierarchyPanelActor\b/);
    expect(appSource).not.toMatch(/\bcreateHierarchyPanelViewActor\b/);
    expect(appSource).toMatch(/\binstallToolWindowFeatures\b/);
  });

  it("keeps window runtime independent from feature implementations", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./window-runtime/"))
      .filter(([, source]) => /from\s+["'](?:\.\.\/)+features\//.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps WindowWorkspaceController generic instead of importing concrete window features", () => {
    const controllerSource = sourceFiles["./window-runtime/window-workspace-controller.ts"] ?? "";

    expect(controllerSource).not.toMatch(/debug-log-window-actor-factory|hierarchy-panel-actor-factory/);
    expect(controllerSource).not.toMatch(/scene-window-actor-factory|createSceneWindowActor/);
    expect(controllerSource).not.toMatch(/from\s+["'](?:\.\.\/)+(?:debug|hierarchy|features\/scene|gizmos\/camera3)/);
  });

  it("keeps FloatingWindowComponent independent from app-runtime", () => {
    const source = sourceFiles["./window-runtime/floating-window-component.ts"] ?? "";

    expect(source).not.toMatch(/from\s+["'](?:\.\.\/)+app-runtime(?:\/index)?["']/);
    expect(source).not.toMatch(/\bAppRuntimeContext\b/);
  });

  it("keeps frame lifecycle mutation behind window-runtime intent ports", () => {
    const lifecycleSource = sourceFiles["./window-runtime/window-frame-lifecycle.ts"] ?? "";
    const controllerSource = sourceFiles["./window-runtime/window-frame-lifecycle-controller.ts"] ?? "";
    const factoryRegistrySource = sourceFiles["./window-runtime/window-view-factory-registry.ts"] ?? "";
    const floatingWindowSource = sourceFiles["./window-runtime/floating-window-component.ts"] ?? "";

    expect(lifecycleSource).toMatch(/\binterface\s+WindowFrameLifecycleController\b/);
    expect(lifecycleSource).toMatch(/\binterface\s+WindowFrameIntentSink\b/);
    expect(controllerSource).toMatch(/\bdestroyActor\b/);
    expect(controllerSource).toMatch(/\bsetParent\b/);
    expect(lifecycleSource).not.toMatch(/\bmoveViewToFrame\b/);
    expect(lifecycleSource).not.toMatch(/\bfloatView\b/);
    expect(controllerSource).not.toMatch(/debug-log-window|hierarchy-panel|scene-window|createSceneWindowActor/);
    expect(factoryRegistrySource).not.toMatch(/addEventListener\s*\(\s*["']click["']|\.onclick\s*=/);
    expect(factoryRegistrySource).not.toMatch(/from\s+["'](?:\.\.\/)+(?:debug|hierarchy|features\/scene)/);
    expect(floatingWindowSource).not.toMatch(/\.(?:createActor|destroyActor|setParent)\s*\(/);
    expect(floatingWindowSource).not.toMatch(/\bActorSystem\b/);
  });

  it("keeps persisted window frame layout keyed by logical view identity", () => {
    const persistenceSource = sourceFiles["./window-runtime/window-workspace-layout-persistence.ts"] ?? "";
    const persistenceControllerSource =
      sourceFiles["./window-runtime/window-workspace-layout-persistence-controller.ts"] ?? "";
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";

    expect(persistenceSource).toMatch(/\bviewKey:\s*WindowViewKey\b/);
    expect(persistenceSource).not.toMatch(/\bviewActorId\b/);
    expect(persistenceSource).not.toMatch(/\bframeActorId\b/);
    expect(persistenceSource).not.toMatch(/\bFloatingWindowComponent\b/);
    expect(persistenceSource).not.toMatch(/\bSceneViewRuntime\b/);
    expect(persistenceControllerSource).toMatch(/\bWindowFrameLayoutSnapshotSource\b/);
    expect(persistenceControllerSource).not.toMatch(/\bActorSystem\b/);
    expect(persistenceControllerSource).not.toMatch(/\bFloatingWindowComponent\b/);
    expect(appSource).not.toMatch(/\bloadPersistedWindowWorkspaceFrameLayout\b/);
    expect(appSource).not.toMatch(/\brestoreFrameLayout\b/);
  });

  it("removes the actor-id workspace layout compatibility API from production code", () => {
    const oldLayoutApi =
      /\b(?:WindowWorkspaceLayout|createWindowWorkspaceLayout|dockWindowAsTab|findDockTabsetContaining|normalizeWindowWorkspaceLayout|removeWindowFromDock|removeWindowFromLayout|setActiveDockTab|splitDockTab|undockWindow)\b/;
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts")
      ))
      .filter(([, source]) => oldLayoutApi.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps live window view tracking keyed by view identity instead of only view key", () => {
    const controllerSource = sourceFiles["./window-runtime/window-frame-lifecycle-controller.ts"] ?? "";
    const factoryRegistrySource = sourceFiles["./window-runtime/window-view-factory-registry.ts"] ?? "";

    expect(controllerSource).toMatch(/\bcreateWindowViewIdentityKey\b/);
    expect(controllerSource).not.toMatch(/new\s+Map\s*<\s*WindowViewKey\s*,\s*LiveWindowView\s*>/);
    expect(factoryRegistrySource).toMatch(/\bidentity:\s*getWindowViewFactoryIdentity\b/);
  });

  it("keeps feature window content components on the narrow WindowContentHost port", () => {
    const contentFiles = [
      "./debug/components/debug-log-content-component.ts",
      "./hierarchy/hierarchy-panel-component.ts"
    ];

    for (const file of contentFiles) {
      const source = sourceFiles[file] ?? "";
      expect(source).toMatch(/\bWindowContentHost\b/);
      expect(source).toMatch(/\bWindowContentAttachment\b/);
      expect(source).not.toMatch(/\bFloatingWindowHost\b/);
      expect(source).not.toMatch(/\bFloatingWindowContentAttachment\b/);
    }
  });

  it("keeps future dock layout model pure and DOM-free", () => {
    const pureWindowLayoutFiles = new Set([
      "./window-runtime/window-frame-dock-tree.ts",
      "./window-runtime/window-workspace-layout.ts",
      "./window-runtime/window-dock-targets.ts",
      "./window-runtime/window-tab-drag-session.ts"
    ]);
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => pureWindowLayoutFiles.has(file))
      .filter(([, source]) => (
        /\b(?:HTMLElement|HTMLDivElement|Document|Element|getBoundingClientRect|querySelector)\b/.test(source) ||
        /from\s+["'](?:gizmo-core|three)["']/.test(source)
      ))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps the window frame dock tree model internal to window-runtime", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts") &&
        !file.startsWith("./window-runtime/")
      ))
      .filter(([, source]) => /from\s+["'][^"']*window-frame-dock-tree["']/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps dock target production API region-first", () => {
    const legacyDockTargetNames =
      /\b(?:WindowDockTargetFrame|DockTargetFrameSource|DockTargetFrameSourceOptions|createDockTargetFrameSource|listDockTargetFrames)\b/;
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts")
      ))
      .filter(([, source]) => legacyDockTargetNames.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps future dock tab input on actor input instead of DOM click handlers", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./window-runtime/") && /dock/i.test(file) && !file.endsWith(".test.ts"))
      .filter(([, source]) => /addEventListener\s*\(\s*["']click["']|\.onclick\s*=/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps App Menu production code free of static business window ids", () => {
    const forbiddenBusinessWindowIds = /["'](?:scene-window|debug-log-window|hierarchy-panel)["']/;
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./features/app-menu/"))
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => forbiddenBusinessWindowIds.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps ActorImpl imports inside actor-runtime internals", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => file !== "./architecture-boundaries.test.ts" && !file.startsWith("./actor-runtime/"))
      .filter(([, source]) => /\bActorImpl\b/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps actor-runtime independent from app-runtime", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./actor-runtime/"))
      .filter(([, source]) => /from\s+["'](?:\.\.\/)+app-runtime(?:\/index)?["']/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps actor-runtime focus service as a narrow port independent from window-runtime", () => {
    const actorRuntimeWindowImports = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./actor-runtime/"))
      .filter(([, source]) => /from\s+["'](?:\.\.\/)+window-runtime/.test(source))
      .map(([file]) => file)
      .sort();
    const componentSource = sourceFiles["./actor-runtime/component.ts"] ?? "";

    expect(actorRuntimeWindowImports).toEqual([]);
    expect(componentSource).toMatch(/\binterface\s+ActorWindowFocusService\b/);
    expect(componentSource).not.toMatch(/\bFloatingWindowComponent\b/);
    expect(componentSource).not.toMatch(/\bWindowWorkspaceController\b/);
  });

  it("keeps test-support out of production modules", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts") &&
        !file.startsWith("./test-support/")
      ))
      .filter(([, source]) => /from\s+["'][^"']*test-support/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps Camera3 control independent from Camera3 gizmo UI modules", () => {
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./camera3-control/"))
      .filter(([, source]) => /from\s+["'](?:\.\.\/)+gizmos\/camera3/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("removes the Camera3 legacy factory surface", () => {
    const normalIndex = sourceFiles["./gizmos/camera3/index.ts"] ?? "";
    const componentIndex = sourceFiles["./gizmos/camera3/components/index.ts"] ?? "";
    const componentSource = sourceFiles["./gizmos/camera3/components/camera3-gizmo-component.ts"] ?? "";
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts"
      ))
      .filter(([, source]) => (
        /from\s+["'][^"']*camera3-gizmo-factory["']/.test(source) ||
        /gizmos\/camera3\/legacy/.test(source)
      ))
      .map(([file]) => file)
      .sort();

    expect(normalIndex).not.toMatch(/\bcreateCamera3Gizmo\b/);
    expect(normalIndex).not.toMatch(/\bCamera3GizmoFactory\b/);
    expect(componentIndex).not.toMatch(/\bCamera3GizmoFactory\b/);
    expect(componentIndex).toMatch(/\bCamera3GizmoViewFactory\b/);
    expect(componentSource).not.toMatch(/\bCamera3GizmoFactory\b/);
    expect(componentSource).toMatch(/\bCamera3GizmoViewFactory\b/);
    expect(violations).toEqual([]);
  });

  it("keeps Camera3 actor component on ActorInputParticipant instead of legacy GizmoResponder", () => {
    const source = sourceFiles["./gizmos/camera3/components/camera3-gizmo-component.ts"] ?? "";

    expect(source).toMatch(/\bActorInputParticipant\b/);
    expect(source).toMatch(/\bhitTestInput\b/);
    expect(source).not.toMatch(/\bGizmoResponder\b/);
    expect(source).not.toMatch(/\bhitTestGizmo\b/);
    expect(source).not.toMatch(/\bgizmoPriority\b/);
    expect(source).not.toMatch(/^\s*onGizmo(?:Start|Move|End|Cancel|Click|DoubleClick)\b/m);
  });

  it("keeps feature actor factories on the narrow FeatureActorContext port", () => {
    const factoryFiles = [
      "./debug/components/debug-log-window-actor-factory.ts",
      "./hierarchy/hierarchy-panel-actor-factory.ts",
      "./gizmos/camera3/components/camera3-gizmo-actor-factory.ts",
      "./tesseract4/components/tesseract4-actor-factory.ts"
    ];
    const violations = factoryFiles
      .filter((file) => /\bAppRuntimeContext\b/.test(sourceFiles[file] ?? ""))
      .sort();

    expect(violations).toEqual([]);
    for (const file of factoryFiles) {
      expect(sourceFiles[file] ?? "").toMatch(/\bFeatureActorContext\b/);
    }
  });

  it("keeps actor component arrays private", () => {
    expect(findForbiddenSourceMatches(/\.components\b/)).toEqual([]);
  });

  it("keeps direct ActorSystem component mutation inside the registry bridge", () => {
    const allowedFiles = new Set([
      "./actor-runtime/actor-system.ts",
      "./actor-runtime/component-registry.ts"
    ]);

    expect(findForbiddenMethodCalls([
      "attachComponent",
      "detachComponent"
    ], allowedFiles)).toEqual([]);
  });
});

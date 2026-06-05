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
  it("keeps deprecated AppRuntimeContext registration calls limited to transitional files", () => {
    const allowedFiles = new Set([
      "./app-runtime/app-runtime-context.ts",
      "./app-runtime/app-runtime-context.test.ts",
      "./app/create-wallpaper-app.ts",
      "./app/scene-view-runtime.ts",
      "./debug/legacy/debug-log-window-factory.ts",
      "./gizmos/camera3/legacy/camera3-gizmo-factory.ts"
    ]);

    expect(findForbiddenMethodCalls([
      "registerLegacyRuntimeObject",
      "registerLegacyGizmoObject",
      "registerLegacyStatefulGizmoObject"
    ], allowedFiles)).toEqual([]);
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

  it("keeps legacy DebugLogWindow imports out of the new component actor path", () => {
    const allowedFiles = new Set([
      "./debug/legacy/debug-log-window-factory.ts",
      "./debug/legacy/debug-log-window-factory.legacy.test.ts",
      "./debug/legacy/debug-log-window.legacy.test.ts",
      "./debug/legacy/index.ts"
    ]);

    expect(findForbiddenSourceMatches(
      /(?:from\s+["'](?:\.\/|\.\.\/)debug-log-window["'])|(?:new\s+DebugLogWindow\s*\()/,
      allowedFiles
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
      .filter(([, source]) => /from\s+["'](?:\.\.\/)+app-runtime(?:\/index)?["']/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps app composition from owning the WebGL renderer canvas directly", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const sceneViewRuntimeSource = sourceFiles["./app/scene-view-runtime.ts"] ?? "";

    expect(appSource).not.toMatch(/\bnew\s+THREE\.WebGLRenderer\b/);
    expect(appSource).not.toMatch(/replaceChildren\s*\(\s*renderer\.domElement\s*\)/);
    expect(appSource).toMatch(/\bnew\s+SceneViewRuntime\b/);
    expect(appSource).not.toMatch(/\bcreateSceneWindowActor\b/);
    expect(appSource).not.toMatch(/sceneWindow\.viewport\.render/);
    expect(sceneViewRuntimeSource).toMatch(/\bcreateSceneWindowActor\b/);
    expect(sceneViewRuntimeSource).toMatch(/sceneWindow\.viewport\.render/);
  });

  it("guards Scene viewport rendering behind current view ownership and active state", () => {
    const sceneViewRuntimeSource = sourceFiles["./app/scene-view-runtime.ts"] ?? "";

    expect(sceneViewRuntimeSource).toMatch(/\bisRenderable\s*\(\)\s*:\s*boolean/);
    expect(sceneViewRuntimeSource).not.toMatch(/sceneWindow\.window\.state\.visible/);
    expect(sceneViewRuntimeSource).toMatch(/viewLocationSource\.getLocationByViewActorId/);
    expect(sceneViewRuntimeSource).toMatch(/location\.ownerFrameVisible/);
    expect(sceneViewRuntimeSource).toMatch(/location\.visibleInFrame/);
    expect(sceneViewRuntimeSource).toMatch(/actorSystem\.isActorActive\s*\(\s*this\.sceneWindow\.viewport\.actor\s*\)/);
    expect(sceneViewRuntimeSource).toMatch(/if\s*\(\s*!\s*this\.isRenderable\(\)\s*\)\s*return;\s*\n\s*this\.sceneWindow\.viewport\.render/);
  });

  it("keeps SceneViewRuntime construction transactional", () => {
    const sceneViewRuntimeSource = sourceFiles["./app/scene-view-runtime.ts"] ?? "";

    expect(sceneViewRuntimeSource).toMatch(/\btry\s*{/);
    expect(sceneViewRuntimeSource).toMatch(/\bcatch\s*\(\s*error\s*\)/);
    expect(sceneViewRuntimeSource).toMatch(/\bdisposeSceneViewConstruction\b/);
    expect(sceneViewRuntimeSource).toMatch(/options\.sceneWindow\?\.dispose\s*\(\s*\)/);
    expect(sceneViewRuntimeSource).toMatch(/options\.motionRegistration\?\.dispose\s*\(\s*\)/);
  });

  it("parents the Camera3 actor gizmo inside the Scene viewport overlay", () => {
    const sceneViewRuntimeSource = sourceFiles["./app/scene-view-runtime.ts"] ?? "";
    const camera3Styles = readSourceFile("./gizmos/camera3/camera3-gizmo.css");
    const camera3ActorCall = /createCamera3GizmoActor\s*\(\s*context\s*,\s*{[\s\S]*?\n      },/
      .exec(sceneViewRuntimeSource)?.[0] ?? "";

    expect(camera3ActorCall).toMatch(/parent:\s*sceneWindow\.viewport\.overlayElement/);
    expect(camera3ActorCall).toMatch(/parentActor:\s*sceneWindow\.viewport\.actor/);
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

  it("composes the window workspace controller through app-level ports", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const appRuntimeSource = sourceFiles["./app-runtime/app-runtime-context.ts"] ?? "";

    expect(appSource).toMatch(/\bcreateActorWindowFocusServiceProxy\b/);
    expect(appSource).toMatch(/\bnew\s+WindowWorkspaceController\b/);
    expect(appSource).toMatch(/actorWindowFocus\.bind\s*\(\s*windowWorkspaceController\s*\)/);
    expect(appSource).toMatch(/actorWindowFocus\.dispose\s*\(\s*\)/);
    expect(appRuntimeSource).toMatch(/\bactorWindowFocus:\s*options\.actorWindowFocus\b/);
  });

  it("keeps actor-local input route scores out of gizmo-core hit priority", () => {
    const bindingSource = sourceFiles["./gizmo-runtime/gizmo-event-binding-component.ts"] ?? "";
    const routerSource = sourceFiles["./gizmo-runtime/actor-input-router.ts"] ?? "";

    expect(bindingSource).not.toMatch(/priority:\s*selection\.routeScore\b/);
    expect(bindingSource).toMatch(/priority:\s*selection\.scopeRouteScore\b/);
    expect(routerSource).toMatch(/\bscopeRouteScore\b/);
    expect(routerSource).toMatch(/\bgetActorInputScopeRoutePriority\b/);
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
    const appStyleManifestSource = sourceFiles["./app/styles.ts"] ?? "";

    expect(appRootStyles).not.toMatch(/floating-gizmo-window|debug-log-window|hierarchy-panel|camera3-gizmo|scene-window|app-menu-bar/);
    expect(floatingWindowStyles).toMatch(/floating-gizmo-window/);
    expect(debugLogStyles).toMatch(/debug-log-window/);
    expect(hierarchyStyles).toMatch(/hierarchy-panel/);
    expect(camera3GizmoStyles).toMatch(/camera3-gizmo/);
    expect(sceneWindowStyles).toMatch(/scene-window/);
    expect(appMenuStyles).toMatch(/app-menu-bar/);
    expect(appStyleManifestSource).toMatch(/["']\.\.\/style\.css["']/);
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

    expect(componentSource).toMatch(/\bhitTestInput\b/);
    expect(componentSource).toMatch(/\bonInputEnd\b/);
    expect(componentSource).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(componentSource).not.toMatch(/document\.addEventListener\s*\(\s*["']click["']/);
    expect(componentSource).not.toMatch(/\.onclick\s*=/);
    expect(componentSource).toMatch(/\bmenu-dismiss\b/);
    expect(componentSource).toMatch(/requestOpenView\(hitData\.viewKey,\s*["']menu["']\)/);
    expect(componentSource).not.toMatch(/requestOpenView\([^)]*actorId/);
    expect(definitionSource).toMatch(/\bgizmoEventBindingComponentType\b/);
    expect(definitionSource).toMatch(/\bstateObserverBindingComponentType\b/);
  });

  it("keeps App Menu model as a feature-level adapter over window runtime facts", () => {
    const appMenuModelSource = sourceFiles["./features/app-menu/app-menu-model.ts"] ?? "";
    const windowControlSource = sourceFiles["./window-runtime/window-control-source.ts"] ?? "";
    const windowRuntimeViolations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./window-runtime/"))
      .filter(([, source]) => /features\/app-menu/.test(source))
      .map(([file]) => file)
      .sort();

    expect(appMenuModelSource).toMatch(/from\s+["']\.\.\/\.\.\/window-runtime["']/);
    expect(appMenuModelSource).toMatch(/\bkind:\s*["']open-view["']/);
    expect(appMenuModelSource).toMatch(/\bviewKey\b/);
    expect(windowControlSource).toMatch(/\bfindWindowByViewKey\b/);
    expect(appMenuModelSource).not.toMatch(/\bdata\s*\?:\s*unknown\b/);
    expect(windowRuntimeViolations).toEqual([]);
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
    expect(appSource).toMatch(/\bloadPersistedWindowWorkspaceFrameLayout\b/);
    expect(appSource).toMatch(/\brestoreFrameLayout\b/);
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

  it("keeps dock target production API region-first outside compatibility aliases", () => {
    const allowedFiles = new Set([
      "./window-runtime/dock-target-frame-source.ts",
      "./window-runtime/window-dock-targets.ts"
    ]);
    const legacyDockTargetNames =
      /\b(?:WindowDockTargetFrame|DockTargetFrameSource|DockTargetFrameSourceOptions|createDockTargetFrameSource|listDockTargetFrames)\b/;
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts") &&
        !allowedFiles.has(file)
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

  it("keeps the Camera3 legacy factory behind the legacy entrypoint", () => {
    const normalIndex = sourceFiles["./gizmos/camera3/index.ts"] ?? "";
    const componentIndex = sourceFiles["./gizmos/camera3/components/index.ts"] ?? "";
    const componentSource = sourceFiles["./gizmos/camera3/components/camera3-gizmo-component.ts"] ?? "";
    const legacyIndex = sourceFiles["./gizmos/camera3/legacy/index.ts"] ?? "";
    const allowedFiles = new Set([
      "./gizmos/camera3/legacy/index.ts",
      "./gizmos/camera3/legacy/camera3-gizmo-factory.ts",
      "./gizmos/camera3/legacy/camera3-gizmo-factory.legacy.test.ts"
    ]);
    const violations = Object.entries(sourceFiles)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !allowedFiles.has(file)
      ))
      .filter(([, source]) => /from\s+["'][^"']*camera3-gizmo-factory["']/.test(source))
      .map(([file]) => file)
      .sort();

    expect(normalIndex).not.toMatch(/\bcreateCamera3Gizmo\b/);
    expect(normalIndex).not.toMatch(/\bCamera3GizmoFactory\b/);
    expect(componentIndex).not.toMatch(/\bCamera3GizmoFactory\b/);
    expect(componentIndex).toMatch(/\bCamera3GizmoViewFactory\b/);
    expect(componentSource).not.toMatch(/\bCamera3GizmoFactory\b/);
    expect(componentSource).toMatch(/\bCamera3GizmoViewFactory\b/);
    expect(legacyIndex).toMatch(/\bcreateCamera3Gizmo\b/);
    expect(legacyIndex).toMatch(/\bLegacyCamera3GizmoFactory\b/);
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

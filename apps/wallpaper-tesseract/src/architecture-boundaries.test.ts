import { describe, expect, it } from "vitest";
import {
  collectWorkspaceSourceFiles,
  createSourceZoneMap,
  evaluateZoneDependencyMatrix,
  findForbiddenMethodCalls,
  findForbiddenSourceMatches,
  listDynamicImports,
  listModuleEdges,
  parseStaticImports,
  readSourceFile,
  sourceFiles
} from "./test-support/architecture-boundaries";
import {
  projectPrismAppCompositionBlockers,
  projectPrismDebtBlockers,
  projectPrismPackageTargets,
  projectPrismRuntimeExtractionBlockers,
  projectPrismSourceZones,
  projectPrismUiFrameworkExtractionBlockers,
  projectPrismZoneDependencyRules
} from "./test-support/project-prism-boundary-facts";

describe("architecture boundaries", () => {
  const actorInputPackageSources = collectWorkspaceSourceFiles("packages/actor-input/src");
  const uiFrameworkPackageSources = collectWorkspaceSourceFiles("packages/ui-framework/src");
  const runtimeCorePackageSources = collectWorkspaceSourceFiles("packages/runtime-core/src");
  const runtimeThreePackageSources = collectWorkspaceSourceFiles("packages/runtime-three/src");

  it("parses static import and export-from edges for boundary checks", () => {
    const imports = parseStaticImports(`
      import "./side-effect";
      import type { Actor } from "./actor-runtime";
      import { componentType } from "./actor-runtime/component";
      export { WindowFramePort } from "./window-runtime";
      export type { SceneFrame } from "./scene-runtime";
    `);

    expect(imports).toContainEqual({
      specifier: "./side-effect",
      kind: "import",
      typeOnly: false,
      sideEffectOnly: true
    });
    expect(imports).toContainEqual({
      specifier: "./actor-runtime",
      kind: "import",
      typeOnly: true,
      sideEffectOnly: false
    });
    expect(imports).toContainEqual({
      specifier: "./window-runtime",
      kind: "export",
      typeOnly: false,
      sideEffectOnly: false
    });
    expect(imports).toContainEqual({
      specifier: "./scene-runtime",
      kind: "export",
      typeOnly: true,
      sideEffectOnly: false
    });
  });

  it("resolves relative barrel exports when building module edges", () => {
    const edges = listModuleEdges({
      "./feature/index.ts": 'export { value } from "./model";',
      "./feature/model.ts": "export const value = 1;"
    });

    expect(edges).toContainEqual({
      fromFile: "./feature/index.ts",
      specifier: "./model",
      resolvedFile: "./feature/model.ts",
      kind: "export",
      typeOnly: false,
      sideEffectOnly: false
    });
  });

  it("classifies every production source file into a Project Prism zone or explicit debt zone", () => {
    const zoneMap = createSourceZoneMap(sourceFiles, projectPrismSourceZones);

    expect(zoneMap.unclassified).toEqual([]);
    expect(zoneMap.ambiguousCandidateFiles).toEqual([]);
    expect(zoneMap.debtEntries.map((entry) => entry.file)).toEqual(expect.arrayContaining([
      "./scene-runtime/scene-runtime.ts",
      "./app-runtime/app-runtime-context.ts",
      "./app/create-wallpaper-app.ts",
      "./update-runtime/frame-update-attachment-runtime.ts",
      "./tesseract4/tesseract4-runtime-object.ts"
    ]));
  });

  it("keeps Project Prism debt zones paired with blocker and deletion facts", () => {
    const zoneMap = createSourceZoneMap(sourceFiles, projectPrismSourceZones);
    const actualDebtZoneIds = [...new Set(
      zoneMap.entries
        .flatMap((entry) => entry.zones)
        .filter((zone) => zone.debt === true)
        .map((zone) => zone.id)
    )].sort();
    const blockerZoneIds = projectPrismDebtBlockers.map((blocker) => blocker.zoneId).sort();

    expect(blockerZoneIds).toEqual(actualDebtZoneIds);
    for (const blocker of projectPrismDebtBlockers) {
      expect(blocker.blocks.length).toBeGreaterThan(0);
      expect(blocker.blocker.length).toBeGreaterThan(20);
      expect(blocker.deletionCondition.length).toBeGreaterThan(20);
    }
  });

  it("keeps Project Prism candidate dependencies from pointing at future higher-level zones", () => {
    expect(evaluateZoneDependencyMatrix(
      sourceFiles,
      projectPrismSourceZones,
      projectPrismZoneDependencyRules
    )).toEqual([]);
  });

  it("reports dynamic imports instead of silently ignoring them in boundary scans", () => {
    expect(listDynamicImports(sourceFiles)).toEqual([]);
  });

  it("keeps Project Prism actor-core candidate free of scene, gizmo, window, and DOM dependencies", () => {
    const zoneMap = createSourceZoneMap(sourceFiles, projectPrismSourceZones);
    const actorCoreCandidateFiles = new Set(
      zoneMap.entries
        .filter((entry) => entry.zones.some((zone) => zone.id === "actor-core-candidate"))
        .map((entry) => entry.file)
    );
    const forbiddenEdges = listModuleEdges(sourceFiles)
      .filter((edge) => actorCoreCandidateFiles.has(edge.fromFile))
      .filter((edge) => (
        edge.specifier === "gizmo-core" ||
        edge.specifier === "three" ||
        edge.specifier.includes("scene-runtime") ||
        edge.specifier.includes("window-runtime") ||
        edge.specifier.includes("app-runtime")
      ))
      .map((edge) => `${edge.fromFile}: ${edge.specifier}`);
    const forbiddenSymbols = [...actorCoreCandidateFiles]
      .filter((file) => /\b(?:HTMLElement|Document)\b/.test(sourceFiles[file] ?? ""))
      .sort();

    expect([...actorCoreCandidateFiles].sort()).toEqual([
      "./actor-runtime/index.ts"
    ]);
    expect(forbiddenEdges).toEqual([]);
    expect(forbiddenSymbols).toEqual([]);
  });

  it("keeps existing math/runtime foundation packages independent from app, editor, UI, and gizmo layers", () => {
    const packageSources = collectWorkspaceSourceFiles("packages");
    const productionPackageSources = Object.fromEntries(
      Object.entries(packageSources)
        .filter(([file]) => file.includes("/src/"))
    );
    const forbiddenAppLayerImports = listModuleEdges(productionPackageSources)
      .filter((edge) => (
        edge.specifier.includes("wallpaper-tesseract") ||
        edge.specifier.includes("window-runtime") ||
        edge.specifier.includes("features/app-menu") ||
        edge.specifier.includes("features/scene") ||
        /(?:^|\/)(?:debug|hierarchy)(?:\/|$)/.test(edge.specifier) ||
        edge.specifier.includes("gizmos")
      ))
      .map((edge) => `${edge.fromFile}: ${edge.specifier}`)
      .sort();
    const runtimeCorePackageViolations = Object.entries(productionPackageSources)
      .filter(([file]) => (
        file.startsWith("packages/four-rotation/src/") ||
        file.startsWith("packages/four-camera/src/")
      ))
      .filter(([, source]) => (
        /from\s+["'](?:three|gizmo-core)["']/.test(source) ||
        /\b(?:HTMLElement|Document|window)\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();
    const runtimeThreeViolations = Object.entries(productionPackageSources)
      .filter(([file]) => file.startsWith("packages/four-camera-three/src/"))
      .filter(([, source]) => (
        /from\s+["'](?:gizmo-core)["']/.test(source) ||
        /wallpaper-tesseract|window-runtime|features\/|gizmos/.test(source)
      ))
      .map(([file]) => file)
      .sort();

    expect(forbiddenAppLayerImports).toEqual([]);
    expect(runtimeCorePackageViolations).toEqual([]);
    expect(runtimeThreeViolations).toEqual([]);
  });

  it("keeps runtime-core contract package renderer-agnostic and editor-free", () => {
    const runtimeCorePackageEdges = listModuleEdges(runtimeCorePackageSources);
    const forbiddenImports = runtimeCorePackageEdges
      .filter((edge) => (
        edge.specifier === "three" ||
        edge.specifier === "gizmo-core" ||
        edge.specifier === "actor-input" ||
        edge.specifier === "ui-framework" ||
        edge.specifier.includes("wallpaper-tesseract") ||
        edge.specifier.includes("window-runtime") ||
        edge.specifier.includes("features/") ||
        edge.specifier.includes("gizmos") ||
        edge.specifier.includes("scene-runtime")
      ))
      .map((edge) => `${edge.fromFile}: ${edge.specifier}`)
      .sort();
    const forbiddenSymbols = Object.entries(runtimeCorePackageSources)
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([file]) => file !== "packages/runtime-core/src/runtime-id.ts")
      .filter(([, source]) => (
        /\b(?:HTMLElement|HTMLCanvasElement|Document|WebGLRenderingContext|WebGL2RenderingContext)\b/.test(source) ||
        /\b(?:RenderableSceneView|viewActorId|frameActorId|windowTab|WindowViewKey)\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();
    const zoneMap = createSourceZoneMap(runtimeCorePackageSources, projectPrismSourceZones);

    expect(zoneMap.unclassified).toEqual([]);
    expect(zoneMap.ambiguousCandidateFiles).toEqual([]);
    expect(forbiddenImports).toEqual([]);
    expect(forbiddenSymbols).toEqual([]);
    expect(evaluateZoneDependencyMatrix(
      runtimeCorePackageSources,
      projectPrismSourceZones,
      projectPrismZoneDependencyRules
    )).toEqual([]);
  });

  it("keeps runtime package targets split between contracts, backend packages, and production ownership", () => {
    const runtimeContractsTarget = projectPrismPackageTargets.find((target) => target.id === "runtime-core-contracts");
    const runtimeOwnershipTarget = projectPrismPackageTargets.find((target) => target.id === "runtime-production-ownership");
    const runtimeThreeBackendTarget = projectPrismPackageTargets.find((target) => target.id === "runtime-three-backend");
    const runtimeRenderOwnershipTarget = projectPrismPackageTargets.find((target) => target.id === "runtime-render-production-ownership");

    expect(runtimeContractsTarget).toMatchObject({
      extractionStatus: "allowed",
      blockedBy: [],
      cleanCandidateZones: ["runtime-core-candidate"]
    });
    expect(runtimeOwnershipTarget).toMatchObject({
      extractionStatus: "blocked"
    });
    expect(runtimeOwnershipTarget?.blockedBy).toEqual(expect.arrayContaining([
      "runtime-ownership-debt"
    ]));
    expect(runtimeOwnershipTarget?.blockedBy).not.toContain("runtime-adapter-debt");
    expect(runtimeOwnershipTarget?.blockedBy).not.toContain("state-domain-debt");
    expect(runtimeThreeBackendTarget).toMatchObject({
      extractionStatus: "allowed",
      blockedBy: [],
      cleanCandidateZones: ["runtime-three-candidate"]
    });
    expect(runtimeRenderOwnershipTarget).toMatchObject({
      extractionStatus: "blocked"
    });
    expect(runtimeRenderOwnershipTarget?.blockedBy).toEqual(expect.arrayContaining([
      "runtime-ownership-debt"
    ]));
  });

  it("keeps runtime-three backend package editor-free and UI-free", () => {
    const runtimeThreePackageEdges = listModuleEdges(runtimeThreePackageSources);
    const forbiddenImports = runtimeThreePackageEdges
      .filter((edge) => (
        edge.specifier === "gizmo-core" ||
        edge.specifier === "actor-input" ||
        edge.specifier === "ui-framework" ||
        edge.specifier.includes("wallpaper-tesseract") ||
        edge.specifier.includes("window-runtime") ||
        edge.specifier.includes("features/") ||
        edge.specifier.includes("gizmos") ||
        edge.specifier.includes("scene-runtime")
      ))
      .map((edge) => `${edge.fromFile}: ${edge.specifier}`)
      .sort();
    const forbiddenSymbols = Object.entries(runtimeThreePackageSources)
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => (
        /\b(?:RenderableSceneView|viewActorId|frameActorId|WindowViewKey|ActorInput|Gizmo)\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();
    const zoneMap = createSourceZoneMap(runtimeThreePackageSources, projectPrismSourceZones);

    expect(zoneMap.unclassified).toEqual([]);
    expect(zoneMap.ambiguousCandidateFiles).toEqual([]);
    expect(forbiddenImports).toEqual([]);
    expect(forbiddenSymbols).toEqual([]);
    expect(evaluateZoneDependencyMatrix(
      runtimeThreePackageSources,
      projectPrismSourceZones,
      projectPrismZoneDependencyRules
    )).toEqual([]);
  });

  it("keeps app-local runtime extraction blockers explicit instead of treating them as runtime-core", () => {
    const zoneMap = createSourceZoneMap(sourceFiles, projectPrismSourceZones);
    const zonesByFile = new Map(zoneMap.entries.map((entry) => [entry.file, entry.zones.map((zone) => zone.id)]));
    const missingFiles = projectPrismRuntimeExtractionBlockers
      .flatMap((blocker) => blocker.files)
      .filter((file) => sourceFiles[file] === undefined)
      .sort();
    const unclassifiedBlockerFiles = projectPrismRuntimeExtractionBlockers
      .flatMap((blocker) => blocker.files)
      .filter((file) => !(zonesByFile.get(file) ?? []).includes("runtime-ownership-debt"))
      .sort();
    const incompleteBlockers = projectPrismRuntimeExtractionBlockers
      .filter((blocker) => (
        blocker.requiredPort.length < 10 ||
        blocker.blocker.length < 20 ||
        blocker.deletionCondition.length < 20
      ))
      .map((blocker) => blocker.id)
      .sort();

    expect(missingFiles).toEqual([]);
    expect(unclassifiedBlockerFiles).toEqual([]);
    expect(incompleteBlockers).toEqual([]);
  });

  it("keeps UI framework extraction blockers explicit until UI-owned state ports exist", () => {
    const zoneMap = createSourceZoneMap(sourceFiles, projectPrismSourceZones);
    const zonesByFile = new Map(zoneMap.entries.map((entry) => [entry.file, entry.zones.map((zone) => zone.id)]));
    const missingFiles = projectPrismUiFrameworkExtractionBlockers
      .flatMap((blocker) => blocker.files)
      .filter((file) => sourceFiles[file] === undefined)
      .sort();
    const unclassifiedBlockerFiles = projectPrismUiFrameworkExtractionBlockers
      .flatMap((blocker) => blocker.files)
      .filter((file) => !(zonesByFile.get(file) ?? []).includes("ui-state-binding-debt"))
      .sort();
    const incompleteBlockers = projectPrismUiFrameworkExtractionBlockers
      .filter((blocker) => (
        blocker.requiredPort.length < 10 ||
        blocker.blocker.length < 20 ||
        blocker.deletionCondition.length < 20
      ))
      .map((blocker) => blocker.id)
      .sort();

    expect(missingFiles).toEqual([]);
    expect(unclassifiedBlockerFiles).toEqual([]);
    expect(incompleteBlockers).toEqual([]);
  });

  it("keeps scene-backed UI state adapters deleted", () => {
    const windowRuntimeIndex = sourceFiles["./window-runtime/index.ts"] ?? "";

    expect(sourceFiles["./window-runtime/floating-window-scene-state-adapter.ts"]).toBeUndefined();
    expect(sourceFiles["./editor/adapters/floating-window-scene-state-adapter.ts"]).toBeUndefined();
    expect(sourceFiles["./editor/adapters/workspace-mode-scene-state-adapter.ts"]).toBeUndefined();
    expect(windowRuntimeIndex).not.toMatch(/floating-window-scene-state-adapter/);
    expect(windowRuntimeIndex).not.toMatch(/\bregisterFloatingWindowParameters\b/);
  });

  it("keeps app composition extraction blockers explicit until public installers own concrete policy", () => {
    const zoneMap = createSourceZoneMap(sourceFiles, projectPrismSourceZones);
    const zonesByFile = new Map(zoneMap.entries.map((entry) => [entry.file, entry.zones.map((zone) => zone.id)]));
    const missingFiles = projectPrismAppCompositionBlockers
      .flatMap((blocker) => blocker.files)
      .filter((file) => sourceFiles[file] === undefined)
      .sort();
    const unclassifiedBlockerFiles = projectPrismAppCompositionBlockers
      .flatMap((blocker) => blocker.files)
      .filter((file) => !(zonesByFile.get(file) ?? []).some((zoneId) => (
        zoneId === "app-composition-debt"
      )))
      .sort();
    const incompleteBlockers = projectPrismAppCompositionBlockers
      .filter((blocker) => (
        blocker.blocker.length < 20 ||
        blocker.deletionCondition.length < 20
      ))
      .map((blocker) => blocker.id)
      .sort();

    expect(missingFiles).toEqual([]);
    expect(unclassifiedBlockerFiles).toEqual([]);
    expect(incompleteBlockers).toEqual([]);
  });

  it("keeps Project Prism legacy locks paired with replacement contracts", () => {
    const actorInputRouterSource = actorInputPackageSources["packages/actor-input/src/actor-input-router.ts"] ?? "";
    const renderableSceneViewSource = sourceFiles["./features/scene/renderable-scene-view.ts"] ?? "";
    const dockTargetRegionSource =
      uiFrameworkPackageSources["packages/ui-framework/src/ports/dock-target-region-source.ts"] ?? "";
    const persistenceSource =
      uiFrameworkPackageSources["packages/ui-framework/src/model/window-workspace-layout-persistence.ts"] ?? "";
    const appMenuModelSource =
      uiFrameworkPackageSources["packages/ui-framework/src/model/app-menu-model.ts"] ?? "";

    expect(findForbiddenSourceMatches(/\b(?:GizmoResponder|hitTestGizmo|gizmoPriority)\b/)).toEqual([]);
    expect(actorInputRouterSource).toMatch(/\bActorInputRouter\b/);
    expect(actorInputRouterSource).toMatch(/\bisActorInputParticipant\b/);

    expect(findForbiddenSourceMatches(/\b(?:SceneViewRuntime|CurrentSceneViewSource)\b/)).toEqual([]);
    expect(renderableSceneViewSource).toMatch(/\bRenderableSceneView\b/);
    expect(renderableSceneViewSource).not.toMatch(/\bdispose\b/);

    expect(findForbiddenSourceMatches(
      /\b(?:WindowDockTargetFrame|DockTargetFrameSource|createDockTargetFrameSource|listDockTargetFrames)\b/
    )).toEqual([]);
    expect(dockTargetRegionSource).toMatch(/\bDockTargetRegionSource\b/);
    expect(dockTargetRegionSource).toMatch(/\blistDockTargetRegions\b/);

    expect(findForbiddenSourceMatches(
      /\b(?:WindowWorkspaceLayout|createWindowWorkspaceLayout|dockWindowAsTab|findDockTabsetContaining|normalizeWindowWorkspaceLayout|removeWindowFromDock|removeWindowFromLayout|setActiveDockTab|splitDockTab|undockWindow)\b/
    )).toEqual([]);
    expect(persistenceSource).toMatch(/\btypeKey:\s*WindowViewTypeKey\b/);
    expect(persistenceSource).toMatch(/\binstanceId:\s*WindowViewInstanceId\b/);
    expect(persistenceSource).not.toMatch(/\b(?:viewActorId|frameActorId|actorId)\b/);

    expect(sourceFiles["./window-runtime/window-control-source.ts"]).toBeUndefined();
    expect(sourceFiles["./window-runtime/window-menu-view-source.ts"]).toBeUndefined();
    expect(sourceFiles["./window-runtime/window-visibility-activation-controller.ts"]).toBeUndefined();
    expect(appMenuModelSource).toMatch(/\bkind:\s*["']open-or-focus-type["']/);
    expect(appMenuModelSource).toMatch(/\bkind:\s*["']focus-instance["']/);
  });

  it("keeps Project Prism app composition debt from reaching back into concrete internals", () => {
    const appCompositionFiles = new Set([
      "./app/create-wallpaper-app.ts",
      "./app/install-component-definitions.ts",
      "./app/workspace-mode.ts",
      "./demo.ts"
    ]);
    const forbiddenResolvedTargets = [
      /^\.\/debug\/components\//,
      /^\.\/hierarchy\/hierarchy-panel-actor-factory\.ts$/,
      /^\.\/features\/scene\/scene-view-content-installer\.ts$/,
      /^\.\/features\/scene\/renderable-scene-view\.ts$/,
      /^\.\/window-runtime\/floating-window-component\.ts$/,
      /^\.\/window-runtime\/window-frame-lifecycle-controller\.ts$/,
      /^\.\/window-runtime\/window-view-factory-registry\.ts$/,
      /^\.\/tesseract4\/components\/tesseract4-actor-factory\.ts$/,
      /^\.\/gizmos\/camera3\/components\/camera3-gizmo-actor-factory\.ts$/
    ];
    const violations = listModuleEdges(sourceFiles)
      .filter((edge) => appCompositionFiles.has(edge.fromFile))
      .filter((edge) => edge.resolvedFile !== null)
      .filter((edge) => forbiddenResolvedTargets.some((pattern) => pattern.test(edge.resolvedFile ?? "")))
      .map((edge) => `${edge.fromFile}: ${edge.resolvedFile}`)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps Project Prism UI candidates independent from scene-runtime", () => {
    const zoneMap = createSourceZoneMap(sourceFiles, projectPrismSourceZones);
    const zonesByFile = new Map(zoneMap.entries.map((entry) => [entry.file, entry.zones]));
    const violations = listModuleEdges(sourceFiles)
      .filter((edge) => edge.resolvedFile?.startsWith("./scene-runtime/"))
      .filter((edge) => {
        const sourceZones = zonesByFile.get(edge.fromFile) ?? [];
        return sourceZones.some((zone) => zone.id === "ui-framework-candidate");
      })
      .map((edge) => `${edge.fromFile}: ${edge.specifier}`)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps UI framework candidates independent from concrete Scene, Camera, and Tesseract runtime facts", () => {
    const uiCandidatePrefixes = [
      "./window-runtime/",
      "./features/app-menu/",
      "./features/window-workspace/",
      "./ui-framework-fixture/"
    ];
    const forbiddenRuntimeFeatureEdges = listModuleEdges(sourceFiles)
      .filter((edge) => uiCandidatePrefixes.some((prefix) => edge.fromFile.startsWith(prefix)))
      .filter((edge) => !edge.fromFile.endsWith(".test.ts"))
      .filter((edge) => (
        edge.specifier.includes("features/scene") ||
        edge.specifier.includes("features/camera3") ||
        edge.specifier.includes("camera3-control") ||
        edge.specifier.includes("gizmos/camera3") ||
        edge.specifier.includes("tesseract4") ||
        edge.specifier === "three"
      ))
      .map((edge) => `${edge.fromFile}: ${edge.specifier}`)
      .sort();

    expect(forbiddenRuntimeFeatureEdges).toEqual([]);
  });

  it("keeps the Project Prism UI framework fixture product-free", () => {
    const forbiddenFixtureEdges = listModuleEdges(sourceFiles)
      .filter((edge) => edge.fromFile.startsWith("./ui-framework-fixture/"))
      .filter((edge) => !edge.fromFile.endsWith(".test.ts"))
      .filter((edge) => edge.resolvedFile !== null)
      .filter((edge) => (
        edge.resolvedFile!.startsWith("./app-runtime/") ||
        edge.resolvedFile!.startsWith("./app/") ||
        edge.resolvedFile!.startsWith("./debug/") ||
        edge.resolvedFile!.startsWith("./hierarchy/") ||
        edge.resolvedFile!.startsWith("./features/scene/") ||
        edge.resolvedFile!.startsWith("./features/camera3/") ||
        edge.resolvedFile!.startsWith("./features/inspector/") ||
        edge.resolvedFile!.startsWith("./features/tool-windows/") ||
        edge.resolvedFile!.startsWith("./gizmos/") ||
        edge.resolvedFile!.startsWith("./scene-runtime/") ||
        edge.resolvedFile!.startsWith("./tesseract4/")
      ))
      .map((edge) => `${edge.fromFile}: ${edge.resolvedFile}`)
      .sort();

    expect(forbiddenFixtureEdges).toEqual([]);
  });

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


  it("does not keep a pseudo-core component definition installer", () => {
    expect(sourceFiles["./component-definitions.ts"]).toBeUndefined();
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
    const editorSceneViewHostSource = sourceFiles["./features/scene/editor-scene-view-host.ts"] ?? "";

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
    expect(sceneFeatureInstallerSource).toMatch(/\bcreateEditorSceneViewHost\b/);
    expect(sceneFeatureInstallerSource).toMatch(/\bcreateRenderableSceneView\b/);
    expect(sceneFeatureInstallerSource).toMatch(/\bSceneViewFrameSourceRegistry\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bCurrentRenderableSceneViewRegistry\b/);
    expect(sceneViewInstallerSource).not.toMatch(/\bcreateSceneWindowActor\b/);
    expect(sceneViewInstallerSource).toMatch(/\bcreateSceneViewActor\b/);
    expect(renderableSceneViewSource).toMatch(/host\.renderWithCamera/);
    expect(renderableSceneViewSource).not.toMatch(/sceneView\.viewport\.render/);
    expect(editorSceneViewHostSource).toMatch(/sceneView\.viewport\.render/);
  });

  it("guards Scene viewport rendering behind current view ownership and active state", () => {
    const renderableSceneViewSource = sourceFiles["./features/scene/renderable-scene-view.ts"] ?? "";
    const editorSceneViewHostSource = sourceFiles["./features/scene/editor-scene-view-host.ts"] ?? "";

    expect(renderableSceneViewSource).toMatch(/\bisRenderable\s*\(\)\s*{/);
    expect(renderableSceneViewSource).not.toMatch(/sceneWindow\.window\.state\.visible/);
    expect(renderableSceneViewSource).toMatch(/host\.isVisibleInCurrentLocation/);
    expect(renderableSceneViewSource).toMatch(/host\.renderWithCamera\(options\.camera3Motion\.activeCamera\)/);
    expect(editorSceneViewHostSource).toMatch(/locations\.getLocationByViewActorId/);
    expect(editorSceneViewHostSource).toMatch(/location\.ownerFrameVisible/);
    expect(editorSceneViewHostSource).toMatch(/location\.visibleInFrame/);
    expect(editorSceneViewHostSource).toMatch(/actorSystem\.isActorActive\s*\(\s*options\.sceneView\.viewport\.actor\s*\)/);
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
    expect(camera3GizmoSource).not.toMatch(/projectionMode\.activeCamera/);
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
    expect(sceneViewInstallerSource).toMatch(/sceneView\?\.dispose\s*\(\s*\)/);
    expect(sceneViewInstallerSource).not.toMatch(/\bsceneWindow\b/);
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

  it("keeps the Scene view recoverable through the window lifecycle view factory", () => {
    const sceneFeatureInstaller = sourceFiles["./features/scene/install-scene-view-feature.ts"] ?? "";
    const appMenuActorFactory = sourceFiles["./features/app-menu/app-menu-bar-actor-factory.ts"] ?? "";

    expect(sceneFeatureInstaller).toMatch(/viewKey:\s*["']scene["']/);
    expect(sceneFeatureInstaller).toMatch(/order:\s*0/);
    expect(sceneFeatureInstaller).toMatch(/\bcreateViewRuntime\b/);
    expect(sceneFeatureInstaller).not.toMatch(/\bcreateSceneWindowActor\b/);
    expect(appMenuActorFactory).not.toMatch(/\bfloatingWindowComponentType\b/);
  });

  it("composes the window workspace through a feature installer", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const appRuntimeSource = sourceFiles["./app-runtime/app-runtime-context.ts"] ?? "";
    const workspaceInstallerSource =
      sourceFiles["./features/window-workspace/install-window-workspace-feature.ts"] ?? "";

    expect(appSource).toMatch(/\bcreateWindowFocusServiceProxy\b/);
    expect(appSource).toMatch(/\binstallWindowWorkspaceFeature\b/);
    expect(appSource).not.toMatch(/\bnew\s+(WindowWorkspaceController|WindowViewFactoryRegistry|WindowDockPreviewController|WindowWorkspacePresentationController)\b/);
    expect(appSource).not.toMatch(/\bnew\s+WindowFramePortRegistry\b/);
    expect(appSource).not.toMatch(/\bcreateDockTargetRegionSource\b/);
    expect(workspaceInstallerSource).toMatch(/\bnew\s+WindowWorkspaceController\b/);
    expect(workspaceInstallerSource).toMatch(/windowFocus\.bind\s*\(\s*workspaceController\s*\)/);
    expect(appSource).toMatch(/windowFocus\.dispose\s*\(\s*\)/);
    expect(appRuntimeSource).not.toMatch(/\bactorWindowFocus\b/);
  });

  it("keeps concrete window frame policy in feature modules instead of app composition", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const sceneInstallerSource = sourceFiles["./features/scene/install-scene-view-feature.ts"] ?? "";
    const toolInstallerSource = sourceFiles["./features/tool-windows/install-tool-window-features.ts"] ?? "";

    expect(appSource).toMatch(/\bcreateSceneWindowWorkspaceFloatingFramePolicy\b/);
    expect(appSource).toMatch(/\bcreateToolWindowWorkspaceFloatingFramePolicies\b/);
    expect(appSource).toMatch(/\bcreateSceneDefaultOpenView\b/);
    expect(appSource).toMatch(/\bcreateToolWindowDefaultOpenViews\b/);
    expect(appSource).not.toMatch(/\bSCENE_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(appSource).not.toMatch(/\bDEBUG_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(appSource).not.toMatch(/\bHIERARCHY_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(appSource).not.toMatch(/sceneParameterPaths\.(?:sceneWindow|debugWindow|hierarchyWindow)/);
    expect(appSource).not.toMatch(/floating-window:(?:scene|debug-log|hierarchy)/);
    expect(appSource).not.toMatch(/className:\s*["'](?:scene-window|debug-log-window|hierarchy-window)["']/);

    expect(sceneInstallerSource).toMatch(/editorWindowLayoutPaths\.sceneWindow/);
    expect(sceneInstallerSource).toMatch(/floating-window:scene/);
    expect(sceneInstallerSource).toMatch(/\bSCENE_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(toolInstallerSource).toMatch(/editorWindowLayoutPaths\.(?:debugWindow|hierarchyWindow)/);
    expect(toolInstallerSource).toMatch(/floating-window:(?:debug-log|hierarchy)/);
    expect(toolInstallerSource).toMatch(/\bDEBUG_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(toolInstallerSource).toMatch(/\bHIERARCHY_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
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
    const bindingSource = actorInputPackageSources["packages/actor-input/src/gizmo-event-binding-component.ts"] ?? "";
    const routerSource = actorInputPackageSources["packages/actor-input/src/actor-input-router.ts"] ?? "";

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
    const appInstallerSource = sourceFiles["./app/install-component-definitions.ts"] ?? "";

    expect(sourceFiles["./component-definitions.ts"]).toBeUndefined();
    expect(appInstallerSource).toMatch(/\binstallWallpaperComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallGizmoRuntimeComponentDefinitions\b/);
    expect(appInstallerSource).toMatch(/\binstallStateRuntimeComponentDefinitions\b/);
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
    expect(componentSource).toMatch(/activateWindowCommandRow\(row,\s*event\.timeStamp\)/);
    expect(componentSource).toMatch(/requestOpenOrFocusViewType\(row\.action\.typeKey,\s*["']menu["']\)/);
    expect(componentSource).toMatch(/requestCreateViewInstance\?\.\(row\.action\.typeKey,\s*["']menu["']\)/);
    expect(componentSource).toMatch(/requestFocusViewInstance\?\.\(row\.action\.identity,\s*["']menu["']\)/);
    expect(componentSource).not.toMatch(/requestOpenView\(row\.viewKey/);
    expect(componentSource).not.toMatch(/requestOpenView\([^)]*actorId/);
    expect(definitionSource).toMatch(/\bgizmoEventBindingComponentType\b/);
    expect(definitionSource).toMatch(/\bstateObserverBindingComponentType\b/);
  });

  it("keeps tab-local window actions on actor input lifecycle intents", () => {
    const floatingWindowSource = sourceFiles["./window-runtime/floating-window-component.ts"] ?? "";
    const rootFrameSource = sourceFiles["./window-runtime/workspace-root-dock-frame-component.ts"] ?? "";
    const tabInputSource = sourceFiles["./window-runtime/window-frame-tab-input.ts"] ?? "";
    const tabActionSource = uiFrameworkPackageSources["packages/ui-framework/src/chrome/window-tab-action.ts"] ?? "";

    expect(floatingWindowSource).toMatch(/\bhandleWindowFrameTabInputEnd\b/);
    expect(rootFrameSource).toMatch(/\bhandleWindowFrameTabInputEnd\b/);
    expect(tabInputSource).toMatch(/requestCloseView\(event\.hit\.data\.viewActorId,\s*["']tab-action["'],\s*\{/);
    expect(tabInputSource).toMatch(/ownerFrameId:\s*frameId/);
    expect(tabInputSource).toMatch(/viewKey:\s*event\.hit\.data\.viewKey/);
    expect(floatingWindowSource).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(rootFrameSource).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(floatingWindowSource).not.toMatch(/\.onclick\s*=/);
    expect(rootFrameSource).not.toMatch(/\.onclick\s*=/);
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
    const surfaceSource = uiFrameworkPackageSources["packages/ui-framework/src/chrome/window-frame-surface-component.ts"] ?? "";

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
    expect(installSource).toMatch(/windowFrameSurfaceComponentDefinition[\s\S]*createFloatingWindowComponentDefinition/);
    expect(installSource).toMatch(/windowFrameSurfaceComponentDefinition[\s\S]*workspaceRootDockFrameComponentDefinition/);
  });

  it("keeps root and floating tab chrome on the same shared hit/action model", () => {
    const floatingWindowSource = sourceFiles["./window-runtime/floating-window-component.ts"] ?? "";
    const rootFrameSource = sourceFiles["./window-runtime/workspace-root-dock-frame-component.ts"] ?? "";
    const surfaceSource = uiFrameworkPackageSources["packages/ui-framework/src/chrome/window-frame-surface-component.ts"] ?? "";
    const tabChromeSource = uiFrameworkPackageSources["packages/ui-framework/src/chrome/window-frame-tab-chrome.ts"] ?? "";
    const tabInputSource = sourceFiles["./window-runtime/window-frame-tab-input.ts"] ?? "";
    const duplicatedChromeHelpers =
      /\b(?:findWindowFrameTabActionAtPoint|findWindowFrameTabAtPoint|renderWindowFrameTabsetTabs|createWindowTabCloseAction)\b/;

    expect(tabChromeSource).toMatch(/\bWINDOW_FRAME_TAB_ACTION_PART_ID\b/);
    expect(tabChromeSource).toMatch(/\bcreateWindowTabCloseAction\s*\(\s*tab\s*\)/);
    expect(surfaceSource).toMatch(/\bfindWindowFrameTabActionAtPoint\b/);
    expect(surfaceSource).toMatch(/\bfindWindowFrameTabAtPoint\b/);
    expect(surfaceSource).toMatch(/\brenderWindowFrameTabsetTabs\b/);
    expect(floatingWindowSource).toMatch(/this\.#surface\.hitTest\s*\(\s*point\s*\)/);
    expect(rootFrameSource).toMatch(/this\.#surface\.hitTest\s*\(\s*point\s*\)/);
    expect(floatingWindowSource).not.toMatch(duplicatedChromeHelpers);
    expect(rootFrameSource).not.toMatch(duplicatedChromeHelpers);
    expect(floatingWindowSource).toMatch(/\bWINDOW_FRAME_TAB_ACTION_PART_ID\b/);
    expect(rootFrameSource).toMatch(/\bWINDOW_FRAME_TAB_ACTION_PART_ID\b/);
    expect(floatingWindowSource).toMatch(/\bhandleWindowFrameTabInputEnd\b/);
    expect(rootFrameSource).toMatch(/\bhandleWindowFrameTabInputEnd\b/);
    expect(tabInputSource).toMatch(/\brequestActivateFrameTab\b/);
    expect(tabInputSource).toMatch(/\brequestCommitDock\b/);
    expect(tabInputSource).toMatch(/\brequestCloseView\b/);
  });

  it("keeps dock surface active-tab display truth inside tabset runtime roots", () => {
    const framePortSource = uiFrameworkPackageSources["packages/ui-framework/src/ports/window-frame-port.ts"] ?? "";
    const dockSurfaceSource = uiFrameworkPackageSources["packages/ui-framework/src/model/window-dock-surface-model.ts"] ?? "";
    const surfaceSource = uiFrameworkPackageSources["packages/ui-framework/src/chrome/window-frame-surface-component.ts"] ?? "";

    expect(framePortSource).not.toMatch(/\bgetActiveViewActorId\b/);
    expect(framePortSource).toMatch(/\bgetFocusedViewActorId\b/);
    expect(framePortSource).toMatch(/\bgetActiveViewActorIds\b/);
    expect(dockSurfaceSource).not.toMatch(/#activeViewActorId/);
    expect(dockSurfaceSource).toMatch(/#focusedViewActorId/);
    expect(surfaceSource).not.toMatch(/target\?\.content\s*\?\?\s*host\.primaryContent/);
  });

  it("keeps frame visual layer and actor input priority on the same frame projection", () => {
    const floatingWindowSource = sourceFiles["./window-runtime/floating-window-component.ts"] ?? "";
    const rootFrameSource = sourceFiles["./window-runtime/workspace-root-dock-frame-component.ts"] ?? "";
    const registrySource =
      uiFrameworkPackageSources["packages/ui-framework/src/ports/window-frame-port-registry.ts"] ?? "";
    const workspaceControllerSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-workspace-controller.ts"] ?? "";

    expect(registrySource).toMatch(/\bgetStackPriority:\s*\(\)\s*=>\s*number\b/);
    expect(floatingWindowSource).toMatch(/getInputStackPriority:\s*\(\)\s*=>\s*this\.inputStackPriority/);
    expect(floatingWindowSource).toMatch(/getStackPriority:\s*\(\)\s*=>\s*this\.inputStackPriority/);
    expect(floatingWindowSource).toMatch(/style\.zIndex\s*=\s*String\s*\(\s*this\.#effectivePriority\s*\)/);
    expect(floatingWindowSource).not.toMatch(/style\.zIndex\s*=\s*String\s*\(\s*this\.#basePriority\s*\)/);
    expect(rootFrameSource).toMatch(/getInputStackPriority:\s*\(\)\s*=>\s*this\.inputStackPriority/);
    expect(rootFrameSource).toMatch(/getStackPriority:\s*\(\)\s*=>\s*this\.inputStackPriority/);
    expect(rootFrameSource).not.toMatch(/getInputStackPriority:\s*\(\)\s*=>\s*WORKSPACE_ROOT_FRAME_PRIORITY/);
    expect(workspaceControllerSource).toMatch(/\bsetFrameStackPriority\b/);
  });

  it("keeps the window workspace catalog as a read-only projection", () => {
    const catalogSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-workspace-view-catalog.ts"] ?? "";
    const controllerSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-workspace-controller.ts"] ?? "";
    const priorityPortSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-workspace-stack-priority-port.ts"] ?? "";

    expect(catalogSource).not.toMatch(/\bsetStackPriority\b/);
    expect(controllerSource).toMatch(/\bWindowWorkspaceStackPriorityPort\b/);
    expect(priorityPortSource).toMatch(/\bsetFrameStackPriority\b/);
  });

  it("keeps App Menu model product-free and feature component as the actor-input adapter", () => {
    const appMenuModelSource =
      uiFrameworkPackageSources["packages/ui-framework/src/model/app-menu-model.ts"] ?? "";
    const appMenuComponentSource = sourceFiles["./features/app-menu/app-menu-bar-component.ts"] ?? "";
    const windowRuntimeViolations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./window-runtime/"))
      .filter(([, source]) => /features\/app-menu/.test(source))
      .map(([file]) => file)
      .sort();

    expect(appMenuModelSource).not.toMatch(/features\/|window-runtime|scene-runtime|debug|hierarchy|tesseract|camera3/);
    expect(appMenuModelSource).toMatch(/\bkind:\s*["']window-command["']/);
    expect(appMenuModelSource).toMatch(/\bkind:\s*["']open-or-focus-type["']/);
    expect(appMenuModelSource).toMatch(/\bkind:\s*["']new-instance["']/);
    expect(appMenuModelSource).toMatch(/\bkind:\s*["']focus-instance["']/);
    expect(appMenuModelSource).toMatch(/\bactivationSequence\b/);
    expect(appMenuModelSource).toMatch(/\btypeKey\b/);
    expect(appMenuModelSource).toMatch(/\bviewKey\b/);
    expect(appMenuModelSource).toMatch(/\bWindowWorkspaceViewEntry\b/);
    expect(appMenuModelSource).not.toMatch(/\bdata\s*\?:\s*unknown\b/);
    expect(appMenuComponentSource).toMatch(/\bActorInputParticipant\b/);
    expect(appMenuComponentSource).toMatch(/\bStateObserverResponder\b/);
    expect(appMenuComponentSource).toMatch(/from\s+["']\.\/app-menu-model["']/);
    expect(windowRuntimeViolations).toEqual([]);
  });

  it("keeps UI framework public window identity models product-agnostic", () => {
    const publicIdentitySources = [
      uiFrameworkPackageSources["packages/ui-framework/src/model/window-view-key.ts"] ?? "",
      uiFrameworkPackageSources["packages/ui-framework/src/model/window-view-identity.ts"] ?? "",
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-frame-lifecycle.ts"] ?? ""
    ].join("\n");

    expect(publicIdentitySources).not.toMatch(/["'](?:scene|debug|hierarchy|scene-toggle)["']/);
    expect(publicIdentitySources).not.toMatch(/["']scene["']\s*\|\s*["']debug["']\s*\|\s*["']hierarchy["']/);
  });

  it("keeps dock preview source and target tabset facts explicit", () => {
    const dockTargetsSource =
      uiFrameworkPackageSources["packages/ui-framework/src/model/window-dock-targets.ts"] ?? "";

    expect(dockTargetsSource).toMatch(/readonly\s+targetTabsetTabs:\s+readonly\s+string\[\]/);
    expect(dockTargetsSource).toMatch(/readonly\s+sourceViewActorId:\s+string/);
    expect(dockTargetsSource).not.toMatch(/targetTabsetTabs\?:/);
    expect(dockTargetsSource).not.toMatch(/sourceViewActorId\?:/);
    expect(dockTargetsSource).toMatch(/\bfunction\s+getDockPreviewSource\b/);
  });

  it("keeps old window source and visible-activation adapters deleted", () => {
    expect(sourceFiles["./window-runtime/window-control-source.ts"]).toBeUndefined();
    expect(sourceFiles["./window-runtime/window-menu-view-source.ts"]).toBeUndefined();
    expect(sourceFiles["./window-runtime/window-visibility-activation-controller.ts"]).toBeUndefined();
  });

  it("keeps window view factories limited to view runtime creation", () => {
    const factoryRegistrySource =
      uiFrameworkPackageSources["packages/ui-framework/src/ports/window-view-factory-registry.ts"] ?? "";
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
    const lifecycleSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-frame-lifecycle.ts"] ?? "";
    const controllerSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-frame-lifecycle-controller.ts"] ?? "";
    const factoryRegistrySource =
      uiFrameworkPackageSources["packages/ui-framework/src/ports/window-view-factory-registry.ts"] ?? "";
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
    const persistenceSource =
      uiFrameworkPackageSources["packages/ui-framework/src/model/window-workspace-layout-persistence.ts"] ?? "";
    const persistenceControllerSource =
      uiFrameworkPackageSources[
        "packages/ui-framework/src/services/window-workspace-layout-persistence-controller.ts"
      ] ?? "";
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";

    expect(persistenceSource).toMatch(/\btypeKey:\s*WindowViewTypeKey\b/);
    expect(persistenceSource).toMatch(/\binstanceId:\s*WindowViewInstanceId\b/);
    expect(persistenceSource).toMatch(/\bgetPersistedViewDescriptorIdentity\b/);
    expect(persistenceSource).not.toMatch(/\bviewActorId\b/);
    expect(persistenceSource).not.toMatch(/\bactorId\b/);
    expect(persistenceSource).not.toMatch(/\bframeActorId\b/);
    expect(persistenceSource).not.toMatch(/\bFloatingWindowComponent\b/);
    expect(persistenceSource).not.toMatch(/\bSceneViewRuntime\b/);
    expect(persistenceControllerSource).toMatch(/\bWindowFrameLayoutSnapshotSource\b/);
    expect(persistenceControllerSource).not.toMatch(/\bActorSystem\b/);
    expect(persistenceControllerSource).not.toMatch(/\bFloatingWindowComponent\b/);
    expect(appSource).not.toMatch(/\bloadPersistedWindowWorkspaceFrameLayout\b/);
    expect(appSource).not.toMatch(/\brestoreFrameLayout\b/);
    expect(appSource).not.toMatch(/\b(?:localStorage|sessionStorage)\b/);
    expect(appSource).toMatch(/\bcreateBrowserWindowWorkspaceFrameLayoutStorage\b/);
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
    const controllerSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-frame-lifecycle-controller.ts"] ?? "";
    const factoryRegistrySource =
      uiFrameworkPackageSources["packages/ui-framework/src/ports/window-view-factory-registry.ts"] ?? "";

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
      "packages/ui-framework/src/model/window-frame-dock-tree.ts",
      "./window-runtime/window-workspace-layout.ts",
      "packages/ui-framework/src/model/window-dock-targets.ts",
      "packages/ui-framework/src/model/window-tab-drag-session.ts"
    ]);
    const layoutSources = {
      ...sourceFiles,
      ...uiFrameworkPackageSources
    };
    const violations = Object.entries(layoutSources)
      .filter(([file]) => pureWindowLayoutFiles.has(file))
      .filter(([, source]) => (
        /\b(?:HTMLElement|HTMLDivElement|Document|Element|getBoundingClientRect|querySelector)\b/.test(source) ||
        /from\s+["'](?:gizmo-core|three)["']/.test(source)
      ))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
  });

  it("keeps the window frame dock tree model behind the UI framework public API", () => {
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

  it("keeps UpdateFrame as the source of frame/update contracts", () => {
    const updateFrameSource = sourceFiles["./runtime/ports/update-frame.ts"] ?? "";
    const sceneFrameSource = sourceFiles["./scene-runtime/scene-frame.ts"] ?? "";
    const actorRuntimeSceneFrameImports = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./actor-runtime/"))
      .filter(([, source]) => (
        /from\s+["'](?:\.\.\/)+scene-runtime\/scene-frame["']/.test(source) ||
        /\bSceneFrame(?:Clock)?\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();

    expect(updateFrameSource).toMatch(/\binterface\s+UpdateFrame\b/);
    expect(updateFrameSource).toMatch(/\bclass\s+UpdateFrameClock\b/);
    expect(updateFrameSource).not.toMatch(/\bSceneFrame\b/);
    expect(updateFrameSource).not.toMatch(/from\s+["'][^"']*scene-runtime/);
    expect(sceneFrameSource).toMatch(/UpdateFrame/);
    expect(actorRuntimeSceneFrameImports).toEqual([]);
  });

  it("keeps actor-runtime independent from runtime ports", () => {
    const actorRuntimePortImports = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./actor-runtime/"))
      .filter(([, source]) => /from\s+["'](?:\.\.\/)+runtime\/ports(?:\/index)?["']/.test(source))
      .map(([file]) => file)
      .sort();

    expect(actorRuntimePortImports).toEqual([]);
  });

  it("keeps window-runtime geometry independent from scene Vec2 helpers", () => {
    const sceneVec2Imports = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./window-runtime/"))
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => (
        /from\s+["'](?:\.\.\/)+scene-runtime(?:\/index)?["']/.test(source) &&
        /\b(?:Vec2|vec2|cloneVec2|addVec2|equalsVec2|assertVec2)\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();
    const uiGeometrySource = uiFrameworkPackageSources["packages/ui-framework/src/ports/ui-geometry.ts"] ?? "";

    expect(uiGeometrySource).toMatch(/\binterface\s+UiVec2\b/);
    expect(sourceFiles["./window-runtime/ui-geometry.ts"]).toBeUndefined();
    expect(sceneVec2Imports).toEqual([]);
  });

  it("keeps generic window-runtime commands independent from scene command/path contracts", () => {
    const sceneCommandOrPathImports = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./window-runtime/"))
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => (
        /from\s+["'](?:\.\.\/)+scene-runtime(?:\/index)?["']/.test(source) &&
        /\b(?:SceneCommandSink|ParameterPath)\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();
    const appMenuSceneCommandImports = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./features/app-menu/"))
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => /\b(?:SceneCommandSink|ParameterPath|sceneParameterPaths)\b/.test(source))
      .map(([file]) => file)
      .sort();
    const uiLayoutStateSource = uiFrameworkPackageSources["packages/ui-framework/src/ports/ui-layout-state.ts"] ?? "";

    expect(uiLayoutStateSource).toMatch(/\binterface\s+UiLayoutCommandSink\b/);
    expect(sourceFiles["./window-runtime/ui-layout-state.ts"]).toBeUndefined();
    expect(sceneCommandOrPathImports).toEqual([]);
    expect(appMenuSceneCommandImports).toEqual([]);
  });

  it("keeps generic UI state responders on the shared StateChangedEvent contract", () => {
    const uiResponderSceneObserverUses = Object.entries(sourceFiles)
      .filter(([file]) => (
        file.startsWith("./window-runtime/") ||
        file.startsWith("./features/app-menu/") ||
        file.startsWith("./hierarchy/") ||
        file.startsWith("./features/scene/components/")
      ))
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => (
        /\bSceneStateChangedEvent\b/.test(source) ||
        /\bonSceneStateChanged\s*\(/.test(source)
      ))
      .map(([file]) => file)
      .sort();
    const responderSource = sourceFiles["./state-runtime/state-observer-responder.ts"] ?? "";
    const stateRuntimeSceneImports = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./state-runtime/"))
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => /from\s+["'][^"']*scene-runtime/.test(source))
      .map(([file]) => file)
      .sort();

    expect(responderSource).toMatch(/\bonStateChanged\b/);
    expect(responderSource).toMatch(/\bStateChangedEvent\b/);
    expect(uiResponderSceneObserverUses).toEqual([]);
    expect(stateRuntimeSceneImports).toEqual([]);
  });

  it("removes legacy component capability adapters and metadata", () => {
    const componentSource = sourceFiles["./actor-runtime/component.ts"] ?? "";
    const actorRuntimeIndexSource = sourceFiles["./actor-runtime/index.ts"] ?? "";
    const productionCapabilityMetadata = Object.entries(sourceFiles)
      .filter(([file]) => (
        !file.endsWith(".test.ts") &&
        !file.startsWith("./test-support/") &&
        file !== "./architecture-boundaries.test.ts"
      ))
      .filter(([, source]) => /\bcapabilities\s*:/.test(source))
      .map(([file]) => file)
      .sort();

    expect(componentSource).not.toMatch(/["']gizmo["']/);
    expect(componentSource).not.toMatch(/["']state-observer["']/);
    expect(componentSource).not.toMatch(/\bComponentCapability\b/);
    expect(componentSource).not.toMatch(/\bcapabilities\b/);
    expect(actorRuntimeIndexSource).not.toMatch(/\bComponentRuntimeBridge\b/);
    expect(productionCapabilityMetadata).toEqual([]);
  });

  it("keeps active input cancellation behind an explicit attachment descriptor", () => {
    const activeCancellationSource = actorInputPackageSources["packages/actor-input/src/active-input-cancellation-runtime.ts"] ?? "";
    const gizmoDefinitionSource = actorInputPackageSources["packages/actor-input/src/gizmo-event-binding-definition.ts"] ?? "";

    expect(activeCancellationSource).toMatch(/\bactiveInputCancellationAttachmentKind\b/);
    expect(activeCancellationSource).toMatch(/\battachments\.some\b/);
    expect(activeCancellationSource).not.toMatch(/\bfunction\s+isActorInputCanceller\b/);
    expect(gizmoDefinitionSource).toMatch(/\bactiveInputCancellationAttachment\b/);
  });

  it("keeps window focus and stack-priority facts out of actor-runtime", () => {
    const actorRuntimeWindowImports = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./actor-runtime/"))
      .filter(([, source]) => /from\s+["'](?:\.\.\/)+window-runtime/.test(source))
      .map(([file]) => file)
      .sort();
    const componentSource = sourceFiles["./actor-runtime/component.ts"] ?? "";
    const actorRuntimeIndexSource = sourceFiles["./actor-runtime/index.ts"] ?? "";

    expect(actorRuntimeWindowImports).toEqual([]);
    expect(componentSource).not.toMatch(/\bActorWindowFocus(Service|Reason)\b/);
    expect(actorRuntimeIndexSource).not.toMatch(/\bActorWindowFocus(Service|Reason)\b/);
    expect(componentSource).not.toMatch(/\bgetEffectiveStackPriorityForActor\b/);
    expect(componentSource).not.toMatch(/\bfocusActorWindow\b/);
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


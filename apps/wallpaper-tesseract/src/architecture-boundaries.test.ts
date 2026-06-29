import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { uiThemeTokenDefinitions } from "ui-framework";
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
  projectPrismPrePhase6UiFrameworkBlockers,
  projectPrismRuntimeExtractionBlockers,
  projectPrismSourceZones,
  projectPrismUiFrameworkExtractionBlockers,
  projectPrismZoneDependencyRules
} from "./test-support/project-prism-boundary-facts";
import {
  collectProductionWorkspaceSources,
  createWorkspacePackageGraph,
  currentPackageDependencyRules,
  defineSubmoduleZone,
  evaluatePackageDependencyRules,
  evaluateSubmoduleDependencyRules,
  findPackageDependencyCycles,
  findUndeclaredWorkspaceImports,
  isProductionSourceFile,
  listWorkspaceManifestDirectories,
  readWorkspacePackageManifest,
  workspacePackageDescriptors,
  type WorkspacePackageGraphNode,
  type WorkspacePackageManifest
} from "./test-support/package-graph-boundaries";

describe("architecture boundaries", () => {
  const actorSystemInputSources = collectWorkspaceSourceFiles("packages/actor-system/src/input");
  const uiFrameworkPackageSources = collectWorkspaceSourceFiles("packages/ui-framework/src");
  const runtimeCorePackageSources = collectWorkspaceSourceFiles("packages/runtime-core/src");
  const runtimeThreePackageSources = collectWorkspaceSourceFiles("packages/runtime-three/src");
  const wallpaperRuntimePackageSources = collectWorkspaceSourceFiles("packages/wallpaper-runtime/src");
  const editorPackageSources = collectWorkspaceSourceFiles("packages/editor/src");

  const readWorkspaceSourceFile = (relativePath: string): string => (
    readFileSync(new URL(`../../../${relativePath.replace(/^\.\//, "")}`, import.meta.url), "utf8")
  );

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
    expect(zoneMap.debtEntries).toEqual([]);
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

  it("keeps Arbor CSS token references backed by ui-framework theme definitions", () => {
    const knownThemeTokens = new Set(uiThemeTokenDefinitions.map((definition) => definition.name));
    const nonThemeUiVariables = new Set([
      "--ui-menu-offset-x",
      "--ui-menu-offset-y"
    ]);
    const cssFiles = [
      "apps/wallpaper-tesseract/src/style.css",
      "apps/wallpaper-tesseract/src/app/app-shell.css",
      "apps/wallpaper-tesseract/src/window-runtime/floating-window.css",
      "apps/wallpaper-tesseract/src/window-runtime/window-frame-tab-chrome.css",
      "apps/wallpaper-tesseract/src/window-runtime/workspace-root-dock-frame.css",
      "apps/wallpaper-tesseract/src/ui-framework-fixture/ui-framework-fixture.css",
      "packages/editor/src/inspector/inspector.css",
      "packages/editor/src/scene/scene-window.css",
      "packages/editor/src/camera3/camera3-gizmo.css",
      "packages/ui-framework/src/ui/ui-framework-controls.css"
    ];
    const missing = cssFiles.flatMap((file) => {
      const source = readWorkspaceSourceFile(file);
      return [...source.matchAll(/--ui-[a-z0-9-]+/g)]
        .map((match) => match[0])
        .filter((token) => !knownThemeTokens.has(token) && !nonThemeUiVariables.has(token))
        .map((token) => `${file}: ${token}`);
    }).sort();

    expect(missing).toEqual([]);
  });

  it("keeps workspace package production imports declared in package manifests", () => {
    expect(findUndeclaredWorkspaceImports()).toEqual([]);
  });

  it("keeps Canopy package descriptors aligned with workspace manifests", () => {
    const descriptorDirectories = workspacePackageDescriptors.map((descriptor) => descriptor.directory).sort();
    const manifestDirectories = listWorkspaceManifestDirectories();

    expect(descriptorDirectories).toEqual(manifestDirectories);
    for (const descriptor of workspacePackageDescriptors) {
      expect(readWorkspacePackageManifest(descriptor).name).toBe(descriptor.name);
    }
  });

  it("uses one production source filter for Canopy package graph checks", () => {
    expect(isProductionSourceFile("packages/actor-system/src/core/index.ts")).toBe(true);
    expect(isProductionSourceFile("packages/actor-system/src/core/index.test.ts")).toBe(false);
    expect(isProductionSourceFile("apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts"))
      .toBe(false);
    expect(Object.keys(collectProductionWorkspaceSources()).every(isProductionSourceFile)).toBe(true);
  });

  it("detects undeclared workspace imports from package graph fixtures", () => {
    const descriptors = workspacePackageDescriptors.filter((descriptor) => (
      descriptor.name === "actor-system" || descriptor.name === "ui-framework"
    ));
    const manifests = new Map<string, WorkspacePackageManifest>([
      ["actor-system", { name: "actor-system" }],
      ["ui-framework", { name: "ui-framework" }]
    ]);
    const edges = [
      {
        fromFile: "packages/actor-system/src/core/index.ts",
        specifier: "ui-framework",
        resolvedFile: null,
        kind: "import" as const,
        typeOnly: false,
        sideEffectOnly: false
      },
      {
        fromFile: "packages/actor-system/src/core/self.ts",
        specifier: "actor-system/input",
        resolvedFile: null,
        kind: "import" as const,
        typeOnly: false,
        sideEffectOnly: false
      },
      {
        fromFile: "packages/ui-framework/src/external.ts",
        specifier: "three",
        resolvedFile: null,
        kind: "import" as const,
        typeOnly: false,
        sideEffectOnly: false
      }
    ];

    expect(findUndeclaredWorkspaceImports(descriptors, edges, manifests)).toEqual([
      "actor-system: packages/actor-system/src/core/index.ts imports undeclared ui-framework"
    ]);
  });

  it("keeps the workspace package manifest graph acyclic", () => {
    expect(findPackageDependencyCycles(createWorkspacePackageGraph())).toEqual([]);
  });

  it("detects package dependency cycles from manifest graph fixtures", () => {
    const acyclicDiamond: readonly WorkspacePackageGraphNode[] = [
      { name: "a", dependencies: ["b", "c"] },
      { name: "b", dependencies: ["d"] },
      { name: "c", dependencies: ["d"] },
      { name: "d", dependencies: [] }
    ];

    expect(findPackageDependencyCycles([
      { name: "a", dependencies: ["a"] }
    ])).toEqual(["a -> a"]);
    expect(findPackageDependencyCycles([
      { name: "a", dependencies: ["b"] },
      { name: "b", dependencies: ["a"] }
    ])).toEqual(["a -> b -> a"]);
    expect(findPackageDependencyCycles([
      { name: "a", dependencies: ["b"] },
      { name: "b", dependencies: ["c"] },
      { name: "c", dependencies: ["a"] }
    ])).toEqual(["a -> b -> c -> a"]);
    expect(findPackageDependencyCycles(acyclicDiamond)).toEqual([]);
  });

  it("keeps current package zones from importing forbidden owners", () => {
    expect(evaluatePackageDependencyRules(
      workspacePackageDescriptors,
      currentPackageDependencyRules
    )).toEqual([]);
  });

  it("keeps every non-app workspace package covered by a package dependency rule", () => {
    const explicitExemptions = new Set(["wallpaper-tesseract"]);
    const rulePackages = new Set(currentPackageDependencyRules.map((rule) => rule.sourcePackage));
    const missingRules = workspacePackageDescriptors
      .filter((descriptor) => !explicitExemptions.has(descriptor.name))
      .map((descriptor) => descriptor.name)
      .filter((packageName) => !rulePackages.has(packageName))
      .sort();

    expect(missingRules).toEqual([]);
  });

  it("detects forbidden package-zone imports from bare and resolved relative edges", () => {
    const descriptors = workspacePackageDescriptors.filter((descriptor) => (
      descriptor.name === "actor-system" || descriptor.name === "ui-framework"
    ));
    const edges = [
      {
        fromFile: "packages/actor-system/src/core/bare.ts",
        specifier: "ui-framework",
        resolvedFile: null,
        kind: "import" as const,
        typeOnly: false,
        sideEffectOnly: false
      },
      {
        fromFile: "packages/actor-system/src/core/relative.ts",
        specifier: "../../ui-framework/src/index",
        resolvedFile: "packages/ui-framework/src/index.ts",
        kind: "import" as const,
        typeOnly: false,
        sideEffectOnly: false
      }
    ];

    expect(evaluatePackageDependencyRules(descriptors, [
      { sourcePackage: "actor-system", forbiddenPackages: ["ui-framework"] }
    ], edges)).toEqual([
      {
        sourcePackage: "actor-system",
        fromFile: "packages/actor-system/src/core/bare.ts",
        targetPackage: "ui-framework",
        specifier: "ui-framework"
      },
      {
        sourcePackage: "actor-system",
        fromFile: "packages/actor-system/src/core/relative.ts",
        targetPackage: "ui-framework",
        specifier: "../../ui-framework/src/index"
      }
    ]);
  });

  it("keeps real actor-system submodules inside their allowed dependency direction", () => {
    const actorSystemSources = collectProductionWorkspaceSources(
      workspacePackageDescriptors.filter((descriptor) => descriptor.name === "actor-system")
    );
    const zones = [
      defineSubmoduleZone("actor-system/core", "packages/actor-system/src/core/"),
      defineSubmoduleZone("actor-system/input", "packages/actor-system/src/input/"),
      defineSubmoduleZone("actor-system/gizmo", "packages/actor-system/src/gizmo/")
    ];
    const rules = [
      {
        sourceZone: "actor-system/core",
        forbiddenTargetZones: ["actor-system/input", "actor-system/gizmo"],
        forbiddenRootPackages: ["actor-system"]
      },
      {
        sourceZone: "actor-system/input",
        forbiddenRootPackages: ["actor-system"]
      },
      {
        sourceZone: "actor-system/gizmo",
        forbiddenTargetZones: ["actor-system/core", "actor-system/input"],
        forbiddenRootPackages: ["actor-system"]
      }
    ];

    expect(evaluateSubmoduleDependencyRules(actorSystemSources, zones, rules)).toEqual([]);
  });

  it("proves future actor-system submodule rules catch root and relative bypass imports", () => {
    const zones = [
      defineSubmoduleZone("actor-system/core", "packages/actor-system/src/core/"),
      defineSubmoduleZone("actor-system/input", "packages/actor-system/src/input/"),
      defineSubmoduleZone("actor-system/gizmo", "packages/actor-system/src/gizmo/"),
      defineSubmoduleZone("ui-framework", "packages/ui-framework/src/")
    ];
    const rules = [
      {
        sourceZone: "actor-system/core",
        forbiddenTargetZones: ["actor-system/input", "actor-system/gizmo", "ui-framework"],
        forbiddenRootPackages: ["actor-system"]
      },
      {
        sourceZone: "actor-system/input",
        forbiddenTargetZones: ["ui-framework"],
        forbiddenRootPackages: ["actor-system"]
      },
      {
        sourceZone: "actor-system/gizmo",
        forbiddenTargetZones: ["actor-system/core", "actor-system/input", "ui-framework"],
        forbiddenRootPackages: ["actor-system"]
      }
    ];
    const files = {
      "packages/actor-system/src/core/bare.ts": 'import { input } from "actor-system/input";',
      "packages/actor-system/src/core/relative.ts": 'import { input } from "../input";',
      "packages/actor-system/src/core/deep-relative.ts": 'import { input } from "../input/foo";',
      "packages/actor-system/src/core/root.ts": 'import { ActorSystem } from "actor-system";',
      "packages/actor-system/src/gizmo/nested/deep-relative.ts": 'import { input } from "../../input/foo";',
      "packages/actor-system/src/input/root.ts": 'import { ActorSystem } from "actor-system";',
      "packages/actor-system/src/input/ui.ts": 'import { ui } from "../../../ui-framework/src/index";',
      "packages/actor-system/src/input/allowed.ts": 'import { core } from "../core"; import { gizmo } from "../gizmo";',
      "packages/actor-system/src/input/foo.ts": "export const input = 1;",
      "packages/actor-system/src/input/index.ts": "export const input = 1;",
      "packages/actor-system/src/core/index.ts": "export const core = 1;",
      "packages/actor-system/src/gizmo/index.ts": "export const gizmo = 1;",
      "packages/ui-framework/src/index.ts": "export const ui = 1;"
    };

    expect(evaluateSubmoduleDependencyRules(files, zones, rules)).toEqual([
      {
        fromFile: "packages/actor-system/src/core/bare.ts",
        sourceZone: "actor-system/core",
        target: "actor-system/input",
        specifier: "actor-system/input"
      },
      {
        fromFile: "packages/actor-system/src/core/deep-relative.ts",
        sourceZone: "actor-system/core",
        target: "actor-system/input",
        specifier: "../input/foo"
      },
      {
        fromFile: "packages/actor-system/src/core/relative.ts",
        sourceZone: "actor-system/core",
        target: "actor-system/input",
        specifier: "../input"
      },
      {
        fromFile: "packages/actor-system/src/core/root.ts",
        sourceZone: "actor-system/core",
        target: "actor-system",
        specifier: "actor-system"
      },
      {
        fromFile: "packages/actor-system/src/gizmo/nested/deep-relative.ts",
        sourceZone: "actor-system/gizmo",
        target: "actor-system/input",
        specifier: "../../input/foo"
      },
      {
        fromFile: "packages/actor-system/src/input/root.ts",
        sourceZone: "actor-system/input",
        target: "actor-system",
        specifier: "actor-system"
      },
      {
        fromFile: "packages/actor-system/src/input/ui.ts",
        sourceZone: "actor-system/input",
        target: "ui-framework",
        specifier: "../../../ui-framework/src/index"
      }
    ]);
  });

  it("keeps Gate 7 theme CSS raw style debt tokenized or explicitly allowlisted", () => {
    const rawStyleAllowlist = [
      {
        file: "packages/editor/src/camera3/camera3-gizmo.css",
        value: "rgba(0, 0, 0, 0.42)",
        owner: "Camera3 gizmo renderer",
        reason: "Canvas affordance drop-shadow is product visual depth, not generic UI chrome."
      },
      {
        file: "packages/editor/src/camera3/camera3-gizmo.css",
        value: "rgba(0, 0, 0, 0.85)",
        owner: "Camera3 gizmo renderer",
        reason: "Mode label text-shadow is product overlay readability over a 3D viewport."
      }
    ];
    const allowlistKeys = new Set(rawStyleAllowlist.map((entry) => `${entry.file}: ${entry.value}`));
    for (const entry of rawStyleAllowlist) {
      expect(entry.owner.length).toBeGreaterThan(5);
      expect(entry.reason.length).toBeGreaterThan(20);
    }
    const cssFiles = [
      "apps/wallpaper-tesseract/src/style.css",
      "apps/wallpaper-tesseract/src/app/app-shell.css",
      "apps/wallpaper-tesseract/src/window-runtime/floating-window.css",
      "apps/wallpaper-tesseract/src/window-runtime/window-frame-tab-chrome.css",
      "apps/wallpaper-tesseract/src/window-runtime/workspace-root-dock-frame.css",
      "apps/wallpaper-tesseract/src/ui-framework-fixture/ui-framework-fixture.css",
      "packages/editor/src/inspector/inspector.css",
      "packages/editor/src/scene/scene-window.css",
      "packages/editor/src/camera3/camera3-gizmo.css",
      "packages/ui-framework/src/ui/ui-framework-controls.css"
    ];
    const uncovered = cssFiles.flatMap((file) => {
      const source = readWorkspaceSourceFile(file);
      return [...source.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)]
        .map((match) => match[0])
        .filter((value) => !allowlistKeys.has(`${file}: ${value}`))
        .map((value) => `${file}: ${value}`);
    }).sort();

    expect(uncovered).toEqual([]);
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
        edge.specifier === "actor-system/gizmo" ||
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
        .filter(([file]) => file.includes("/src/") && !file.startsWith("packages/editor/"))
    );
    const forbiddenAppLayerImports = listModuleEdges(productionPackageSources)
      .filter((edge) => (
        edge.specifier.includes("wallpaper-tesseract") ||
        edge.specifier === "ui-framework" ||
        edge.specifier === "editor" ||
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
        /from\s+["'](?:three|actor-system\/gizmo)["']/.test(source) ||
        /\b(?:HTMLElement|Document|window)\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();
    const runtimeThreeViolations = Object.entries(productionPackageSources)
      .filter(([file]) => file.startsWith("packages/four-camera-three/src/"))
      .filter(([, source]) => (
        /from\s+["'](?:actor-system\/gizmo)["']/.test(source) ||
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
        edge.specifier === "actor-system/gizmo" ||
        edge.specifier === "actor-system/input" ||
        edge.specifier === "ui-framework" ||
        edge.specifier === "editor" ||
        edge.specifier.includes("wallpaper-tesseract") ||
        edge.specifier === "wallpaper-runtime" ||
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
    const wallpaperRuntimeTarget = projectPrismPackageTargets.find((target) => target.id === "wallpaper-runtime");

    expect(runtimeContractsTarget).toMatchObject({
      extractionStatus: "allowed",
      blockedBy: [],
      cleanCandidateZones: ["runtime-core-candidate"]
    });
    expect(runtimeOwnershipTarget).toMatchObject({
      extractionStatus: "allowed",
      blockedBy: [],
      cleanCandidateZones: ["wallpaper-runtime-candidate"]
    });
    expect(runtimeOwnershipTarget?.blockedBy).not.toContain("runtime-adapter-debt");
    expect(runtimeOwnershipTarget?.blockedBy).not.toContain("state-domain-debt");
    expect(runtimeThreeBackendTarget).toMatchObject({
      extractionStatus: "allowed",
      blockedBy: [],
      cleanCandidateZones: ["runtime-three-candidate"]
    });
    expect(runtimeRenderOwnershipTarget).toMatchObject({
      extractionStatus: "allowed",
      blockedBy: [],
      cleanCandidateZones: ["wallpaper-runtime-candidate", "runtime-three-candidate"]
    });
    expect(wallpaperRuntimeTarget).toMatchObject({
      extractionStatus: "allowed",
      cleanCandidateZones: ["wallpaper-runtime-candidate"],
      debtZones: [],
      blockedBy: []
    });
  });

  it("allows Phase 6 after the window workspace graph gate is proven", () => {
    const uiFrameworkTarget = projectPrismPackageTargets.find((target) => target.id === "ui-framework");
    const editorTarget = projectPrismPackageTargets.find((target) => target.id === "editor");
    const smokeContractSource = sourceFiles["./test-support/project-prism-smoke-contract.ts"] ?? "";
    const smokeEvidenceFileTestSource =
      sourceFiles["./test-support/project-prism-smoke-evidence-file.test.ts"] ?? "";

    expect(projectPrismPrePhase6UiFrameworkBlockers).toEqual([]);
    expect(smokeContractSource).toMatch(/\bProjectPrismGraphSnapshotEvidence\b/);
    expect(smokeContractSource).toMatch(/\bProjectPrismDomEvidence\b/);
    expect(smokeContractSource).toMatch(/\bProjectPrismPersistenceEvidence\b/);
    expect(smokeEvidenceFileTestSource).toMatch(/\bPROJECT_PRISM_SMOKE_EVIDENCE\b/);
    expect(uiFrameworkTarget).toMatchObject({
      extractionStatus: "allowed",
      blockedBy: []
    });
    expect(editorTarget).toMatchObject({
      extractionStatus: "allowed",
      blockedBy: []
    });
  });

  it("keeps editor package on package contracts instead of app-local runtime glue", () => {
    const editorPackageEdges = listModuleEdges(editorPackageSources);
    const forbiddenImports = editorPackageEdges
      .filter((edge) => (
        edge.specifier.includes("wallpaper-tesseract") ||
        edge.specifier.includes("window-runtime") ||
        edge.specifier.includes("runtime/ports") ||
        edge.specifier.includes("actor-runtime") ||
        edge.specifier.includes("app-runtime") ||
        edge.specifier.startsWith("../apps/") ||
        edge.specifier.startsWith("../../apps/") ||
        edge.specifier.startsWith("../../../apps/")
      ))
      .map((edge) => `${edge.fromFile}: ${edge.specifier}`)
      .sort();
    const zoneMap = createSourceZoneMap(editorPackageSources, projectPrismSourceZones);

    expect(zoneMap.unclassified).toEqual([]);
    expect(zoneMap.ambiguousCandidateFiles).toEqual([]);
    expect(forbiddenImports).toEqual([]);
    expect(evaluateZoneDependencyMatrix(
      editorPackageSources,
      projectPrismSourceZones,
      projectPrismZoneDependencyRules
    )).toEqual([]);
  });

  it("keeps wallpaper-runtime production package independent from editor, UI, features, app composition, and DOM ownership", () => {
    const packageSources = collectWorkspaceSourceFiles("packages");
    const wallpaperRuntimeSources = Object.fromEntries(
      Object.entries(packageSources)
        .filter(([file]) => file.startsWith("packages/wallpaper-runtime/src/"))
    );
    const forbiddenImports = listModuleEdges(wallpaperRuntimeSources)
      .filter((edge) => (
        edge.specifier === "editor" ||
        edge.specifier === "ui-framework" ||
        edge.specifier.includes("wallpaper-tesseract") ||
        edge.specifier.includes("window-runtime") ||
        edge.specifier.includes("features/") ||
        edge.specifier.includes("features\\") ||
        edge.specifier.includes("/app/") ||
        edge.specifier.includes("\\app\\")
      ))
      .map((edge) => `${edge.fromFile}: ${edge.specifier}`)
      .sort();
    const forbiddenSymbols = Object.entries(wallpaperRuntimeSources)
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => (
        /\b(?:HTMLElement|HTMLCanvasElement|Document|Window|window)\b/.test(source) ||
        /\b(?:WindowViewKey|WindowViewLocationSource|tabset|dockTarget|EditorSceneViewHost)\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();

    expect(forbiddenImports).toEqual([]);
    expect(forbiddenSymbols).toEqual([]);
    expect(evaluateZoneDependencyMatrix(
      wallpaperRuntimeSources,
      projectPrismSourceZones,
      projectPrismZoneDependencyRules
    )).toEqual([]);
  });

  it("keeps runtime-three backend package editor-free and UI-free", () => {
    const runtimeThreePackageEdges = listModuleEdges(runtimeThreePackageSources);
    const forbiddenImports = runtimeThreePackageEdges
      .filter((edge) => (
        edge.specifier === "actor-system/gizmo" ||
        edge.specifier === "actor-system/input" ||
        edge.specifier === "ui-framework" ||
        edge.specifier === "editor" ||
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

  it("keeps Phase 10 runtime ownership package-owned after app-local staging deletion", () => {
    expect(projectPrismSourceZones.map((zone) => zone.id)).toContain("wallpaper-runtime-candidate");
    expect(projectPrismSourceZones.map((zone) => zone.id)).toContain("wallpaper-scene-integration");
    expect(projectPrismSourceZones.map((zone) => zone.id)).not.toContain("runtime-ownership-debt");
    expect(projectPrismRuntimeExtractionBlockers).toEqual([]);
    expect(sourceFiles["./runtime/runtime-scene-content.ts"]).toBeUndefined();
    expect(sourceFiles["./runtime/runtime-scene-frame-source.ts"]).toBeUndefined();
    expect(sourceFiles["./runtime/runtime-scene-view-runtime.ts"]).toBeUndefined();
  });

  it("keeps UI framework extraction blockers explicit until UI-owned state and surface contracts exist", () => {
    const zoneMap = createSourceZoneMap(sourceFiles, projectPrismSourceZones);
    const zonesByFile = new Map(zoneMap.entries.map((entry) => [entry.file, entry.zones.map((zone) => zone.id)]));
    const combinedSourceFiles = {
      ...sourceFiles,
      ...uiFrameworkPackageSources
    };
    const uiFrameworkBlockers = [
      ...projectPrismUiFrameworkExtractionBlockers,
      ...projectPrismPrePhase6UiFrameworkBlockers
    ];
    const missingFiles = uiFrameworkBlockers
      .flatMap((blocker) => blocker.files)
      .filter((file) => combinedSourceFiles[file] === undefined)
      .sort();
    const unclassifiedBlockerFiles = projectPrismUiFrameworkExtractionBlockers
      .flatMap((blocker) => blocker.files)
      .filter((file) => !(zonesByFile.get(file) ?? []).includes("ui-state-binding-debt"))
      .sort();
    const incompleteBlockers = uiFrameworkBlockers
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

  it("keeps app composition extraction blockers closed once owner installers own concrete policy", () => {
    const zoneMap = createSourceZoneMap(sourceFiles, projectPrismSourceZones);
    const missingFiles = projectPrismAppCompositionBlockers
      .flatMap((blocker) => blocker.files)
      .filter((file) => sourceFiles[file] === undefined)
      .sort();
    const incompleteBlockers = projectPrismAppCompositionBlockers
      .filter((blocker) => (
        blocker.blocker.length < 20 ||
        blocker.deletionCondition.length < 20
      ))
      .map((blocker) => blocker.id)
      .sort();

    expect(missingFiles).toEqual([]);
    expect(incompleteBlockers).toEqual([]);
    expect(projectPrismAppCompositionBlockers).toEqual([]);
    expect(projectPrismDebtBlockers).toEqual([]);
    expect(zoneMap.debtEntries).toEqual([]);
  });

  it("keeps Project Prism legacy locks paired with replacement contracts", () => {
    const actorInputRouterSource = actorSystemInputSources["packages/actor-system/src/input/actor-input-router.ts"] ?? "";
    const renderableSceneViewSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/scene/runtime-scene-frame-source.ts"] ?? "";
    const dockTargetRegionSource =
      uiFrameworkPackageSources["packages/ui-framework/src/ports/dock-target-region-source.ts"] ?? "";
    const frameTargetabilitySource =
      uiFrameworkPackageSources["packages/ui-framework/src/ports/window-frame-targetability-source.ts"] ?? "";
    const persistenceSource =
      uiFrameworkPackageSources["packages/ui-framework/src/model/window-workspace-layout-persistence.ts"] ?? "";

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
    expect(dockTargetRegionSource).toMatch(/\bgraphProjection\b/);
    expect(dockTargetRegionSource).toMatch(/\bWindowFrameTargetabilitySource\b/);
    expect(dockTargetRegionSource).not.toMatch(/\b(?:getRuntimeDockRoot|listDockTargetTabsets|getFloatingBounds)\b/);
    expect(dockTargetRegionSource).not.toMatch(/\bWindowFramePortRegistryView\b/);
    expect(frameTargetabilitySource).toMatch(/\bWindowFrameTargetabilitySource\b/);
    expect(frameTargetabilitySource).toMatch(/\bWindowFramePortRegistryView\b/);
    expect(frameTargetabilitySource).not.toMatch(/\b(?:getRuntimeDockRoot|listDockTargetTabsets|getContentHost|addTab|splitTab|removeTab|activateTab)\b/);

    expect(findForbiddenSourceMatches(
      /\b(?:WindowWorkspaceLayout|createWindowWorkspaceLayout|dockWindowAsTab|findDockTabsetContaining|normalizeWindowWorkspaceLayout|removeWindowFromDock|removeWindowFromLayout|setActiveDockTab|splitDockTab|undockWindow)\b/
    )).toEqual([]);
    expect(persistenceSource).toMatch(/\btypeKey:\s*WindowViewTypeKey\b/);
    expect(persistenceSource).toMatch(/\binstanceId:\s*WindowViewInstanceId\b/);
    expect(persistenceSource).not.toMatch(/\b(?:viewActorId|frameActorId|actorId)\b/);

    expect(sourceFiles["./window-runtime/window-control-source.ts"]).toBeUndefined();
    expect(sourceFiles["./window-runtime/window-menu-view-source.ts"]).toBeUndefined();
    expect(sourceFiles["./window-runtime/window-visibility-activation-controller.ts"]).toBeUndefined();
    expect(uiFrameworkPackageSources["packages/ui-framework/src/model/app-menu-model.ts"]).toBeUndefined();
  });

  it("keeps Project Prism app composition debt from reaching back into concrete internals", () => {
    const appCompositionFiles = new Set([
      "./app/create-wallpaper-app.ts",
      "./features/scene-run-mode-command.ts",
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
      /^\.\/tesseract4\/components\/tesseract4-actor-factory\.ts$/
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
        edge.specifier.includes("runtime/camera3") ||
        edge.specifier.includes("runtime/tesseract4") ||
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
        edge.resolvedFile!.startsWith("./runtime/camera3/") ||
        edge.resolvedFile!.startsWith("./runtime/tesseract4/") ||
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

  it("removes AppRuntimeContext runtime/gizmo registration names", () => {
    expect(findForbiddenSourceMatches(
      /\bregister(?:Legacy)?(?:RuntimeObject|GizmoObject|StatefulGizmoObject)\b/
    )).toEqual([]);
  });

  it("keeps demo from directly constructing gizmo UI objects before actor factories", () => {
    const demoSource = sourceFiles["./demo.ts"] ?? "";

    expect(demoSource).not.toMatch(/\bnew\s+(DebugLogWindow|Camera3Gizmo|Tesseract4RuntimeObject)\s*\(/);
  });

  it("keeps Debug and Hierarchy full-window legacy surfaces deleted", () => {
    const combinedSources = {
      ...sourceFiles,
      ...editorPackageSources
    };
    const debugIndexSource = editorPackageSources["packages/editor/src/debug/index.ts"] ?? "";
    const oldFullWindowFactories =
      /\b(?:createDebugLogWindowActor|DebugLogWindowActorOptions|createHierarchyPanelActor|HierarchyPanelActorOptions)\b/;
    const fullWindowFactoryViolations = Object.entries(combinedSources)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts")
      ))
      .filter(([, source]) => oldFullWindowFactories.test(source))
      .map(([file]) => file)
      .sort();

    expect(findForbiddenSourceMatches(
      /\bGizmoDebugPanel\b|gizmo-debug-panel|(?:from\s+["'](?:\.\/|\.\.\/)debug-log-window["'])|(?:new\s+DebugLogWindow\s*\()|(?:debug\/legacy)/
    )).toEqual([]);
    expect(editorPackageSources["packages/editor/src/debug/components/debug-log-window-actor-factory.ts"] ?? "").not.toMatch(
      /(?:from\s+["']\.\.\/debug-log-window["'])|(?:new\s+DebugLogWindow\s*\()/
    );
    expect(editorPackageSources["packages/editor/src/debug/components/debug-log-content-component.ts"] ?? "").not.toMatch(
      /(?:from\s+["']\.\.\/debug-log-window["'])|(?:new\s+DebugLogWindow\s*\()/
    );
    expect(debugIndexSource).not.toMatch(/\bcreateDebugLogWindow\b/);
    expect(debugIndexSource).not.toMatch(/\bGizmoDebugPanel\b/);
    expect(debugIndexSource).toMatch(/\bcreateDebugLogViewActor\b/);
    expect(editorPackageSources["packages/editor/src/debug/components/index.ts"] ?? "").not.toMatch(/\bcreateDebugLogWindowActor\b/);
    expect(editorPackageSources["packages/editor/src/hierarchy/index.ts"] ?? "").not.toMatch(/\bcreateHierarchyPanelActor\b/);
    expect(debugIndexSource).toMatch(/\bcreateDefaultDebugWindowState\b/);
    expect(debugIndexSource).toMatch(/\bregisterDebugWindowParameters\b/);
    expect(fullWindowFactoryViolations).toEqual([]);
  });

  it("keeps Debug Log on generic VirtualListView instead of monolithic or per-log actor rendering", () => {
    const debugContentSource =
      editorPackageSources["packages/editor/src/debug/components/debug-log-content-component.ts"] ?? "";
    const debugDefinitionSource =
      editorPackageSources["packages/editor/src/debug/components/debug-log-content-definition.ts"] ?? "";
    const debugFactorySource =
      editorPackageSources["packages/editor/src/debug/components/debug-log-window-actor-factory.ts"] ?? "";
    const debugPackageJson = readWorkspaceSourceFile("packages/editor/package.json");
    const appStylesSource = sourceFiles["./app/styles.ts"] ?? "";
    const listViewSource =
      uiFrameworkPackageSources["packages/ui-framework/src/ui/collection/list-view-component.ts"] ?? "";
    const listViewDefinitionSource =
      uiFrameworkPackageSources["packages/ui-framework/src/ui/collection/list-view-definition.ts"] ?? "";
    const virtualListSource =
      uiFrameworkPackageSources["packages/ui-framework/src/ui/collection/virtual-list-view-component.ts"] ?? "";
    const toolWindowInstallerSource =
      editorPackageSources["packages/editor/src/tool-windows/install-tool-window-features.ts"] ?? "";

    expect(debugContentSource).not.toMatch(/createElement\s*\(\s*["']pre["']/);
    expect(debugContentSource).not.toMatch(/textContent\s*=\s*.*\.join\s*\(/);
    expect(debugContentSource).not.toMatch(/\bListViewComponent\b/);
    expect(debugContentSource).toMatch(/\bVirtualListViewComponent\b/);
    expect(debugContentSource).toMatch(/\bScrollViewComponent\b/);
    expect(debugContentSource).not.toMatch(/\bDebugLogEntryActorReconciler\b/);
    expect(debugDefinitionSource).toMatch(/\buiElementComponentType\b/);
    expect(debugDefinitionSource).toMatch(/\bscrollViewComponentType\b/);
    expect(debugDefinitionSource).toMatch(/\bvirtualListViewComponentType\b/);
    expect(debugDefinitionSource).not.toMatch(/\blistViewComponentType\b/);
    expect(debugFactorySource).toMatch(/\buiElementComponentType\b/);
    expect(debugFactorySource).toMatch(/\bscrollViewComponentType\b/);
    expect(debugFactorySource).toMatch(/\bvirtualListViewComponentType\b/);
    expect(debugFactorySource).toMatch(/\bDebugLogDataSource\b/);
    expect(debugFactorySource).not.toMatch(/\blistViewComponentType\b/);
    expect(debugPackageJson).not.toMatch(/debug\/debug-log\.css/);
    expect(appStylesSource).not.toMatch(/editor\/debug\/debug-log\.css/);
    expect(listViewSource).not.toMatch(/actor-input|ActorInputParticipant|hitTestInput|onInputEnd/);
    expect(listViewSource).not.toMatch(/FrameUpdateParticipant|updateFrame/);
    expect(listViewDefinitionSource).not.toMatch(/frameUpdateAttachment|attachments/);
    expect(virtualListSource).not.toMatch(/Debug|Hierarchy|WindowWorkspace|Scene|Camera3|Tesseract|wallpaper/);
    expect(toolWindowInstallerSource).not.toMatch(/\bisDebugLogEntryActorId\b/);
  });

  it("keeps hierarchy pointer selection on generic TreeView actor input instead of local row mutation", () => {
    const source = editorPackageSources["packages/editor/src/hierarchy/hierarchy-panel-component.ts"] ?? "";
    const definitionSource = editorPackageSources["packages/editor/src/hierarchy/hierarchy-panel-definition.ts"] ?? "";
    const treeViewSource = uiFrameworkPackageSources["packages/ui-framework/src/ui/collection/tree-view-component.ts"] ?? "";

    expect(source).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(source).not.toMatch(/\.onclick\s*=/);
    expect(source).not.toMatch(/\bActorInputParticipant\b/);
    expect(source).not.toMatch(/\bhitTestInput\b/);
    expect(source).not.toMatch(/\bonInputEnd\b/);
    expect(definitionSource).not.toMatch(/\bgizmoEventBindingComponentType\b/);
    expect(source).toMatch(/\bTreeViewActivation\b/);
    expect(source).toMatch(/\bactivateTreeItem\b/);
    expect(treeViewSource).toMatch(/\bActorInputParticipant\b/);
    expect(treeViewSource).toMatch(/\bhitTestInput\b/);
    expect(treeViewSource).toMatch(/\bonInputEnd\b/);
  });

  it("keeps production hierarchy rows actor-backed instead of static app lists", () => {
    const allowedFiles = new Set([
      "packages/editor/src/hierarchy/hierarchy-object-source.ts"
    ]);
    const combinedSources = {
      ...sourceFiles,
      ...editorPackageSources
    };
    const staticSourceCallViolations = Object.entries(combinedSources)
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts") &&
        !allowedFiles.has(file)
      ))
      .filter(([, source]) => /\bcreateStaticHierarchyObjectSource\s*\(/.test(source))
      .map(([file]) => file)
      .sort();
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const productFeatureSource = sourceFiles["./features/install-wallpaper-product-features.ts"] ?? "";

    expect(staticSourceCallViolations).toEqual([]);
    expect(appSource).not.toMatch(/\bcreateActorHierarchyObjectSource\b/);
    expect(productFeatureSource).not.toMatch(/\bcreateActorHierarchyObjectSource\b/);
    expect(productFeatureSource).not.toMatch(/\bcreateSceneActorHierarchyMetadata\b/);
    expect(productFeatureSource).not.toMatch(/\bcreateToolWindowActorHierarchyMetadata\b/);
    expect(productFeatureSource).not.toMatch(/\bcreateAppMenuActorHierarchyMetadata\b/);
    expect(productFeatureSource).not.toMatch(/\bmetadataByActorId\b/);
    expect(productFeatureSource).not.toMatch(/\bSCENE_WINDOW_ACTOR_ID\b/);
    expect(productFeatureSource).not.toMatch(/\bTESSERACT4_ACTOR_ID\b/);
    expect(productFeatureSource).not.toMatch(/\bCAMERA3_GIZMO_ACTOR_ID\b/);
    expect(productFeatureSource).not.toMatch(/\bDEBUG_LOG_WINDOW_ACTOR_ID\b/);
    expect(productFeatureSource).not.toMatch(/\bHIERARCHY_PANEL_ACTOR_ID\b/);
    expect(productFeatureSource).not.toMatch(/\bAPP_MENU_BAR_ACTOR_ID\b/);
  });

  it("keeps hierarchy source ownership inside tool-window features without product override hooks", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const toolWindowInstallerSource =
      editorPackageSources["packages/editor/src/tool-windows/install-tool-window-features.ts"] ?? "";
    const toolWindowIndexSource =
      editorPackageSources["packages/editor/src/tool-windows/index.ts"] ?? "";

    expect(sourceFiles["./features/install-wallpaper-product-features.ts"]).toBeUndefined();
    expect(appSource).not.toMatch(/\bhierarchyObjectSource\b/);
    expect(appSource).not.toMatch(/\bcreateActorHierarchyObjectSource\b/);
    expect(toolWindowInstallerSource).toMatch(/\bcreateActorHierarchyObjectSource\s*\(/);
    expect(toolWindowInstallerSource).not.toMatch(/\bToolWindowActorIds\b/);
    expect(toolWindowInstallerSource).not.toMatch(/\bactorIds\??\s*:/);
    expect(toolWindowInstallerSource).not.toMatch(/\bdebugLogLabel\b/);
    expect(toolWindowInstallerSource).not.toMatch(/\bhierarchyLabel\b/);
    expect(toolWindowInstallerSource).not.toMatch(/\bhierarchyObjectSource\??\s*:/);
    expect(toolWindowIndexSource).not.toMatch(/\bToolWindowActorIds\b/);
    expect(toolWindowIndexSource).not.toMatch(/\bcreateToolWindowActorHierarchyMetadata\b/);
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
    const combinedSources = {
      ...sourceFiles,
      ...editorPackageSources
    };
    const windowAndHierarchyOnGizmoViolations = Object.entries(combinedSources)
      .filter(([file]) => file.startsWith("./window-runtime/") || file.startsWith("packages/editor/src/hierarchy/"))
      .filter(([, source]) => /\bonGizmo(?:Start|Move|End|Cancel|Click|DoubleClick)\b/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
    expect(windowAndHierarchyOnGizmoViolations).toEqual([]);
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
    const renderableSceneViewSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/scene/runtime-scene-frame-source.ts"] ?? "";
    const runtimeSceneViewRuntimeSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/scene/runtime-scene-view-runtime.ts"] ?? "";
    const runtimeSceneContentSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/scene/runtime-scene-content.ts"] ?? "";
    const wallpaperRuntimePublicIndexSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/index.ts"] ?? "";
    const runtimeThreeRenderOutputSource =
      runtimeThreePackageSources["packages/runtime-three/src/runtime-three-scene-render-output.ts"] ?? "";
    const sceneWindowActorFactorySource =
      editorPackageSources["packages/editor/src/scene/scene-window-actor-factory.ts"] ?? "";
    const uiViewportSource = [
      uiFrameworkPackageSources["packages/ui-framework/src/ui/viewport/render-viewport-component.ts"] ?? "",
      uiFrameworkPackageSources["packages/ui-framework/src/ui/viewport/fullscreenable-view-component.ts"] ?? ""
    ].join("\n");

    expect(appSource).not.toMatch(/\bnew\s+THREE\.WebGLRenderer\b/);
    expect(appSource).not.toMatch(/replaceChildren\s*\(\s*renderer\.domElement\s*\)/);
    expect(appSource).not.toMatch(/\bnew\s+SceneViewRuntime\b/);
    expect(sourceFiles["./runtime/scene-render-output.ts"]).toBeUndefined();
    expect(runtimeThreeRenderOutputSource).toMatch(/\bRuntimeThreeSceneRenderOutput\b/);
    expect(runtimeThreeRenderOutputSource).toMatch(/\bcreateRuntimeThreeSceneRenderOutput\b/);
    expect(runtimeThreeRenderOutputSource).not.toMatch(/\b(?:RuntimeSceneRenderOutput|createRuntimeSceneRenderOutput)\b/);
    expect(sourceFiles["./features/install-wallpaper-product-features.ts"]).toBeUndefined();
    expect(appSource).not.toMatch(/\binstallWallpaperProductFeatures\b/);
    expect(appSource).toMatch(/\binstallSceneViewFeature\b/);
    expect(appSource).not.toMatch(/\binstallSceneViewContent\b/);
    expect(appSource).not.toMatch(/\bcreateRenderableSceneView\b/);
    expect(appSource).not.toMatch(/\bCurrentRenderableSceneViewRegistry\b/);
    expect(appSource).not.toMatch(/productFeatures\.renderFrameSources\(\)/);
    expect(appSource).toMatch(/runtimeSceneViews\.renderCurrentFrameSource\(\)/);
    expect(appSource).not.toMatch(/renderableSceneViews/);
    expect(appSource).not.toMatch(/\bCurrentSceneViewSource\b|\bcurrentSceneView\b|\bSceneViewRuntime\b/);
    expect(appSource).not.toMatch(/\bmeasureSceneViewport\b/);
    expect(appSource).not.toMatch(/window\.addEventListener\s*\(\s*["']resize["']/);
    expect(appSource).toMatch(/\bmeasureScenePresentationAfterVisibilityChange\b/);
    expect(appSource).not.toMatch(/\bcreateSceneWindowActor\b/);
    expect(appSource).not.toMatch(/sceneWindow\.viewport\.render/);
    expect(appSource).not.toMatch(/sceneView\.viewport\.render/);
    expect(renderableSceneViewSource).toMatch(/\binterface RenderableSceneView\b/);
    expect(renderableSceneViewSource).toMatch(/\bisRenderable\s*\(\)\s*:\s*boolean/);
    expect(renderableSceneViewSource).toMatch(/\brender\s*\(\)\s*:\s*void/);
    expect(renderableSceneViewSource).not.toMatch(/\bdispose/);
    expect(sourceFiles["./features/scene/renderable-scene-view.ts"]).toBeUndefined();
    expect(sourceFiles["./features/scene/scene-view-content-installer.ts"]).toBeUndefined();
    expect(sourceFiles["./runtime/runtime-scene-session.ts"]).toBeUndefined();
    expect(sceneFeatureInstallerSource).not.toMatch(/\binstallSceneViewContent\b/);
    expect(sceneFeatureInstallerSource).toMatch(/\bcreateSceneViewActor\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bcreateRuntimeSceneSession\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bcreateRuntimeSceneContent\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bcreateRuntimeSceneViewRuntime\b/);
    expect(sceneFeatureInstallerSource).toMatch(/\bruntimeSceneViews\.createRuntime\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bcreateEditorSceneViewHost\b/);
    expect(sceneFeatureInstallerSource).toMatch(/\bcreateSceneRenderViewPresentation\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bcreateRenderableSceneView\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bSceneViewFrameSourceRegistry\b/);
    expect(runtimeSceneViewRuntimeSource).toMatch(/\bcreateRenderableSceneView\b/);
    expect(runtimeSceneViewRuntimeSource).toMatch(/\bSceneViewFrameSourceRegistry\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bCurrentRenderableSceneViewRegistry\b/);
    expect(runtimeSceneContentSource).toMatch(/\bcreateRuntimeSceneContent\b/);
    expect(wallpaperRuntimePublicIndexSource).toMatch(/\bRuntimeSceneViewRuntimeRegistry\b/);
    expect(wallpaperRuntimePublicIndexSource).toMatch(/\binstallWallpaperRuntimeComponentDefinitions\b/);
    expect(runtimeSceneViewRuntimeSource).not.toMatch(/\bexport\s+class\s+RuntimeSceneViewRuntime\b/);
    expect(wallpaperRuntimePublicIndexSource).not.toMatch(/export\s*\{[^}]*\bRuntimeSceneViewRuntime\b/);
    expect(wallpaperRuntimePublicIndexSource).not.toMatch(/\bcreateRuntimeSceneContent\b/);
    expect(wallpaperRuntimePublicIndexSource).not.toMatch(/\bcreateRenderableSceneView\b/);
    expect(wallpaperRuntimePublicIndexSource).not.toMatch(/\bSceneViewFrameSourceRegistry\b/);
    expect(wallpaperRuntimePublicIndexSource).not.toMatch(/\bcamera3MotionComponentDefinition\b/);
    expect(wallpaperRuntimePublicIndexSource).not.toMatch(/\btesseract4ComponentDefinition\b/);
    expect(wallpaperRuntimePublicIndexSource).not.toMatch(/\bcreateTesseract4Actor\b/);
    expect(sourceFiles["./features/scene/editor-scene-view-host.ts"]).toBeUndefined();
    expect(sourceFiles["./features/scene/scene-window-actor-factory.ts"]).toBeUndefined();
    expect(editorPackageSources["packages/editor/src/scene/editor-scene-view-host.ts"]).toBeUndefined();
    expect(sourceFiles["./features/scene/components/index.ts"]).not.toMatch(/\bSceneCamera3ViewportBindingComponent\b/);
    expect(sourceFiles["./features/scene/components/index.ts"]).toMatch(/\binstallSceneIntegrationComponentDefinitions\b/);
    expect(sceneWindowActorFactorySource).toMatch(/\brenderViewportComponentType\b/);
    expect(sceneWindowActorFactorySource).toMatch(/\bfullscreenableViewComponentType\b/);
    expect(sceneWindowActorFactorySource).toMatch(/\buiLayoutHostComponentType\b/);
    expect(sceneWindowActorFactorySource).toMatch(/\buiLayoutItemComponentType\b/);
    expect(sceneWindowActorFactorySource).toMatch(/\btargetOwnership:\s*["']borrowed["']/);
    expect(sceneWindowActorFactorySource).toMatch(/\bworldRenderActor\b/);
    expect(sceneWindowActorFactorySource).not.toMatch(/\boverlayElement\b|\bcanvasHostElement\b/);
    expect(uiViewportSource).not.toMatch(/\bWindowRegisteredContent\b|\bWindowContentRegistrationPort\b/);
    expect(uiViewportSource).not.toMatch(/addEventListener\??\s*\(\s*["']click["']|\.onclick\s*=/);
    expect(uiViewportSource).not.toMatch(/\bactorInputScopeRoutePriority\b/);
    expect(renderableSceneViewSource).toMatch(/renderOutput\.render/);
    expect(renderableSceneViewSource).not.toMatch(/sceneView\.viewport\.render/);
    expect(sceneWindowActorFactorySource).not.toMatch(/renderWithCamera|sceneView\.viewport\.render/);
  });

  it("guards Scene viewport rendering behind current view ownership and active state", () => {
    const renderableSceneViewSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/scene/runtime-scene-frame-source.ts"] ?? "";
    const sceneFeatureInstallerSource = sourceFiles["./features/scene/install-scene-view-feature.ts"] ?? "";

    expect(renderableSceneViewSource).toMatch(/\bisRenderable\s*\(\)\s*{/);
    expect(renderableSceneViewSource).not.toMatch(/sceneWindow\.window\.state\.visible/);
    expect(renderableSceneViewSource).toMatch(/options\.presentation\.isVisibleInCurrentLocation/);
    expect(renderableSceneViewSource).toMatch(/renderOutput\.render\(options\.camera3Motion\.getRuntimeThreeCameraForRender\(\)\)/);
    expect(renderableSceneViewSource).not.toMatch(/camera3Motion\.activeCamera/);
    expect(sceneFeatureInstallerSource).toMatch(/locations\.getLocationByViewActorId/);
    expect(sceneFeatureInstallerSource).toMatch(/location\.ownerFrameVisible/);
    expect(sceneFeatureInstallerSource).toMatch(/location\.ownerFrameActiveInHierarchy/);
    expect(sceneFeatureInstallerSource).toMatch(/location\.visibleInFrame/);
    expect(sceneFeatureInstallerSource).toMatch(/actorSystem\.isActorActive\s*\(\s*options\.sceneView\.sceneActor\s*\)/);
    expect(sceneFeatureInstallerSource).toMatch(/sceneView\.renderViewport\.measureNow\(\)/);
  });

  it("keeps Camera3 motion and viewport subscriptions in components without shadow rig state", () => {
    const sceneFeatureInstallerSource = sourceFiles["./features/scene/install-scene-view-feature.ts"] ?? "";
    const runtimeSceneContentSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/scene/runtime-scene-content.ts"] ?? "";
    const sceneCamera3ComponentsSource = sourceFiles["./features/scene/components/index.ts"] ?? "";
    const camera3BindingSource =
      sourceFiles["./features/scene/components/scene-camera3-viewport-binding-component.ts"] ?? "";
    const camera3MotionDefinitionSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/camera3/camera3-motion-definition.ts"] ?? "";
    const camera3MotionSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/camera3/camera3-motion-component.ts"] ?? "";
    const camera3ControllerSource =
      runtimeThreePackageSources["packages/runtime-three/src/runtime-three-camera-motion-controller.ts"] ?? "";
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";

    expect(sceneFeatureInstallerSource).not.toMatch(/\bnew\s+Camera3MotionController\b/);
    expect(runtimeSceneContentSource).not.toMatch(/\bnew\s+Camera3MotionController\b/);
    expect(sourceFiles["./camera3-control/camera3-motion-controller.ts"]).toBeUndefined();
    expect(sourceFiles["./runtime/camera3-runtime-camera.ts"]).toBeUndefined();
    expect(sceneFeatureInstallerSource).not.toMatch(/\bnew\s+Camera3Rig\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bnew\s+Camera3ProjectionModeController\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/subscribeResize\s*\(/);
    expect(sceneFeatureInstallerSource).not.toMatch(/onCamera3MotionChanged/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bcamera3RigComponentType\b/);
    expect(runtimeSceneContentSource).toMatch(/\bcamera3MotionComponentType\b/);
    expect(sceneFeatureInstallerSource).toMatch(/\bsceneCamera3ViewportBindingComponentType\b/);
    expect(sceneFeatureInstallerSource).toMatch(/renderViewportActorId:\s*sceneView\.worldRenderActor\.id/);
    expect(sourceFiles["./features/camera3/components/index.ts"]).toBeUndefined();
    expect(sourceFiles["./features/camera3/components/camera3-motion-component.ts"]).toBeUndefined();
    expect(sourceFiles["./runtime/camera3/camera3-motion-definition.ts"]).toBeUndefined();
    expect(sourceFiles["./runtime/camera3/camera3-motion-component.ts"]).toBeUndefined();
    expect(sceneCamera3ComponentsSource).not.toMatch(/\bCamera3RigComponent\b/);
    expect(sceneCamera3ComponentsSource).not.toMatch(/\bCamera3MotionComponent\b/);
    expect(sceneCamera3ComponentsSource).not.toMatch(/\bcamera3MotionComponentDefinition\b/);
    expect(sceneCamera3ComponentsSource).not.toMatch(/\bSceneCamera3ViewportBindingComponent\b/);
    expect(sceneCamera3ComponentsSource).toMatch(/\binstallSceneIntegrationComponentDefinitions\b/);
    expect(camera3BindingSource).toMatch(/\bRenderViewportComponent\b/);
    expect(camera3BindingSource).not.toMatch(/\bSceneViewportComponent\b|\bsceneViewportComponentType\b/);
    expect(camera3BindingSource).toMatch(/subscribeResize\s*\(/);
    expect(camera3BindingSource).toMatch(/onCamera3MotionChanged/);
    expect(camera3BindingSource).not.toMatch(/\bCamera3RigComponent\b/);
    expect(camera3MotionDefinitionSource).not.toMatch(/\bruntime-object\b/);
    expect(camera3MotionDefinitionSource).not.toMatch(/\brequires:\s*\[\s*{/);
    expect(camera3MotionDefinitionSource).not.toMatch(/\bcamera3RigComponentType\b/);
    expect(camera3MotionSource).not.toMatch(/\bCamera3RigComponent\b/);
    expect(camera3MotionSource).toMatch(/\bRuntimeThreeCameraMotionController\b/);
    expect(camera3ControllerSource).not.toMatch(/\bCamera3Rig\b|\bCamera3ProjectionModeController\b/);
    expect(camera3ControllerSource).not.toMatch(/\b(?:AppRuntimeContext|FeatureActorContext|runtime\/ports)\b/);
    expect(appSource).toMatch(/\binstallEditorComponentDefinitions\b/);
    expect(appSource).toMatch(/\binstallSceneIntegrationComponentDefinitions\b/);
    expect(appSource).toMatch(/\binstallWallpaperRuntimeComponentDefinitions\b/);
    expect(appSource).not.toMatch(/\bcamera3MotionComponentDefinition\b/);
    expect(appSource).not.toMatch(/\binstallWallpaperComponentDefinitions\b/);
  });

  it("keeps Camera3 UI controls on actor input instead of DOM click handlers", () => {
    const camera3GizmoSource = editorPackageSources["packages/editor/src/camera3/camera3-gizmo.ts"] ?? "";
    const camera3ComponentSource =
      editorPackageSources["packages/editor/src/camera3/components/camera3-gizmo-component.ts"] ?? "";

    expect(sourceFiles["./gizmos/camera3/camera3-gizmo.ts"]).toBeUndefined();
    expect(sourceFiles["./gizmos/camera3/components/camera3-gizmo-component.ts"]).toBeUndefined();
    expect(camera3GizmoSource).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(camera3GizmoSource).not.toMatch(/\.onclick\s*=/);
    expect(camera3GizmoSource).not.toMatch(/projectionMode\.activeCamera/);
    expect(camera3GizmoSource).not.toMatch(/viewState\.activeCamera/);
    expect(camera3GizmoSource).toMatch(/projection-mode/);
    expect(camera3ComponentSource).toMatch(/\bonInputClick\b/);
  });

  it("keeps Scene view content installation transactional", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const sceneFeatureInstallerSource = sourceFiles["./features/scene/install-scene-view-feature.ts"] ?? "";
    const runtimeSceneContentSource =
      wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/scene/runtime-scene-content.ts"] ?? "";

    expect(appSource).not.toMatch(/registerLegacyRuntimeObject\s*\(\s*content\.camera3Motion\s*\)/);
    expect(appSource).not.toMatch(/motionRegistration\?\.dispose\s*\(\s*\)/);
    expect(appSource).not.toMatch(/content\.camera3Motion\.dispose\s*\(\s*\)/);
    expect(sourceFiles["./features/scene/scene-view-content-installer.ts"]).toBeUndefined();
    expect(sceneFeatureInstallerSource).toMatch(/\btry\s*{/);
    expect(sceneFeatureInstallerSource).toMatch(/\bcatch\s*\(\s*error\s*\)/);
    expect(sceneFeatureInstallerSource).toMatch(/sceneView\?\.dispose\s*\(\s*\)/);
    expect(sceneFeatureInstallerSource).toMatch(/runtimeScene\.dispose\s*\(\s*\)/);
    expect(runtimeSceneContentSource).toMatch(/\btry\s*{/);
    expect(runtimeSceneContentSource).toMatch(/\bcatch\s*\(\s*error\s*\)/);
    expect(runtimeSceneContentSource).toMatch(/renderOutput\.dispose\s*\(\s*\)/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bcreateSceneWindowActor\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bregisterLegacyRuntimeObject\b/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\brender\s*\(\)\s*:/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\bmeasureNow\s*\(\)\s*:/);
  });

  it("parents the Camera3 actor gizmo as a Scene overlay sibling", () => {
    const sceneFeatureInstallerSource = sourceFiles["./features/scene/install-scene-view-feature.ts"] ?? "";
    const camera3Styles = readWorkspaceSourceFile("packages/editor/src/camera3/camera3-gizmo.css");
    const camera3ActorCall = /createCamera3GizmoActor\s*\(\s*options\.context\s*,\s*{[\s\S]*?parentActor:\s*sceneView\.sceneActor[\s\S]*?layoutItem:\s*{[\s\S]*?}/
      .exec(sceneFeatureInstallerSource)?.[0] ?? "";

    expect(camera3ActorCall).toMatch(/parentActor:\s*sceneView\.sceneActor/);
    expect(camera3ActorCall).toMatch(/slot:\s*["']overlay["']/);
    expect(camera3ActorCall).toMatch(/layer:\s*CAMERA3_GIZMO_OVERLAY_LAYER/);
    expect(camera3ActorCall).not.toMatch(/parent:\s*sceneView\./);
    expect(camera3ActorCall).not.toMatch(/parent:\s*mount/);
    expect(sceneFeatureInstallerSource).not.toMatch(/\boverlayElement\b|\bcanvasHostElement\b/);
    expect(camera3Styles).toMatch(/\.camera3-gizmo-host\s*{[\s\S]*position:\s*absolute/);
    expect(camera3Styles).not.toMatch(/\.scene-window__overlay\s+\.camera3-gizmo/);
  });

  it("keeps the Scene view recoverable through the window lifecycle view factory", () => {
    const sceneFeatureInstaller = sourceFiles["./features/scene/install-scene-view-feature.ts"] ?? "";

    expect(sceneFeatureInstaller).toMatch(/viewKey:\s*["']scene["']/);
    expect(sceneFeatureInstaller).toMatch(/order:\s*0/);
    expect(sceneFeatureInstaller).toMatch(/\bcreateViewRuntime\b/);
    expect(sceneFeatureInstaller).not.toMatch(/\bcreateSceneWindowActor\b/);
    expect(sourceFiles["./features/app-menu/app-menu-bar-actor-factory.ts"]).toBeUndefined();
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
    const toolInstallerSource = editorPackageSources["packages/editor/src/tool-windows/install-tool-window-features.ts"] ?? "";

    expect(appSource).not.toMatch(/\bcreateSceneWindowWorkspaceFloatingFramePolicy\b/);
    expect(appSource).not.toMatch(/\bcreateToolWindowWorkspaceFloatingFramePolicies\b/);
    expect(appSource).not.toMatch(/\bcreateSceneDefaultOpenView\b/);
    expect(appSource).not.toMatch(/\bcreateToolWindowDefaultOpenViews\b/);
    expect(sourceFiles["./features/install-wallpaper-product-features.ts"]).toBeUndefined();
    expect(appSource).toMatch(/\binstallSceneWorkspacePolicy\b/);
    expect(appSource).toMatch(/\binstallToolWindowWorkspacePolicy\b/);
    expect(appSource).not.toMatch(/\bSCENE_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(appSource).not.toMatch(/\bDEBUG_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(appSource).not.toMatch(/\bHIERARCHY_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(appSource).not.toMatch(/sceneParameterPaths\.(?:sceneWindow|debugWindow|hierarchyWindow)/);
    expect(appSource).not.toMatch(/floating-window:(?:scene|debug-log|hierarchy)/);
    expect(appSource).not.toMatch(/className:\s*["'](?:scene-window|debug-log-window|hierarchy-window)["']/);

    expect(sceneInstallerSource).toMatch(/editorWindowLayoutPaths\.sceneWindow/);
    expect(sceneInstallerSource).toMatch(/floating-window:scene/);
    expect(sceneInstallerSource).toMatch(/\bSCENE_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(sceneInstallerSource).toMatch(/\binstallSceneWorkspacePolicy\b/);
    expect(toolInstallerSource).toMatch(/editorWindowLayoutPaths\.(?:debugWindow|hierarchyWindow)/);
    expect(toolInstallerSource).toMatch(/floating-window:(?:debug-log|hierarchy)/);
    expect(toolInstallerSource).toMatch(/\bDEBUG_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(toolInstallerSource).toMatch(/\bHIERARCHY_WINDOW_MIN_(?:WIDTH|HEIGHT)\b/);
    expect(toolInstallerSource).toMatch(/\binstallToolWindowWorkspacePolicy\b/);
  });

  it("keeps run-mode fullscreen on the workspace presentation session path", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const sceneRunModeSource = sourceFiles["./features/scene-run-mode-command.ts"] ?? "";

    expect(appSource).not.toMatch(/\bnew\s+WindowWorkspacePresentationController\b/);
    const deletedSceneRunModeModule = `./features/${"workspace"}-${"mode"}.ts`;
    expect(sourceFiles[deletedSceneRunModeModule]).toBeUndefined();
    expect(sourceFiles["./features/install-wallpaper-product-features.ts"]).toBeUndefined();
    expect(appSource).not.toMatch(/\bWorkspaceModeController\b/);
    expect(appSource).toMatch(/\binstallSceneRunModeCommand\b/);
    expect(sceneRunModeSource).not.toMatch(/\bexport\s+class\s+SceneRunModeCommand\b/);
    expect(sceneRunModeSource).not.toMatch(/\bWorkspaceModeController\b/);
    expect(sceneRunModeSource).toMatch(/\bworkspacePresentation:\s*options\.workspacePresentation\b/);
    expect(sceneRunModeSource).toMatch(/\benterRunFullscreenForView\b/);
    expect(sceneRunModeSource).toMatch(/\bexitRunFullscreen\b/);
    expect(sceneRunModeSource).not.toMatch(/\bvisiblePath\b|\brestoreVisiblePath\b/);
  });

  it("keeps actor-local input route scores out of actor-system/gizmo hit priority", () => {
    const bindingSource = actorSystemInputSources["packages/actor-system/src/input/gizmo-event-binding-component.ts"] ?? "";
    const routerSource = actorSystemInputSources["packages/actor-system/src/input/actor-input-router.ts"] ?? "";

    expect(bindingSource).not.toMatch(/priority:\s*selection\.routeScore\b/);
    expect(bindingSource).toMatch(/priority:\s*selection\.scopeRouteScore\b/);
    expect(routerSource).toMatch(/\bscopeRouteScore\b/);
    expect(routerSource).toMatch(/\bgetActorInputScopeRoutePriority\b/);
  });

  it("keeps pointer active interaction policy in actor-system/gizmo instead of app-level fallbacks", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";

    expect(appSource).not.toMatch(/\bbuttonsReleasedFallback\b/);
  });

  it("keeps feature definition installation owned by features and composed by app", () => {
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";

    expect(sourceFiles["./component-definitions.ts"]).toBeUndefined();
    expect(sourceFiles["./features/install-wallpaper-component-definitions.ts"]).toBeUndefined();
    expect(appSource).toMatch(/\binstallActorInputComponentDefinitions\b/);
    expect(appSource).toMatch(/\binstallWindowComponentDefinitions\b/);
    expect(appSource).toMatch(/\binstallAppMenuComponentDefinitions\b/);
    expect(appSource).toMatch(/\binstallEditorComponentDefinitions\b/);
    expect(appSource).toMatch(/\binstallSceneIntegrationComponentDefinitions\b/);
    expect(appSource).toMatch(/\binstallWallpaperRuntimeComponentDefinitions\b/);
    expect(appSource).not.toMatch(/\bcamera3MotionComponentDefinition\b/);
    expect(appSource).not.toMatch(/\binstallTesseract4ComponentDefinitions\b/);
    expect(appSource).not.toMatch(/\binstallWallpaperComponentDefinitions\b/);
  });

  it("keeps feature styles colocated and imported from the app style manifest", () => {
    const appRootStyles = readSourceFile("./style.css");
    const floatingWindowStyles = readSourceFile("./window-runtime/floating-window.css");
    const camera3GizmoStyles = readWorkspaceSourceFile("packages/editor/src/camera3/camera3-gizmo.css");
    const sceneWindowStyles = readWorkspaceSourceFile("packages/editor/src/scene/scene-window.css");
    const uiFrameworkThemeStyles = readWorkspaceSourceFile(
      "packages/ui-framework/src/ui/theme/ui-theme-css.ts"
    );
    const uiFrameworkControlsStyles = readWorkspaceSourceFile(
      "packages/ui-framework/src/ui/ui-framework-controls.css"
    );
    const appShellStyles = readSourceFile("./app/app-shell.css");
    const appStyleManifestSource = sourceFiles["./app/styles.ts"] ?? "";

    expect(appRootStyles).not.toMatch(/floating-gizmo-window|debug-log-window|hierarchy-panel|camera3-gizmo|scene-window|app-menu-bar/);
    expect(appShellStyles).toMatch(/app-shell/);
    expect(appShellStyles).not.toMatch(/debug-log-window|hierarchy-panel|camera3-gizmo|scene-window|app-menu-bar/);
    expect(appShellStyles).not.toMatch(/z-index:\s*10000/);
    expect(appShellStyles).toMatch(/--window-top-docked-chrome-layer/);
    expect(appShellStyles).toMatch(/--window-fullscreen-presentation-layer/);
    expect(appShellStyles).toMatch(/:has\(\.floating-gizmo-window--fullscreen\)/);
    expect(floatingWindowStyles).toMatch(/floating-gizmo-window/);
    expect(camera3GizmoStyles).toMatch(/camera3-gizmo/);
    expect(sceneWindowStyles).toMatch(/scene-window/);
    expect(sceneWindowStyles).not.toMatch(/ui-render-viewport|ui-fullscreenable-view__control/);
    expect(uiFrameworkThemeStyles).toMatch(/generateUiThemeCss/);
    expect(uiFrameworkControlsStyles).toMatch(/ui-menu-bar/);
    expect(uiFrameworkControlsStyles).toMatch(/ui-popup-menu/);
    expect(uiFrameworkControlsStyles).toMatch(/ui-render-viewport/);
    expect(uiFrameworkControlsStyles).toMatch(/ui-fullscreenable-view__control/);
    expect(uiFrameworkControlsStyles).toMatch(/ui-scroll-view/);
    expect(uiFrameworkControlsStyles).toMatch(/ui-tree-view/);
    expect(uiFrameworkControlsStyles).toMatch(/ui-list-view/);
    expect(uiFrameworkControlsStyles).not.toMatch(/app-menu-bar|scene-window|hierarchy-panel|debug-log-window/);
    expect(sourceFiles["./features/app-menu/app-menu.css"]).toBeUndefined();
    expect(editorPackageSources["packages/editor/src/hierarchy/hierarchy.css"]).toBeUndefined();
    expect(editorPackageSources["packages/editor/src/debug/debug-log.css"]).toBeUndefined();
    expect(appStyleManifestSource).toMatch(/["']\.\.\/style\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']ui-framework\/ui\/theme\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']ui-framework\/ui\/ui-framework-controls\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']\.\/app-shell\.css["']/);
    expect(appStyleManifestSource).not.toMatch(/features\/app-menu\/app-menu\.css/);
    expect(appStyleManifestSource).toMatch(/["']\.\.\/window-runtime\/floating-window\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']editor\/scene\/scene-window\.css["']/);
    expect(appStyleManifestSource).not.toMatch(/["']editor\/debug\/debug-log\.css["']/);
    expect(appStyleManifestSource).not.toMatch(/["']editor\/hierarchy\/hierarchy\.css["']/);
    expect(appStyleManifestSource).toMatch(/["']editor\/camera3\/camera3-gizmo\.css["']/);
  });

  it("keeps App Menu routed through actor input and state observer bindings", () => {
    const adapterSource = sourceFiles["./features/app-menu/app-menu-adapter-component.ts"] ?? "";
    const adapterDefinitionSource = sourceFiles["./features/app-menu/app-menu-adapter-definition.ts"] ?? "";
    const installSource = sourceFiles["./features/app-menu/install-app-menu-feature.ts"] ?? "";
    const uiMenuSource = [
      uiFrameworkPackageSources["packages/ui-framework/src/ui/menu/menu-bar-component.ts"] ?? "",
      uiFrameworkPackageSources["packages/ui-framework/src/ui/menu/popup-menu-component.ts"] ?? "",
      uiFrameworkPackageSources["packages/ui-framework/src/ui/menu/menu-item-component.ts"] ?? "",
      uiFrameworkPackageSources["packages/ui-framework/src/ui/menu/menu-bar-item-component.ts"] ?? ""
    ].join("\n");
    const appSource = sourceFiles["./app/create-wallpaper-app.ts"] ?? "";
    const presentationStackSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-presentation-stack.ts"] ?? "";

    expect(sourceFiles["./features/install-wallpaper-product-features.ts"]).toBeUndefined();
    expect(sourceFiles["./features/app-menu/app-menu-bar-component.ts"]).toBeUndefined();
    expect(sourceFiles["./features/app-menu/app-menu-bar-definition.ts"]).toBeUndefined();
    expect(sourceFiles["./features/app-menu/app-menu-bar-actor-factory.ts"]).toBeUndefined();
    expect(appSource).toMatch(/\binstallAppMenuFeature\b/);
    expect(appSource).toMatch(/\binstallUiComponentDefinitions\b/);
    expect(appSource).not.toMatch(/\bcreateAppMenuBarActor\b/);
    expect(installSource).toMatch(/\bhostElement\b/);
    expect(installSource).not.toMatch(/\bparent:\s*HTMLElement\b/);
    expect(installSource).toMatch(/\bWINDOW_TOP_DOCKED_CHROME_LAYER\b/);
    expect(installSource).not.toMatch(/\bAPP_MENU_STACK_PRIORITY\b/);
    expect(installSource).not.toMatch(/\bactorInputScopeRoutePriority\b/);
    expect(installSource).toMatch(/\bUiLayoutHostComponent\b|\buiLayoutHostComponentType\b/);
    expect(adapterSource).toMatch(/\bcreateWindowMenuItems\b/);
    expect(adapterSource).toMatch(/\brequestOpenOrFocusViewType\?\.\(action\.typeKey,\s*["']menu["']\)/);
    expect(adapterSource).toMatch(/\brequestCreateViewInstance\?\.\(action\.typeKey,\s*["']menu["']\)/);
    expect(adapterSource).toMatch(/\brequestFocusViewInstance\?\.\(action\.identity,\s*["']menu["']\)/);
    expect(adapterSource).not.toMatch(/\b#rows\b|#activeRowIndex\b|renderMenu|createMenuItemElement/);
    expect(adapterSource).not.toMatch(/addEventListener\s*\(\s*["']click["']/);
    expect(adapterSource).not.toMatch(/\.onclick\s*=/);
    expect(adapterDefinitionSource).toMatch(/\bstateObserverBindingComponentType\b/);
    expect(uiMenuSource).toMatch(/\bhitTestInput\b/);
    expect(uiMenuSource).toMatch(/\bonInputEnd\b/);
    expect(uiMenuSource).not.toMatch(/\bactorInputScopeRoutePriority\b/);
    expect(uiMenuSource).not.toMatch(/\bmenu-dismiss\b/);
    expect(uiMenuSource).not.toMatch(/addEventListener\??\s*\(\s*["']click["']|\.onclick\s*=/);
    expect(uiMenuSource).not.toMatch(/\bAPP_MENU_PRIORITY\b|10_000/);
    expect(presentationStackSource).toMatch(/\bWINDOW_TOP_DOCKED_CHROME_LAYER\b/);
    expect(presentationStackSource).toMatch(/\bWINDOW_FULLSCREEN_PRESENTATION_LAYER\b/);
    expect(presentationStackSource).not.toMatch(/\bAPP_MENU\b/);
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

  it("keeps window workspace surfaces graph-first and old placement surfaces deleted", () => {
    const floatingWindowSource = sourceFiles["./window-runtime/floating-window-component.ts"] ?? "";
    const rootFrameSource = sourceFiles["./window-runtime/workspace-root-dock-frame-component.ts"] ?? "";
    const floatingDefinitionSource = sourceFiles["./window-runtime/floating-window-definition.ts"] ?? "";
    const rootDefinitionSource = sourceFiles["./window-runtime/workspace-root-dock-frame-definition.ts"] ?? "";
    const installSource = sourceFiles["./window-runtime/install-component-definitions.ts"] ?? "";
    const framePortSource = uiFrameworkPackageSources["packages/ui-framework/src/ports/window-frame-port.ts"] ?? "";
    const surfaceSource = uiFrameworkPackageSources["packages/ui-framework/src/chrome/window-frame-surface-component.ts"] ?? "";
    const uiPublicApiSource = uiFrameworkPackageSources["packages/ui-framework/src/index.ts"] ?? "";
    const appWindowRuntimeIndex = sourceFiles["./window-runtime/index.ts"] ?? "";
    const appFloatingHostBarrel = sourceFiles["./window-runtime/floating-window-host.ts"] ?? "";
    const lifecycleApiSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-frame-lifecycle.ts"] ?? "";
    const controllerSource =
      uiFrameworkPackageSources["packages/ui-framework/src/services/window-frame-lifecycle-controller.ts"] ?? "";
    const deletedPlacementNames =
      /\b(?:WindowContentHost|WindowContentAttachment|createWindowContentAttachment|getWindowContentAttachment|WindowDockSurfaceModel|WindowFrameRuntimeDockNode|WindowFrameRuntimeTabsetNode|WindowFrameRuntimeSplitNode|getRuntimeDockRoot|restoreRuntimeDockRoot|listDockTargetTabsets|listTabs|getFocusedViewActorId|getActiveViewActorIds|isViewActiveInFrame|isViewVisibleInFrame|addTab|splitTab|removeTab|activateTab|hasTab|hasTabset|getContentHost|mountContent)\b/;
    const deletedPlacementImports =
      /from\s+["'][^"']*(?:window-frame-dock-tree|window-dock-surface-model|window-content-host)["']/;
    const productionSources = Object.entries({
      ...sourceFiles,
      ...uiFrameworkPackageSources
    })
      .filter(([file]) => (
        file !== "./architecture-boundaries.test.ts" &&
        !file.endsWith(".test.ts") &&
        !file.includes("dist/")
      ));
    const deletedPlacementNameViolations = productionSources
      .filter(([, source]) => deletedPlacementNames.test(source))
      .map(([file]) => file)
      .sort();
    const deletedPlacementImportViolations = productionSources
      .filter(([, source]) => deletedPlacementImports.test(source))
      .map(([file]) => file)
      .sort();

    expect(surfaceSource).toMatch(/\brenderWindowFrameTabsetTabs\b/);
    expect(surfaceSource).not.toMatch(/#tabs\b|#root\b|#focusedViewActorId\b/);
    expect(surfaceSource).not.toMatch(/target\?\.content\s*\?\?\s*host\.primaryContent/);
    expect(floatingWindowSource).not.toMatch(/new\s+WindowFrameSurfaceComponent/);
    expect(rootFrameSource).not.toMatch(/new\s+WindowFrameSurfaceComponent/);
    expect(floatingDefinitionSource).toMatch(/\bwindowFrameSurfaceComponentType\b/);
    expect(rootDefinitionSource).toMatch(/\bwindowFrameSurfaceComponentType\b/);
    expect(installSource).toMatch(/windowFrameSurfaceComponentDefinition[\s\S]*createFloatingWindowComponentDefinition/);
    expect(installSource).toMatch(/windowFrameSurfaceComponentDefinition[\s\S]*workspaceRootDockFrameComponentDefinition/);
    expect(framePortSource).not.toMatch(deletedPlacementNames);
    expect(uiPublicApiSource).not.toMatch(/window-frame-dock-tree|window-dock-surface-model|window-content-host/);
    expect(appWindowRuntimeIndex).not.toMatch(deletedPlacementNames);
    expect(appFloatingHostBarrel).not.toMatch(deletedPlacementNames);
    expect(uiFrameworkPackageSources["packages/ui-framework/src/model/window-dock-surface-model.ts"]).toBeUndefined();
    expect(uiFrameworkPackageSources["packages/ui-framework/src/model/window-frame-dock-tree.ts"]).toBeUndefined();
    expect(uiFrameworkPackageSources["packages/ui-framework/src/ports/window-content-host.ts"]).toBeUndefined();
    expect(uiFrameworkPackageSources["packages/ui-framework/src/services/window-workspace-graph-adapter.ts"])
      .toBeUndefined();
    expect(lifecycleApiSource).not.toMatch(/WindowWorkspaceGraphDiagnostic/);
    expect(controllerSource).not.toMatch(/createWindowWorkspaceGraphDiagnostic|createWorkspaceGraphDiagnostic/);
    expect(deletedPlacementNameViolations).toEqual([]);
    expect(deletedPlacementImportViolations).toEqual([]);

    expect(projectPrismPrePhase6UiFrameworkBlockers).toEqual([]);
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

  it("keeps generic menu product-free and App Menu as a thin window adapter", () => {
    const genericMenuSource = Object.entries(uiFrameworkPackageSources)
      .filter(([file]) => file.startsWith("packages/ui-framework/src/ui/menu/"))
      .filter(([file]) => !file.endsWith(".test.ts"))
      .map(([, source]) => source)
      .join("\n");
    const appMenuAdapterSource = sourceFiles["./features/app-menu/app-menu-adapter-component.ts"] ?? "";
    const windowMenuItemsSource = sourceFiles["./features/app-menu/window-menu-items.ts"] ?? "";
    const windowRuntimeViolations = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./window-runtime/"))
      .filter(([, source]) => /features\/app-menu/.test(source))
      .map(([file]) => file)
      .sort();

    expect(uiFrameworkPackageSources["packages/ui-framework/src/model/app-menu-model.ts"]).toBeUndefined();
    expect(genericMenuSource).not.toMatch(/WindowViewIdentity|WindowWorkspaceViewEntry|WindowWorkspace|WindowFrame|createWindowMenuItems/);
    expect(genericMenuSource).not.toMatch(/features\/|window-runtime|scene-runtime|debug|hierarchy|tesseract|camera3/);
    expect(genericMenuSource).toMatch(/\bpayload\??:\s*TPayload\b|\bpayload\??:\s*unknown\b/);
    expect(windowMenuItemsSource).toMatch(/\bWindowWorkspaceViewEntry\b/);
    expect(windowMenuItemsSource).toMatch(/\bkind:\s*["']open-or-focus-type["']/);
    expect(windowMenuItemsSource).toMatch(/\bkind:\s*["']new-instance["']/);
    expect(appMenuAdapterSource).toMatch(/\bcreateWindowMenuItems\b/);
    expect(appMenuAdapterSource).not.toMatch(/\b#rows\b|#activeRowIndex\b|renderMenu|createMenuItemElement/);
    expect(sourceFiles["./features/app-menu/app-menu-model.ts"]).toBeUndefined();
    expect(sourceFiles["./features/app-menu/app-menu-bar-component.ts"]).toBeUndefined();
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
    expect(sourceFiles["./features/install-wallpaper-product-features.ts"]).toBeUndefined();
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
    expect(persistenceSource).not.toMatch(/\bWINDOW_WORKSPACE_FRAME_LAYOUT_LEGACY_VERSION\b/);
    expect(persistenceSource).not.toMatch(/\bPersistedWindowWorkspaceViewDescriptorV1\b/);
    expect(persistenceSource).not.toMatch(/\bversion\s*!==\s*WINDOW_WORKSPACE_FRAME_LAYOUT_LEGACY_VERSION\b/);
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

  it("keeps future dock layout model pure and DOM-free", () => {
    const pureWindowLayoutFiles = new Set([
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
        /from\s+["'](?:actor-system\/gizmo|three)["']/.test(source)
      ))
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

  it("keeps frame/update contracts owned by runtime, UI, and editor packages", () => {
    const runtimeFrameSource = runtimeCorePackageSources["packages/runtime-core/src/runtime-frame.ts"] ?? "";
    const uiFrameSource = uiFrameworkPackageSources["packages/ui-framework/src/ports/ui-scheduler.ts"] ?? "";
    const editorStateSource = editorPackageSources["packages/editor/src/app-state.ts"] ?? "";
    const actorRuntimeSceneFrameImports = Object.entries(sourceFiles)
      .filter(([file]) => file.startsWith("./actor-runtime/"))
      .filter(([, source]) => (
        /from\s+["'](?:\.\.\/)+scene-runtime\/scene-frame["']/.test(source) ||
        /\bSceneFrame(?:Clock)?\b/.test(source)
      ))
      .map(([file]) => file)
      .sort();
    const appLocalRuntimePortFiles = Object.keys(sourceFiles)
      .filter((file) => file.startsWith("./runtime/ports/"))
      .sort();
    const appProductionRuntimePortImports = listModuleEdges(sourceFiles)
      .filter((edge) => !edge.fromFile.endsWith(".test.ts"))
      .filter((edge) => !edge.fromFile.startsWith("./test-support/"))
      .filter((edge) => edge.fromFile !== "./architecture-boundaries.test.ts")
      .filter((edge) => edge.resolvedFile?.startsWith("./runtime/ports/"))
      .map((edge) => `${edge.fromFile}: ${edge.specifier}`)
      .sort();

    expect(runtimeFrameSource).toMatch(/\binterface\s+RuntimeFrame\b/);
    expect(runtimeFrameSource).toMatch(/\bclass\s+RuntimeFrameClock\b/);
    expect(uiFrameSource).toMatch(/\binterface\s+UiFrame\b/);
    expect(editorStateSource).toMatch(/\binterface\s+AppStateChangedEvent\b/);
    expect(appLocalRuntimePortFiles).toEqual([]);
    expect(appProductionRuntimePortImports).toEqual([]);
    expect(sourceFiles["./scene-runtime/scene-frame.ts"]).toBeUndefined();
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
    const responderSource = collectWorkspaceSourceFiles("packages/editor/src")["packages/editor/src/state-observer/state-observer-responder.ts"] ?? "";
    const editorStateObserverSceneImports = Object.entries(collectWorkspaceSourceFiles("packages/editor/src/state-observer"))
      .filter(([file]) => !file.endsWith(".test.ts"))
      .filter(([, source]) => /from\s+["'][^"']*scene-runtime/.test(source))
      .map(([file]) => file)
      .sort();

    expect(responderSource).toMatch(/\bonStateChanged\b/);
    expect(responderSource).toMatch(/\bAppStateChangedEvent\b/);
    expect(uiResponderSceneObserverUses).toEqual([]);
    expect(editorStateObserverSceneImports).toEqual([]);
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
    const activeCancellationSource = actorSystemInputSources["packages/actor-system/src/input/active-input-cancellation-runtime.ts"] ?? "";
    const gizmoDefinitionSource = actorSystemInputSources["packages/actor-system/src/input/gizmo-event-binding-definition.ts"] ?? "";

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

  it("keeps Camera3 motion control out of app-local staging", () => {
    const runtimeThreeMotionSource =
      runtimeThreePackageSources["packages/runtime-three/src/runtime-three-camera-motion-controller.ts"] ?? "";
    const appLocalCamera3ControlFiles = Object.keys(sourceFiles)
      .filter((file) => file.startsWith("./camera3-control/"))
      .sort();

    expect(appLocalCamera3ControlFiles).toEqual([]);
    expect(runtimeThreeMotionSource).toMatch(/\bRuntimeThreeCameraMotionController\b/);
    expect(runtimeThreeMotionSource).not.toMatch(/\b(?:Camera3MotionController|gizmos\/camera3|editor)\b/);
  });

  it("removes the Camera3 legacy factory surface", () => {
    const normalIndex = editorPackageSources["packages/editor/src/camera3/index.ts"] ?? "";
    const componentIndex = editorPackageSources["packages/editor/src/camera3/components/index.ts"] ?? "";
    const componentSource =
      editorPackageSources["packages/editor/src/camera3/components/camera3-gizmo-component.ts"] ?? "";
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

    expect(sourceFiles["./gizmos/camera3/index.ts"]).toBeUndefined();
    expect(sourceFiles["./gizmos/camera3/components/index.ts"]).toBeUndefined();
    expect(normalIndex).not.toMatch(/\bcreateCamera3Gizmo\b/);
    expect(normalIndex).not.toMatch(/\bCamera3GizmoFactory\b/);
    expect(componentIndex).not.toMatch(/\bCamera3GizmoFactory\b/);
    expect(componentIndex).toMatch(/\bCamera3GizmoViewFactory\b/);
    expect(componentSource).not.toMatch(/\bCamera3GizmoFactory\b/);
    expect(componentSource).toMatch(/\bCamera3GizmoViewFactory\b/);
    expect(violations).toEqual([]);
  });

  it("keeps Camera3 actor component on ActorInputParticipant instead of legacy GizmoResponder", () => {
    const source = editorPackageSources["packages/editor/src/camera3/components/camera3-gizmo-component.ts"] ?? "";

    expect(source).toMatch(/\bActorInputParticipant\b/);
    expect(source).toMatch(/\bhitTestInput\b/);
    expect(source).not.toMatch(/\bGizmoResponder\b/);
    expect(source).not.toMatch(/\bhitTestGizmo\b/);
    expect(source).not.toMatch(/\bgizmoPriority\b/);
    expect(source).not.toMatch(/^\s*onGizmo(?:Start|Move|End|Cancel|Click|DoubleClick)\b/m);
  });

  it("keeps feature actor factories on the actor-core creation context", () => {
    const factorySources = new Map([
      ["packages/editor/src/debug/components/debug-log-window-actor-factory.ts", editorPackageSources["packages/editor/src/debug/components/debug-log-window-actor-factory.ts"] ?? ""],
      ["packages/editor/src/inspector/inspector-view-actor-factory.ts", editorPackageSources["packages/editor/src/inspector/inspector-view-actor-factory.ts"] ?? ""],
      ["packages/editor/src/scene/scene-window-actor-factory.ts", editorPackageSources["packages/editor/src/scene/scene-window-actor-factory.ts"] ?? ""],
      ["packages/editor/src/hierarchy/hierarchy-panel-actor-factory.ts", editorPackageSources["packages/editor/src/hierarchy/hierarchy-panel-actor-factory.ts"] ?? ""],
      ["packages/editor/src/camera3/components/camera3-gizmo-actor-factory.ts", editorPackageSources["packages/editor/src/camera3/components/camera3-gizmo-actor-factory.ts"] ?? ""],
      [
        "packages/wallpaper-runtime/src/tesseract4/tesseract4-actor-factory.ts",
        wallpaperRuntimePackageSources["packages/wallpaper-runtime/src/tesseract4/tesseract4-actor-factory.ts"] ?? ""
      ]
    ]);
    const violations = [...factorySources]
      .filter(([, source]) => /\b(?:AppRuntimeContext|FeatureActorContext|runtime\/ports)\b/.test(source))
      .map(([file]) => file)
      .sort();

    expect(violations).toEqual([]);
    expect(sourceFiles["./runtime/ports/index.ts"]).toBeUndefined();
    for (const source of factorySources.values()) {
      expect(source).toMatch(/\bActorCreationContext\b/);
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


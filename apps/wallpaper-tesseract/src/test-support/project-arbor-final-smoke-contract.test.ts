import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface SmokeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly left?: number;
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
}

interface SceneArborSnapshot {
  readonly sceneRoot: SmokeRect | null;
  readonly sceneRootLayout: unknown;
  readonly worldRenderView: SmokeRect | null;
  readonly renderViewport: SmokeRect | null;
  readonly renderTarget: SmokeRect | null;
  readonly fullscreenControl: SmokeRect | null;
  readonly camera3Host: SmokeRect | null;
  readonly camera3Gizmo: SmokeRect | null;
  readonly layoutContributions: readonly unknown[];
  readonly canvasCount: number;
  readonly renderViewportCount: number;
  readonly camera3HostCount: number;
  readonly sceneRootCount: number;
  readonly worldRenderViewCount: number;
}

interface ProjectArborFinalSmokeEvidence {
  readonly kind?: unknown;
  readonly passed?: unknown;
  readonly validationErrors?: unknown;
  readonly consoleErrors?: unknown;
  readonly scene?: unknown;
  readonly menu?: unknown;
  readonly fullscreen?: unknown;
  readonly closeReopen?: unknown;
  readonly dockSanity?: unknown;
  readonly mobile?: unknown;
  readonly persistence?: unknown;
  readonly actorInputRouteEvidence?: unknown;
}

describe("Project Arbor Final smoke evidence", () => {
  it("validates a fresh Final browser smoke file when provided", () => {
    const evidencePath = process.env.PROJECT_ARBOR_FINAL_SMOKE_EVIDENCE;
    if (!evidencePath) return;
    const resolvedPath = resolve(process.cwd(), "..", "..", evidencePath);
    expect(existsSync(resolvedPath), `smoke evidence file not found: ${evidencePath}`).toBe(true);
    const evidence = JSON.parse(readFileSync(resolvedPath, "utf8")) as ProjectArborFinalSmokeEvidence;
    expect(validateProjectArborFinalSmokeEvidence(evidence)).toEqual([]);
  });

  it("rejects missing Arbor Scene subtree and fullscreen evidence", () => {
    expect(validateProjectArborFinalSmokeEvidence({
      kind: "project-arbor-final-smoke",
      passed: true,
      validationErrors: [],
      consoleErrors: [],
      scene: {
        boot: {
          sceneRoot: rect(),
          sceneRootLayout: {},
          worldRenderView: null,
          renderViewport: rect(),
          renderTarget: rect(),
          fullscreenControl: null,
          camera3Host: rect(),
          camera3Gizmo: rect(),
          layoutContributions: [],
          canvasCount: 1,
          renderViewportCount: 1,
          camera3HostCount: 1,
          sceneRootCount: 1,
          worldRenderViewCount: 0
        }
      },
      menu: { hoverExactOne: true, activationCreatedNewInspector: true, escapeDismissed: true },
      fullscreen: { actorInputEnterRestores: false },
      closeReopen: { iterations: [] },
      dockSanity: { debugToScene: false, sceneToDebug: false },
      mobile: { clickableIntersections: { menu: true, renderViewport: true, camera3: true, fullscreenControl: true } },
      persistence: { version: 2, containsRuntimeOnlyIds: false },
      actorInputRouteEvidence: { hits: [] }
    })).toContain("scene boot snapshot must include the World Render View actor element.");
  });

  it("rejects Scene snapshots whose render viewport does not fill the Scene root", () => {
    const errors = validateProjectArborFinalSmokeEvidence(createValidEvidence({
      sceneRoot: rect(0, 57, 1280, 663),
      worldRenderView: rect(0, 57, 1280, 640),
      renderViewport: rect(0, 57, 1280, 640),
      renderTarget: rect(0, 57, 1280, 640),
      fullscreenControl: rect(1232, 649, 40, 40),
      layoutContributions: [
        { actorId: "scene-window:view:world-render-view", slot: "fill", rect: rect(0, 57, 1280, 640) },
        { actorId: "scene-window:view:camera-3", slot: "overlay", rect: rect(0, 57, 1280, 663) }
      ]
    }));

    expect(errors).toContain(
      "scene boot fill contribution must fill the Scene root when it is the only non-overlay layout contribution."
    );
  });

  it("rejects fullscreen resize evidence that keeps stale desktop rects", () => {
    const evidence = createValidEvidence();
    const fullscreen = evidence.fullscreen as Record<string, unknown>;
    fullscreen.resizeFollowsViewport = false;
    fullscreen.resized = {
      viewport: { width: 390, height: 844 },
      controlState: "fullscreen",
      sceneRoot: rect(0, 0, 1280, 720),
      worldRenderView: rect(0, 0, 1280, 720),
      renderViewport: rect(0, 0, 1280, 720),
      renderTarget: rect(0, 0, 1280, 720),
      fullscreenControl: rect(1232, 672, 40, 40)
    };

    const errors = validateProjectArborFinalSmokeEvidence(evidence);

    expect(errors).toContain("fullscreen evidence must show Scene resizing with browser viewport.");
    expect(errors).toContain("fullscreen resized Scene root must match the resized viewport.");
    expect(errors).toContain("fullscreen restore control must stay visible after resize.");
  });

  it("rejects fullscreen evidence that leaves the top-docked menu above Scene", () => {
    const evidence = createValidEvidence();
    const fullscreen = evidence.fullscreen as Record<string, unknown>;
    fullscreen.coversTopDockedMenu = false;
    fullscreen.blocksTopDockedMenuInput = false;
    fullscreen.topDockedMenuProbe = {
      topElement: { className: "ui-menu-bar-item", insideFullscreen: false },
      fullscreenZIndex: 900,
      menuZIndex: 10000,
      floatingOverlay: null
    };

    const errors = validateProjectArborFinalSmokeEvidence(evidence);

    expect(errors).toContain("fullscreen evidence must show Scene covering top-docked menu.");
    expect(errors).toContain("fullscreen evidence must show top-docked menu input blocked.");
    expect(errors).toContain("fullscreen top-docked menu probe top element must be inside fullscreen Scene.");
    expect(errors).toContain("fullscreen z-index must be greater than top-docked menu z-index.");
    expect(errors).toContain("fullscreen menu-cover evidence must include floating overlay stacking data.");
  });
});

function validateProjectArborFinalSmokeEvidence(
  evidence: ProjectArborFinalSmokeEvidence
): string[] {
  const errors: string[] = [];
  if (evidence.kind !== "project-arbor-final-smoke") errors.push("kind must be project-arbor-final-smoke.");
  if (evidence.passed !== true) errors.push("passed must be true.");
  if (!isEmptyArray(evidence.validationErrors)) errors.push("validationErrors must be empty.");
  if (!isEmptyArray(evidence.consoleErrors)) errors.push("consoleErrors must be empty.");

  validateSceneEvidence(asRecord(evidence.scene), errors);
  validateMenuEvidence(asRecord(evidence.menu), errors);
  validateFullscreenEvidence(asRecord(evidence.fullscreen), errors);
  validateCloseReopenEvidence(asRecord(evidence.closeReopen), errors);
  validateDockSanityEvidence(asRecord(evidence.dockSanity), errors);
  validateMobileEvidence(asRecord(evidence.mobile), errors);
  validatePersistenceEvidence(asRecord(evidence.persistence), errors);
  validateActorInputEvidence(asRecord(evidence.actorInputRouteEvidence), errors);

  return errors.sort();
}

function validateMenuEvidence(menu: Record<string, unknown> | null, errors: string[]): void {
  if (!menu) {
    errors.push("menu evidence is required.");
    return;
  }
  if (menu.hoverExactOne !== true) {
    errors.push("menu evidence must show exactly one highlighted item for each hover.");
  }
  if (menu.activationCreatedNewInspector !== true) {
    errors.push("menu evidence must show New Inspector activation.");
  }
  if (menu.escapeDismissed !== true) {
    errors.push("menu evidence must show Escape dismissing the popup.");
  }
  const hoverSnapshots = Array.isArray(menu.hoverSnapshots) ? menu.hoverSnapshots : [];
  if (hoverSnapshots.length === 0) {
    errors.push("menu evidence must include hover snapshots.");
  }
}

function validateSceneEvidence(scene: Record<string, unknown> | null, errors: string[]): void {
  const boot = asRecord(scene?.boot) as Partial<SceneArborSnapshot> | null;
  if (!boot) {
    errors.push("scene boot snapshot is required.");
    return;
  }
  if (!isMeasurableRect(boot.sceneRoot)) errors.push("scene boot snapshot must include a measurable Scene root.");
  if (!boot.sceneRootLayout) errors.push("scene boot snapshot must include a Scene root layout marker.");
  if (!isMeasurableRect(boot.worldRenderView)) {
    errors.push("scene boot snapshot must include the World Render View actor element.");
  }
  if (!isMeasurableRect(boot.renderViewport)) errors.push("scene boot snapshot must include a render viewport rect.");
  if (!isMeasurableRect(boot.renderTarget)) errors.push("scene boot snapshot must include a render target rect.");
  if (!rectContains(boot.renderViewport, boot.renderTarget)) {
    errors.push("render target must be nested inside the render viewport.");
  }
  if (!isMeasurableRect(boot.fullscreenControl)) {
    errors.push("scene boot snapshot must include a fullscreen control rect.");
  } else if (!rectContains(boot.renderViewport, boot.fullscreenControl)) {
    errors.push("scene boot fullscreen control must stay inside the render viewport.");
  }
  if (!isMeasurableRect(boot.camera3Host)) errors.push("scene boot snapshot must include Camera3 overlay host.");
  if (!isMeasurableRect(boot.camera3Gizmo)) errors.push("scene boot snapshot must include Camera3 gizmo.");
  if (boot.sceneRootCount !== 1) errors.push("Scene root must be exact-once.");
  if (boot.worldRenderViewCount !== 1) errors.push("World Render View must be exact-once.");
  if (boot.canvasCount !== 1) errors.push("Scene render target canvas must be exact-once.");
  if (boot.renderViewportCount !== 1) errors.push("Scene render viewport must be exact-once.");
  if (boot.camera3HostCount !== 1) errors.push("Camera3 overlay host must be exact-once.");
  const contributions = Array.isArray(boot.layoutContributions) ? boot.layoutContributions : [];
  if (!contributions.some((entry) => asRecord(entry)?.slot === "fill")) {
    errors.push("Scene layout must include a fill contribution.");
  }
  if (!contributions.some((entry) => asRecord(entry)?.slot === "overlay")) {
    errors.push("Scene layout must include an overlay contribution.");
  }
  validateSceneSnapshotRectAlignment("scene boot", boot, errors);
}

function validateFullscreenEvidence(fullscreen: Record<string, unknown> | null, errors: string[]): void {
  if (!fullscreen) {
    errors.push("fullscreen evidence is required.");
    return;
  }
  if (fullscreen.actorInputEnterRestores !== true) {
    errors.push("fullscreen evidence must show actor-input enter and restore.");
  }
  if (fullscreen.resizeFollowsViewport !== true) {
    errors.push("fullscreen evidence must show Scene resizing with browser viewport.");
  }
  if (fullscreen.restoreControlVisibleAfterResize !== true) {
    errors.push("fullscreen evidence must show restore control visibility after resize.");
  }
  if (fullscreen.coversTopDockedMenu !== true) {
    errors.push("fullscreen evidence must show Scene covering top-docked menu.");
  }
  if (fullscreen.blocksTopDockedMenuInput !== true) {
    errors.push("fullscreen evidence must show top-docked menu input blocked.");
  }
  if (fullscreen.intentSourceActorId !== "scene-window:view:world-render-view") {
    errors.push("fullscreen intent must originate from the World Render View actor.");
  }
  if (fullscreen.lifecycleTargetActorId !== "scene-window:view") {
    errors.push("fullscreen lifecycle target must be the registered Scene root actor.");
  }
  const entered = asRecord(fullscreen.entered);
  const resized = asRecord(fullscreen.resized);
  const restored = asRecord(fullscreen.restored);
  if (entered?.controlState !== "fullscreen") errors.push("fullscreen enter evidence must set fullscreen state.");
  if (resized?.controlState !== "fullscreen") errors.push("fullscreen resized evidence must stay fullscreen.");
  if (restored?.controlState !== "windowed") errors.push("fullscreen restore evidence must set windowed state.");
  validateSceneRootFillRect("fullscreen entered", entered, errors);
  validateFullscreenResizeEvidence(resized, errors);
  validateTopDockedMenuProbe(asRecord(fullscreen.topDockedMenuProbe), errors);
  validateSceneRootFillRect("fullscreen restored", restored, errors);
}

function validateCloseReopenEvidence(closeReopen: Record<string, unknown> | null, errors: string[]): void {
  const iterations = Array.isArray(closeReopen?.iterations) ? closeReopen.iterations : [];
  if (iterations.length < 3) {
    errors.push("close/reopen evidence must contain at least three iterations.");
  }
  for (const [index, entry] of iterations.entries()) {
    const record = asRecord(entry);
    if (record?.exactOnce !== true) {
      errors.push(`close/reopen iteration ${index + 1} must be exact-once.`);
    }
    if (record?.noStaleAfterClose !== true) {
      errors.push(`close/reopen iteration ${index + 1} must not leave stale Scene DOM after close.`);
    }
    if (record?.staleCanvasCount !== 0) {
      errors.push(`close/reopen iteration ${index + 1} stale canvas count must be 0.`);
    }
    if (record?.staleFrameSourceCount !== 0) {
      errors.push(`close/reopen iteration ${index + 1} stale frame-source count must be 0.`);
    }
    if (record?.staleRenderViewportCount !== 0) {
      errors.push(`close/reopen iteration ${index + 1} stale render viewport count must be 0.`);
    }
  }
}

function validateDockSanityEvidence(dockSanity: Record<string, unknown> | null, errors: string[]): void {
  if (dockSanity?.debugToScene !== true) errors.push("dock sanity must include Debug -> Scene.");
  if (dockSanity?.sceneToDebug !== true) errors.push("dock sanity must include Scene -> Debug.");
}

function validateMobileEvidence(mobile: Record<string, unknown> | null, errors: string[]): void {
  const clickable = asRecord(mobile?.clickableIntersections);
  for (const key of ["menu", "renderViewport", "camera3", "fullscreenControl"] as const) {
    if (clickable?.[key] !== true) errors.push(`mobile ${key} must have a clickable viewport intersection.`);
  }
  const snapshot = asRecord(mobile?.snapshot) as Partial<SceneArborSnapshot> | null;
  if (snapshot) validateSceneSnapshotRectAlignment("mobile Scene", snapshot, errors);
}

function validatePersistenceEvidence(persistence: Record<string, unknown> | null, errors: string[]): void {
  if (persistence?.version !== 2) errors.push("persistence version must be 2.");
  if (persistence?.containsRuntimeOnlyIds !== false) {
    errors.push("persistence must not contain runtime-only ids.");
  }
}

function validateActorInputEvidence(routeEvidence: Record<string, unknown> | null, errors: string[]): void {
  const hits = Array.isArray(routeEvidence?.hits) ? routeEvidence.hits : [];
  if (!hits.some((entry) => asRecord(entry)?.partId === "menu-item")) {
    errors.push("actor-input evidence must include menu-item.");
  }
  if (!hits.some((entry) => asRecord(entry)?.partId === "fullscreen-toggle")) {
    errors.push("actor-input evidence must include fullscreen-toggle.");
  }
  if (!hits.some((entry) => asRecord(entry)?.partId === "projection-mode")) {
    errors.push("actor-input evidence must include Camera3 projection-mode.");
  }
}

function createValidEvidence(snapshotOverrides: Partial<SceneArborSnapshot> = {}): ProjectArborFinalSmokeEvidence {
  const sceneRoot = rect(0, 57, 1280, 663);
  const worldRenderView = rect(0, 57, 1280, 663);
  const camera3 = rect(1126, 79, 132, 150);
  const snapshot: SceneArborSnapshot = {
    sceneRoot,
    sceneRootLayout: {},
    worldRenderView,
    renderViewport: worldRenderView,
    renderTarget: worldRenderView,
    fullscreenControl: rect(1232, 672, 40, 40),
    camera3Host: camera3,
    camera3Gizmo: camera3,
    layoutContributions: [
      { actorId: "scene-window:view:world-render-view", slot: "fill", rect: worldRenderView },
      { actorId: "scene-window:view:camera-3", slot: "overlay", rect: sceneRoot }
    ],
    canvasCount: 1,
    renderViewportCount: 1,
    camera3HostCount: 1,
    sceneRootCount: 1,
    worldRenderViewCount: 1,
    ...snapshotOverrides
  };
  return {
    kind: "project-arbor-final-smoke",
    passed: true,
    validationErrors: [],
    consoleErrors: [],
    scene: { boot: snapshot },
    menu: {
      hoverExactOne: true,
      activationCreatedNewInspector: true,
      escapeDismissed: true,
      hoverSnapshots: [{ items: [{ highlighted: true }] }]
    },
    fullscreen: {
      actorInputEnterRestores: true,
      resizeFollowsViewport: true,
      restoreControlVisibleAfterResize: true,
      coversTopDockedMenu: true,
      blocksTopDockedMenuInput: true,
      topDockedMenuProbe: {
        topElement: { className: "floating-gizmo-window scene-window floating-gizmo-window--fullscreen", insideFullscreen: true },
        fullscreenZIndex: 11000,
        menuZIndex: 10000,
        floatingOverlay: { position: "fixed", zIndex: "auto" },
        afterClick: { popupOpen: false, actorInputHits: [] }
      },
      intentSourceActorId: "scene-window:view:world-render-view",
      lifecycleTargetActorId: "scene-window:view",
      entered: {
        controlState: "fullscreen",
        sceneRoot: rect(0, 0, 1280, 720),
        worldRenderView: rect(0, 0, 1280, 720)
      },
      resized: {
        viewport: { width: 390, height: 844 },
        controlState: "fullscreen",
        sceneRoot: rect(0, 0, 390, 844),
        worldRenderView: rect(0, 0, 390, 844),
        renderViewport: rect(0, 0, 390, 844),
        renderTarget: rect(0, 0, 390, 844),
        fullscreenControl: rect(342, 796, 40, 40)
      },
      restored: {
        controlState: "windowed",
        sceneRoot,
        worldRenderView
      }
    },
    closeReopen: {
      iterations: [
        {
          exactOnce: true,
          noStaleAfterClose: true,
          staleCanvasCount: 0,
          staleFrameSourceCount: 0,
          staleRenderViewportCount: 0
        },
        {
          exactOnce: true,
          noStaleAfterClose: true,
          staleCanvasCount: 0,
          staleFrameSourceCount: 0,
          staleRenderViewportCount: 0
        },
        {
          exactOnce: true,
          noStaleAfterClose: true,
          staleCanvasCount: 0,
          staleFrameSourceCount: 0,
          staleRenderViewportCount: 0
        }
      ]
    },
    dockSanity: { debugToScene: true, sceneToDebug: true },
    mobile: {
      snapshot,
      clickableIntersections: { menu: true, renderViewport: true, camera3: true, fullscreenControl: true }
    },
    persistence: { version: 2, containsRuntimeOnlyIds: false },
    actorInputRouteEvidence: {
      hits: [{ partId: "menu-item" }, { partId: "fullscreen-toggle" }, { partId: "projection-mode" }]
    }
  };
}

function rect(x = 0, y = 0, width = 10, height = 10): SmokeRect {
  return { x, y, width, height, right: x + width, bottom: y + height };
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function isMeasurableRect(rectValue: unknown): rectValue is SmokeRect {
  const candidate = asRecord(rectValue);
  return typeof candidate?.width === "number" &&
    typeof candidate.height === "number" &&
    candidate.width > 0 &&
    candidate.height > 0;
}

function rectContains(parent: unknown, child: unknown): boolean {
  if (!isMeasurableRect(parent) || !isMeasurableRect(child)) return false;
  const parentRight = parent.right ?? parent.x + parent.width;
  const parentBottom = parent.bottom ?? parent.y + parent.height;
  const childRight = child.right ?? child.x + child.width;
  const childBottom = child.bottom ?? child.y + child.height;
  return child.x >= parent.x &&
    child.y >= parent.y &&
    childRight <= parentRight &&
    childBottom <= parentBottom;
}

function validateSceneSnapshotRectAlignment(
  label: string,
  snapshot: Partial<SceneArborSnapshot>,
  errors: string[]
): void {
  if (isMeasurableRect(snapshot.worldRenderView) && isMeasurableRect(snapshot.renderViewport)) {
    requireSameRect(
      snapshot.worldRenderView,
      snapshot.renderViewport,
      `${label} World Render View and render viewport rects must match.`, errors
    );
  }
  if (isMeasurableRect(snapshot.renderViewport) && isMeasurableRect(snapshot.renderTarget)) {
    requireSameRect(
      snapshot.renderViewport,
      snapshot.renderTarget,
      `${label} render viewport and render target rects must match.`, errors
    );
  }
  const nonOverlayContributions = Array.isArray(snapshot.layoutContributions)
    ? snapshot.layoutContributions
      .map(asRecord)
      .filter((entry): entry is Record<string, unknown> => !!entry && entry.slot !== "overlay")
    : [];
  const overlayContributions = Array.isArray(snapshot.layoutContributions)
    ? snapshot.layoutContributions
      .map(asRecord)
      .filter((entry): entry is Record<string, unknown> => !!entry && entry.slot === "overlay")
    : [];
  const fillContribution = nonOverlayContributions.length === 1 &&
    nonOverlayContributions[0].slot === "fill"
    ? nonOverlayContributions[0]
    : null;
  const fillRect = fillContribution?.rect;
  if (fillContribution && isMeasurableRect(snapshot.sceneRoot) && isMeasurableRect(fillRect)) {
    requireSameRect(
      snapshot.sceneRoot,
      fillRect,
      `${label} fill contribution must fill the Scene root when it is the only non-overlay layout contribution.`,
      errors
    );
  }
  if (fillContribution && isMeasurableRect(fillRect) && isMeasurableRect(snapshot.worldRenderView)) {
    requireSameRect(
      fillRect,
      snapshot.worldRenderView,
      `${label} World Render View must fill the fill contribution rect.`,
      errors
    );
  }
  for (const overlayContribution of overlayContributions) {
    if (isMeasurableRect(snapshot.sceneRoot) && isMeasurableRect(overlayContribution.rect)) {
      requireSameRect(
        snapshot.sceneRoot,
        overlayContribution.rect,
        `${label} overlay contribution must cover the Scene root.`,
        errors
      );
    }
  }
}

function validateSceneRootFillRect(
  label: string,
  snapshot: Record<string, unknown> | null,
  errors: string[]
): void {
  if (!snapshot) return;
  const sceneRoot = snapshot.sceneRoot;
  const worldRenderView = snapshot.worldRenderView;
  if (!isMeasurableRect(sceneRoot) || !isMeasurableRect(worldRenderView)) return;
  requireSameRect(
    sceneRoot,
    worldRenderView,
    `${label} World Render View must fill the Scene root.`,
    errors
  );
}

function validateFullscreenResizeEvidence(
  snapshot: Record<string, unknown> | null,
  errors: string[]
): void {
  if (!snapshot) {
    errors.push("fullscreen resized evidence is required.");
    return;
  }
  const viewport = asRecord(snapshot.viewport);
  if (typeof viewport?.width !== "number" || typeof viewport.height !== "number") {
    errors.push("fullscreen resized evidence must include viewport dimensions.");
    return;
  }
  if (!rectMatchesViewport(snapshot.sceneRoot, viewport)) {
    errors.push("fullscreen resized Scene root must match the resized viewport.");
  }
  validateSceneRootFillRect("fullscreen resized", snapshot, errors);
  requireSameRect(
    snapshot.worldRenderView,
    snapshot.renderViewport,
    "fullscreen resized World Render View and render viewport rects must match.",
    errors
  );
  requireSameRect(
    snapshot.renderViewport,
    snapshot.renderTarget,
    "fullscreen resized render viewport and render target rects must match.",
    errors
  );
  if (!rectIntersectsViewport(snapshot.fullscreenControl, viewport)) {
    errors.push("fullscreen restore control must stay visible after resize.");
  }
}

function validateTopDockedMenuProbe(probe: Record<string, unknown> | null, errors: string[]): void {
  if (!probe) {
    errors.push("fullscreen top-docked menu probe is required.");
    return;
  }
  const topElement = asRecord(probe.topElement);
  if (topElement?.insideFullscreen !== true) {
    errors.push("fullscreen top-docked menu probe top element must be inside fullscreen Scene.");
  }
  if (
    typeof probe.fullscreenZIndex !== "number" ||
    typeof probe.menuZIndex !== "number" ||
    probe.fullscreenZIndex <= probe.menuZIndex
  ) {
    errors.push("fullscreen z-index must be greater than top-docked menu z-index.");
  }
  const floatingOverlay = asRecord(probe.floatingOverlay);
  if (
    typeof floatingOverlay?.position !== "string" ||
    !("zIndex" in (floatingOverlay ?? {}))
  ) {
    errors.push("fullscreen menu-cover evidence must include floating overlay stacking data.");
  }
  const afterClick = asRecord(probe.afterClick);
  if (afterClick?.popupOpen === true) {
    errors.push("fullscreen click at menu position must not open the top-docked menu.");
  }
}

function requireSameRect(a: unknown, b: unknown, message: string, errors: string[]): void {
  if (!isMeasurableRect(a) || !isMeasurableRect(b)) return;
  if (!sameRect(a, b)) errors.push(message);
}

function rectMatchesViewport(rectValue: unknown, viewport: Record<string, unknown>): boolean {
  if (!isMeasurableRect(rectValue)) return false;
  return nearlyEqual(rectValue.x, 0) &&
    nearlyEqual(rectValue.y, 0) &&
    nearlyEqual(rectValue.width, viewport.width as number) &&
    nearlyEqual(rectValue.height, viewport.height as number);
}

function rectIntersectsViewport(rectValue: unknown, viewport: Record<string, unknown>): boolean {
  if (!isMeasurableRect(rectValue)) return false;
  const width = viewport.width;
  const height = viewport.height;
  if (typeof width !== "number" || typeof height !== "number") return false;
  return rectValue.x < width &&
    rectValue.x + rectValue.width > 0 &&
    rectValue.y < height &&
    rectValue.y + rectValue.height > 0;
}

function sameRect(a: SmokeRect, b: SmokeRect): boolean {
  return nearlyEqual(a.x, b.x) &&
    nearlyEqual(a.y, b.y) &&
    nearlyEqual(a.width, b.width) &&
    nearlyEqual(a.height, b.height);
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1;
}

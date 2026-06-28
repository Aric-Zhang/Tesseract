import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const url = "http://127.0.0.1:5173/?resetWorkspaceLayout=1";
const dataPath = resolve(workspaceRoot, "temp/project-arbor-final-smoke-data.json");
const reportPath = resolve(workspaceRoot, "temp/project-arbor-final-smoke-report.md");
const layoutStorageKey = "wallpaper-tesseract.windowWorkspaceFrameLayout.v1";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
const capturedActorInputHits = [];

await page.addInitScript(() => {
  globalThis.__PROJECT_PRISM_ACTOR_INPUT_CAPTURE__ = (entry) => {
    const state = globalThis.__PROJECT_ARBOR_FINAL_ACTOR_INPUT__ ?? [];
    state.push(entry);
    globalThis.__PROJECT_ARBOR_FINAL_ACTOR_INPUT__ = state;
  };
});

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

await resetWorkspaceBaseline();

const boot = await snapshotScene("boot");
const menu = await exerciseMenu();
await captureActorInputHits();
await resetWorkspaceBaseline();
const fullscreen = await exerciseFullscreen();
await exerciseCamera3();
const closeReopen = await exerciseCloseReopen();
await captureActorInputHits();
await resetWorkspaceBaseline();
await ensureViewOpen("debug");
await ensureViewOpen("scene");
const dockSanity = await exerciseDockSanity();
await captureActorInputHits();
await resetWorkspaceBaseline();
const mobile = await exerciseMobileViewport();
const persistence = await readPersistenceEvidence();
await captureActorInputHits();
const actorInputRouteEvidence = {
  hits: capturedActorInputHits
};

const evidence = {
  kind: "project-arbor-final-smoke",
  generatedAt: new Date().toISOString(),
  url,
  passed: true,
  validationErrors: [],
  consoleErrors,
  desktopViewport: { width: 1280, height: 720 },
  scene: { boot },
  menu,
  fullscreen,
  closeReopen,
  dockSanity,
  mobile,
  persistence,
  actorInputRouteEvidence
};

validateEvidence(evidence);

await writeFile(dataPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(reportPath, [
  "# Project Arbor Final Smoke Report",
  "",
  `Evidence file: ${dataPath}`,
  `Generated: ${evidence.generatedAt}`,
  `Passed: ${evidence.passed ? "yes" : "no"}`,
  "",
  "## Coverage",
  "",
  `- Console errors: ${consoleErrors.length}`,
  `- Menu hover exact-one highlights: ${menu.hoverExactOne}`,
  `- Menu activation created Inspector: ${menu.activationCreatedNewInspector}`,
  `- Scene root exact-once: ${boot.sceneRootCount === 1}`,
  `- World Render View exact-once: ${boot.worldRenderViewCount === 1}`,
  `- Canvas exact-once: ${boot.canvasCount === 1}`,
  `- Camera3 overlay exact-once: ${boot.camera3HostCount === 1}`,
  `- Fullscreen actor-input enter/restore: ${fullscreen.actorInputEnterRestores}`,
  `- Fullscreen follows browser resize: ${fullscreen.resizeFollowsViewport}`,
  `- Fullscreen restore control visible after resize: ${fullscreen.restoreControlVisibleAfterResize}`,
  `- Fullscreen covers top-docked menu: ${fullscreen.coversTopDockedMenu}`,
  `- Fullscreen blocks top-docked menu input: ${fullscreen.blocksTopDockedMenuInput}`,
  `- Close/reopen iterations: ${closeReopen.iterations.length}`,
  `- Close/reopen stale counts: ${closeReopen.iterations.map((entry) => `#${entry.index} canvas=${entry.staleCanvasCount} frameSource=${entry.staleFrameSourceCount}`).join(", ")}`,
  `- Debug -> Scene dock changed layout: ${dockSanity.debugToScene}`,
  `- Scene -> Debug dock changed layout: ${dockSanity.sceneToDebug}`,
  `- Mobile clickable intersections: ${Object.entries(mobile.clickableIntersections).map(([key, value]) => `${key}=${value}`).join(", ")}`,
  `- Persistence v2 without runtime-only ids: ${persistence.version === 2 && !persistence.containsRuntimeOnlyIds}`,
  `- Actor-input fullscreen hits: ${actorInputRouteEvidence.hits.filter((entry) => entry.partId === "fullscreen-toggle").length}`,
  `- Actor-input Camera3 hits: ${actorInputRouteEvidence.hits.filter((entry) => entry.partId === "projection-mode").length}`,
  "",
  "## Validation Errors",
  "",
  evidence.validationErrors.length === 0
    ? "- none"
    : evidence.validationErrors.map((error) => `- ${error}`).join("\n")
].join("\n"), "utf8");

await browser.close();

if (!evidence.passed) {
  console.error(JSON.stringify(evidence.validationErrors, null, 2));
  process.exit(1);
}
console.log(`Wrote ${dataPath}`);
console.log(`Wrote ${reportPath}`);

async function exerciseFullscreen() {
  const before = await snapshotScene("fullscreen-before");
  await clickCenter(".ui-fullscreenable-view__control");
  await page.waitForTimeout(350);
  const entered = await snapshotScene("fullscreen-entered");
  const topDockedMenuProbe = await probeTopDockedMenuDuringFullscreen();
  const resizedViewport = { width: 390, height: 844 };
  await page.setViewportSize(resizedViewport);
  await page.waitForTimeout(350);
  const resized = await snapshotScene("fullscreen-resized");
  await clickCenter(".ui-fullscreenable-view__control");
  await page.waitForTimeout(350);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(350);
  const restored = await snapshotScene("fullscreen-restored");
  const worldContribution = before.layoutContributions.find((entry) => entry.slot === "fill");
  const resizeFollowsViewport =
    rectMatchesViewport(resized.sceneRoot, resizedViewport) &&
    sameRect(resized.sceneRoot, resized.worldRenderView) &&
    sameRect(resized.worldRenderView, resized.renderViewport) &&
    sameRect(resized.renderViewport, resized.renderTarget);
  return {
    actorInputEnterRestores:
      entered.fullscreenControlState === "fullscreen" &&
      restored.fullscreenControlState === "windowed",
    resizeFollowsViewport,
    restoreControlVisibleAfterResize: intersectsViewport(resized.fullscreenControl, resizedViewport),
    coversTopDockedMenu: topDockedMenuProbe.coversTopDockedMenu,
    blocksTopDockedMenuInput: topDockedMenuProbe.blocksTopDockedMenuInput,
    topDockedMenuProbe,
    intentSourceActorId: worldContribution?.actorId ?? "",
    lifecycleTargetActorId: "scene-window:view",
    before,
    entered: {
      controlState: entered.fullscreenControlState,
      sceneRoot: entered.sceneRoot,
      worldRenderView: entered.worldRenderView
    },
    resized: {
      viewport: resizedViewport,
      controlState: resized.fullscreenControlState,
      sceneRoot: resized.sceneRoot,
      worldRenderView: resized.worldRenderView,
      renderViewport: resized.renderViewport,
      renderTarget: resized.renderTarget,
      fullscreenControl: resized.fullscreenControl
    },
    restored: {
      controlState: restored.fullscreenControlState,
      sceneRoot: restored.sceneRoot,
      worldRenderView: restored.worldRenderView
    },
    programmaticRunDevelopCoveredByUnitTest: "scene-run-mode-command delegates run/develop to the same workspace presentation port"
  };
}

async function exerciseMenu() {
  await clickWindowMenu();
  const opened = await snapshotMenu("menu-opened");
  const hoverSnapshots = [];
  for (let index = 0; index < opened.items.length; index += 1) {
    hoverSnapshots.push(await hoverMenuItem(index));
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  const dismissed = await snapshotMenu("menu-dismissed");
  await clickWindowMenu();
  const beforeNewInspector = await snapshotMenu("menu-before-new-inspector");
  const newInspectorItem = beforeNewInspector.items.find((item) => item.id === "new:inspector");
  if (!newInspectorItem?.rect) throw new Error("Missing New Inspector menu item");
  await page.mouse.click(
    newInspectorItem.rect.x + newInspectorItem.rect.width / 2,
    newInspectorItem.rect.y + newInspectorItem.rect.height / 2
  );
  await page.waitForTimeout(300);
  const afterNewInspector = await snapshotMenu("menu-after-new-inspector");
  return {
    opened,
    hoverSnapshots,
    dismissed,
    hoverExactOne: hoverSnapshots.length > 0 &&
      hoverSnapshots.every((entry) => entry.items.filter((item) => item.highlighted).length === 1),
    activationCreatedNewInspector: afterNewInspector.inspectorTabCount > beforeNewInspector.inspectorTabCount,
    escapeDismissed: dismissed.popupHidden === true,
    beforeNewInspector,
    afterNewInspector
  };
}

async function hoverMenuItem(index) {
  const item = page.locator(".ui-menu-item").nth(index);
  const box = await item.boundingBox();
  if (!box) throw new Error(`Missing menu item ${index}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(100);
  return await snapshotMenu(`menu-hover-${index}`);
}

async function snapshotMenu(label) {
  return await page.evaluate((snapshotLabel) => {
    const rectOf = (element) => element ? rectToObject(element.getBoundingClientRect()) : null;
    const popup = document.querySelector(".ui-popup-menu");
    return {
      label: snapshotLabel,
      menuBar: rectOf(document.querySelector(".ui-menu-bar")),
      menuBarDataset: { ...(document.querySelector(".ui-menu-bar")?.dataset ?? {}) },
      popup: rectOf(popup),
      popupHidden: popup?.hidden ?? null,
      popupDataset: { ...(popup?.dataset ?? {}) },
      items: Array.from(document.querySelectorAll(".ui-menu-item")).map((element) => ({
        id: element.dataset.uiMenuItemId ?? "",
        label: element.textContent ?? "",
        highlighted: element.dataset.uiMenuHighlighted === "true",
        hidden: element.hidden,
        role: element.getAttribute("role"),
        rect: rectOf(element)
      })),
      inspectorTabCount: Array.from(document.querySelectorAll(".window-frame-tab"))
        .filter((element) => (element.textContent ?? "").toLowerCase().includes("inspector")).length
    };

    function rectToObject(rect) {
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom
      };
    }
  }, label);
}

async function probeTopDockedMenuDuringFullscreen() {
  const beforeClick = await page.evaluate(() => {
    const menuItem = document.querySelector(".ui-menu-bar-item");
    const menuRect = menuItem?.getBoundingClientRect();
    const point = menuRect
      ? { x: menuRect.left + menuRect.width / 2, y: menuRect.top + menuRect.height / 2 }
      : { x: 0, y: 0 };
    return readTopDockedMenuProbe(point);

    function readTopDockedMenuProbe(point) {
      const fullscreenFrame = document.querySelector(".floating-gizmo-window--fullscreen");
      const menuSlot = document.querySelector(".app-shell__menu");
      const floatingOverlay = document.querySelector(".app-shell__floating-overlay");
      const elements = document.elementsFromPoint(point.x, point.y);
      const topElement = elements[0] ?? null;
      return {
        point,
        topElement: describeElement(topElement),
        elementsFromPoint: elements.slice(0, 8).map(describeElement),
        fullscreenZIndex: readZIndex(fullscreenFrame),
        menuZIndex: readZIndex(menuSlot),
        floatingOverlay: describeComputed(floatingOverlay),
        topElementInsideFullscreen: Boolean(topElement?.closest(".floating-gizmo-window--fullscreen")),
        popupOpen: Boolean(document.querySelector(".ui-popup-menu:not([hidden])"))
      };
    }

    function describeComputed(element) {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        className: element.className,
        position: style.position,
        zIndex: style.zIndex
      };
    }

    function describeElement(element) {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        tagName: element.tagName,
        className: element.className,
        text: (element.textContent ?? "").trim().slice(0, 48),
        position: style.position,
        zIndex: style.zIndex,
        insideFullscreen: Boolean(element.closest(".floating-gizmo-window--fullscreen"))
      };
    }

    function readZIndex(element) {
      if (!element) return null;
      const value = getComputedStyle(element).zIndex;
      return value === "auto" ? null : Number(value);
    }
  });
  const previousActorInputHits = await page.evaluate(() => globalThis.__PROJECT_ARBOR_FINAL_ACTOR_INPUT__ ?? []);
  await page.evaluate(() => {
    globalThis.__PROJECT_ARBOR_FINAL_ACTOR_INPUT__ = [];
  });
  await page.mouse.click(beforeClick.point.x, beforeClick.point.y);
  await page.waitForTimeout(250);
  const afterClick = await page.evaluate((point) => ({
    popupOpen: Boolean(document.querySelector(".ui-popup-menu:not([hidden])")),
    actorInputHits: globalThis.__PROJECT_ARBOR_FINAL_ACTOR_INPUT__ ?? [],
    topElementAfterClick: (() => {
      const element = document.elementsFromPoint(point.x, point.y)[0] ?? null;
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        tagName: element.tagName,
        className: element.className,
        text: (element.textContent ?? "").trim().slice(0, 48),
        position: style.position,
        zIndex: style.zIndex,
        insideFullscreen: Boolean(element.closest(".floating-gizmo-window--fullscreen"))
      };
    })()
  }), beforeClick.point);
  await page.evaluate(({ previousHits, probeHits }) => {
    globalThis.__PROJECT_ARBOR_FINAL_ACTOR_INPUT__ = [...previousHits, ...probeHits];
  }, {
    previousHits: previousActorInputHits,
    probeHits: afterClick.actorInputHits
  });
  const menuHit = afterClick.actorInputHits.some((entry) => {
    const componentId = String(entry.componentId ?? "");
    const actorId = String(entry.actorId ?? "");
    const partId = String(entry.partId ?? "");
    return componentId.includes("ui-menu") ||
      actorId.includes("app-menu") ||
      partId === "menu-bar-item" ||
      partId === "menu-item";
  });
  return {
    ...beforeClick,
    afterClick,
    coversTopDockedMenu: beforeClick.topElementInsideFullscreen &&
      typeof beforeClick.fullscreenZIndex === "number" &&
      typeof beforeClick.menuZIndex === "number" &&
      beforeClick.fullscreenZIndex > beforeClick.menuZIndex,
    blocksTopDockedMenuInput: !afterClick.popupOpen && !menuHit
  };
}

async function exerciseCamera3() {
  const mode = page.locator(".camera3-gizmo__mode").first();
  const box = await mode.boundingBox();
  if (!box) throw new Error("Missing Camera3 mode control");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
}

async function exerciseCloseReopen() {
  const iterations = [];
  for (let index = 0; index < 3; index += 1) {
    await closeViewTab("scene");
    await page.waitForTimeout(300);
    const afterClose = await snapshotScene(`close-reopen-${index + 1}-closed`);
    await ensureViewOpen("scene");
    await page.waitForTimeout(500);
    const reopened = await snapshotScene(`close-reopen-${index + 1}-reopened`);
    iterations.push({
      index: index + 1,
      exactOnce: reopened.sceneRootCount === 1 &&
        reopened.worldRenderViewCount === 1 &&
        reopened.renderViewportCount === 1 &&
        reopened.canvasCount === 1 &&
        reopened.camera3HostCount === 1,
      staleCanvasCount: afterClose.canvasCount,
      staleFrameSourceCount: afterClose.worldRenderViewCount,
      staleRenderViewportCount: afterClose.renderViewportCount,
      noStaleAfterClose: afterClose.sceneRootCount === 0 &&
        afterClose.worldRenderViewCount === 0 &&
        afterClose.renderViewportCount === 0 &&
        afterClose.canvasCount === 0 &&
        afterClose.camera3HostCount === 0,
      afterClose,
      reopened
    });
  }
  return { iterations };
}

async function exerciseDockSanity() {
  const beforeDebugToScene = await rootDockState();
  const debugDrag = await dragTabInto("debug", ".scene-view", 0.95, 0.5);
  const afterDebugToScene = await rootDockState();
  await page.waitForTimeout(300);
  const beforeSceneToDebug = await rootDockState();
  const sceneDrag = await dragTabInto("scene", ".debug-log-window__content", 0.95, 0.5);
  const afterSceneToDebug = await rootDockState();
  await page.waitForTimeout(300);
  return {
    debugToScene: debugDrag &&
      beforeDebugToScene.floatingDebug === true &&
      afterDebugToScene.floatingDebug === false &&
      afterDebugToScene.rootTabs.some((tab) => tab.toLowerCase().includes("debug")) &&
      afterDebugToScene.splitterCount > beforeDebugToScene.splitterCount,
    sceneToDebug: sceneDrag &&
      afterSceneToDebug.floatingDebug === false &&
      afterSceneToDebug.rootTabs.some((tab) => tab.toLowerCase().includes("scene")) &&
      afterSceneToDebug.rootTabs.some((tab) => tab.toLowerCase().includes("debug")) &&
      JSON.stringify(beforeSceneToDebug.rootTabs) !== JSON.stringify(afterSceneToDebug.rootTabs),
    beforeDebugToScene,
    afterDebugToScene,
    beforeSceneToDebug,
    afterSceneToDebug
  };
}

async function exerciseMobileViewport() {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  const snapshot = await snapshotScene("mobile");
  const menuRect = await rectForSelector(".ui-menu-bar");
  const viewport = { width: 390, height: 844 };
  return {
    viewport,
    snapshot,
    menuRect,
    clickableIntersections: {
      menu: intersectsViewport(menuRect, viewport),
      renderViewport: intersectsViewport(snapshot.renderViewport, viewport),
      camera3: intersectsViewport(snapshot.camera3Gizmo, viewport),
      fullscreenControl: intersectsViewport(snapshot.fullscreenControl, viewport)
    }
  };
}

async function readPersistenceEvidence() {
  await page.waitForTimeout(300);
  return await page.evaluate((key) => {
    const raw = localStorage.getItem(key) ?? "";
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    return {
      key,
      rawLength: raw.length,
      version: parsed?.version ?? null,
      containsRuntimeOnlyIds: /world-render-view|camera-3|render-output|ui-render-viewport|fullscreen|canvas/i.test(raw)
    };
  }, layoutStorageKey);
}

async function resetWorkspaceBaseline() {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await closeOptionalViewTab("hierarchy");
}

async function captureActorInputHits() {
  const hits = await page.evaluate(() => globalThis.__PROJECT_ARBOR_FINAL_ACTOR_INPUT__ ?? []);
  capturedActorInputHits.push(...hits);
  await page.evaluate(() => {
    globalThis.__PROJECT_ARBOR_FINAL_ACTOR_INPUT__ = [];
  });
}

async function ensureViewOpen(typeKey) {
  const existing = await findTabBox(typeKey);
  if (existing) return;
  await clickWindowMenu();
  const item = page.locator(".ui-menu-item").evaluateAll((items, targetTypeKey) => {
    const match = items.find((element) => element.dataset.uiMenuItemId === `type:${targetTypeKey}`);
    if (!match) return null;
    const rect = match.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, typeKey);
  const box = await item;
  if (!box) throw new Error(`Missing Window menu item for ${typeKey}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(450);
}

async function clickWindowMenu() {
  const item = page.locator(".ui-menu-bar-item").first();
  const box = await item.boundingBox();
  if (!box) throw new Error("Missing Window menu bar item");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
}

async function closeViewTab(label) {
  const box = await findTabBox(label);
  if (!box) throw new Error(`Missing ${label} tab`);
  await page.mouse.click(box.x + box.width - 14, box.y + box.height / 2);
}

async function closeOptionalViewTab(label) {
  const box = await findTabBox(label);
  if (!box) return false;
  await page.mouse.click(box.x + box.width - 14, box.y + box.height / 2);
  await page.waitForTimeout(300);
  return true;
}

async function dragTabInto(label, targetSelector, targetXRatio, targetYRatio) {
  const source = await findTabBox(label);
  const target = await rectForSelector(targetSelector);
  if (!source || !target) return false;
  const start = {
    x: source.x + Math.min(28, source.width / 2),
    y: source.y + source.height / 2
  };
  const end = {
    x: target.x + target.width * targetXRatio,
    y: target.y + target.height * targetYRatio
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  return true;
}

async function findTabBox(label) {
  return await page.evaluate((targetLabel) => {
    const candidates = Array.from(document.querySelectorAll(
      ".window-frame-tab, .workspace-root-dock-frame__tab, .floating-gizmo-window__tab"
    ));
    const match = candidates.find((element) => (element.textContent ?? "").toLowerCase().includes(targetLabel));
    if (!match) return null;
    const rect = match.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      text: match.textContent ?? ""
    };
  }, label.toLowerCase());
}

async function clickCenter(selector) {
  const rect = await rectForSelector(selector);
  if (!rect) throw new Error(`Missing ${selector}`);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function rectForSelector(selector) {
  return await page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom
    };
  }, selector);
}

async function snapshotScene(label) {
  return await page.evaluate((snapshotLabel) => {
    const rectOf = (element) => element ? rectToObject(element.getBoundingClientRect()) : null;
    const sceneRoot = document.querySelector(".scene-view");
    const renderViewport = document.querySelector(".ui-render-viewport");
    const fullscreenControl = document.querySelector(".ui-fullscreenable-view__control");
    const layoutContributions = Array.from(document.querySelectorAll(".scene-view [data-ui-layout-actor-id]"))
      .map((element) => ({
        actorId: element.dataset.uiLayoutActorId ?? "",
        slot: element.dataset.uiLayoutSlot ?? "",
        layer: Number(element.dataset.uiLayoutLayer ?? 0),
        stretch: element.dataset.uiLayoutStretch ?? "",
        rect: rectOf(element)
      }));
    return {
      label: snapshotLabel,
      sceneRoot: rectOf(sceneRoot),
      sceneRootLayout: sceneRoot?.querySelector("[data-ui-layout-root='true']") ? {
        regions: Array.from(sceneRoot.querySelectorAll("[data-ui-layout-region]"))
          .map((element) => element.dataset.uiLayoutRegion ?? "")
      } : null,
      worldRenderView: rectOf(document.querySelector(".scene-world-render-view")),
      renderViewport: rectOf(renderViewport),
      renderTarget: rectOf(renderViewport?.querySelector("canvas") ?? null),
      fullscreenControl: rectOf(fullscreenControl),
      fullscreenControlState: fullscreenControl?.dataset.uiFullscreenState ?? null,
      camera3Host: rectOf(document.querySelector(".camera3-gizmo-host")),
      camera3Gizmo: rectOf(document.querySelector(".camera3-gizmo")),
      layoutContributions,
      canvasCount: document.querySelectorAll(".ui-render-viewport canvas").length,
      renderViewportCount: document.querySelectorAll(".ui-render-viewport").length,
      camera3HostCount: document.querySelectorAll(".camera3-gizmo-host").length,
      sceneRootCount: document.querySelectorAll(".scene-view").length,
      worldRenderViewCount: document.querySelectorAll(".scene-world-render-view").length
    };

    function rectToObject(rect) {
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom
      };
    }
  }, label);
}

async function rootDockState() {
  return await page.evaluate(() => ({
    floatingDebug: Boolean(document.querySelector(".floating-gizmo-window.debug-log-window")),
    floatingScene: Boolean(document.querySelector(".floating-gizmo-window.scene-window")),
    splitterCount: document.querySelectorAll(".workspace-root-dock-frame__splitter").length,
    rootTabs: Array.from(document.querySelectorAll(".workspace-root-dock-frame__tab"))
      .map((element) => (element.textContent ?? "").trim()),
    rootTabRects: Array.from(document.querySelectorAll(".workspace-root-dock-frame__tab"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: (element.textContent ?? "").trim(),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }),
    paneContentSignatures: Array.from(document.querySelectorAll(".workspace-root-dock-frame__pane-content"))
      .map((element) => (element.textContent ?? "").trim().slice(0, 48))
  }));
}

function validateEvidence(currentEvidence) {
  if (consoleErrors.length > 0) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Console errors were emitted.");
  }
  if (!currentEvidence.scene.boot.sceneRoot || currentEvidence.scene.boot.sceneRootCount !== 1) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Scene root is not exact-once.");
  }
  if (!currentEvidence.scene.boot.worldRenderView || currentEvidence.scene.boot.worldRenderViewCount !== 1) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("World Render View is not exact-once.");
  }
  if (!currentEvidence.scene.boot.renderViewport || !currentEvidence.scene.boot.renderTarget) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Render viewport/target evidence is missing.");
  }
  if (currentEvidence.scene.boot.canvasCount !== 1) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Scene canvas is not exact-once.");
  }
  if (currentEvidence.scene.boot.camera3HostCount !== 1) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Camera3 overlay host is not exact-once.");
  }
  if (!currentEvidence.menu.hoverExactOne) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Menu hover did not keep exactly one highlighted item.");
  }
  if (!currentEvidence.menu.activationCreatedNewInspector) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Menu activation did not create a New Inspector tab.");
  }
  if (!currentEvidence.menu.escapeDismissed) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Escape did not dismiss the menu popup.");
  }
  if (!currentEvidence.fullscreen.actorInputEnterRestores) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Fullscreen actor-input enter/restore failed.");
  }
  if (!currentEvidence.fullscreen.resizeFollowsViewport) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Fullscreen Scene does not follow browser resize.");
  }
  if (!currentEvidence.fullscreen.restoreControlVisibleAfterResize) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Fullscreen restore control is not visible after browser resize.");
  }
  if (!currentEvidence.fullscreen.coversTopDockedMenu) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Fullscreen Scene does not cover the top-docked menu.");
  }
  if (!currentEvidence.fullscreen.blocksTopDockedMenuInput) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Fullscreen Scene does not block top-docked menu input.");
  }
  if (currentEvidence.closeReopen.iterations.length < 3) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Close/reopen did not run at least three iterations.");
  }
  if (!currentEvidence.closeReopen.iterations.every((entry) => entry.exactOnce)) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Close/reopen exact-once failed.");
  }
  if (!currentEvidence.closeReopen.iterations.every((entry) => entry.noStaleAfterClose)) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Close/reopen left stale Scene DOM after close.");
  }
  if (!currentEvidence.dockSanity.debugToScene || !currentEvidence.dockSanity.sceneToDebug) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Dock sanity failed.");
  }
  if (!Object.values(currentEvidence.mobile.clickableIntersections).every(Boolean)) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Mobile clickable intersection failed.");
  }
  if (currentEvidence.persistence.version !== 2 || currentEvidence.persistence.containsRuntimeOnlyIds) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Persistence evidence is invalid.");
  }
  const hits = currentEvidence.actorInputRouteEvidence.hits;
  if (!hits.some((entry) => entry.partId === "fullscreen-toggle")) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Missing fullscreen-toggle actor-input hit.");
  }
  if (!hits.some((entry) => entry.partId === "menu-item")) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Missing menu-item actor-input hit.");
  }
  if (!hits.some((entry) => entry.partId === "projection-mode")) {
    currentEvidence.passed = false;
    currentEvidence.validationErrors.push("Missing Camera3 projection-mode actor-input hit.");
  }
}

function intersectsViewport(rect, viewport) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  return rect.x < viewport.width &&
    rect.x + rect.width > 0 &&
    rect.y < viewport.height &&
    rect.y + rect.height > 0;
}

function rectMatchesViewport(rect, viewport) {
  return !!rect &&
    nearlyEqual(rect.x, 0) &&
    nearlyEqual(rect.y, 0) &&
    nearlyEqual(rect.width, viewport.width) &&
    nearlyEqual(rect.height, viewport.height);
}

function sameRect(a, b) {
  return !!a &&
    !!b &&
    nearlyEqual(a.x, b.x) &&
    nearlyEqual(a.y, b.y) &&
    nearlyEqual(a.width, b.width) &&
    nearlyEqual(a.height, b.height);
}

function nearlyEqual(a, b) {
  return Math.abs(a - b) <= 1;
}

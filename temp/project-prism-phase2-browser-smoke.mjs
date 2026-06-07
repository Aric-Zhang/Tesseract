import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const port = process.env.PRISM_PHASE2_PORT ?? "56259";
const baseUrl = `http://127.0.0.1:${port}/?resetWorkspaceLayout=1`;
const outputJson = "temp/project-prism-phase2-browser-smoke.json";
const outputPng = "temp/project-prism-phase2-browser-smoke.png";

const errors = [];
const validationErrors = [];
const steps = [];

function rectSnapshot(rect) {
  if (!rect) {
    return null;
  }
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function assert(condition, message) {
  if (!condition) {
    validationErrors.push(message);
  }
}

async function readElementRect(page, selector, index = 0) {
  return page.locator(selector).nth(index).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function topStackAt(page, point) {
  return page.evaluate(({ x, y }) => {
    return document.elementsFromPoint(x, y).slice(0, 8).map((element) => ({
      tag: element.tagName.toLowerCase(),
      className: String(element.className ?? ""),
      text: element.textContent?.trim().slice(0, 80) ?? "",
      ariaLabel: element.getAttribute("aria-label"),
      role: element.getAttribute("role"),
    }));
  }, point);
}

async function clickWindowMenuItem(page, label) {
  const menuButton = page.locator(".app-menu-bar__button").first();
  const menuButtonRect = await menuButton.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await page.mouse.click(menuButtonRect.x + menuButtonRect.width / 2, menuButtonRect.y + menuButtonRect.height / 2);
  await page.waitForTimeout(150);
  const menuItem = page.locator(".app-menu-bar__menu-item", { hasText: label }).first();
  const menuItemRect = await menuItem.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await page.mouse.click(menuItemRect.x + menuItemRect.width / 2, menuItemRect.y + menuItemRect.height / 2);
  await page.waitForTimeout(300);
}

async function waitForNonZeroRect(page, selector, name) {
  await page.waitForFunction((sel) => {
    const element = document.querySelector(sel);
    if (!element) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, selector);
  const rect = await readElementRect(page, selector);
  steps.push({ name, rect: rectSnapshot(rect) });
  assert(rect.width > 0 && rect.height > 0, `${name} should have non-zero rect`);
  return rect;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push({ type: "console", text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    errors.push({ type: "pageerror", text: error.message });
  });

  await page.addInitScript(() => {
    window.__PROJECT_PRISM_PHASE2_ACTOR_INPUT_CAPTURE__ = [];
    window.__PROJECT_PRISM_ACTOR_INPUT_CAPTURE__ = (entry) => {
      window.__PROJECT_PRISM_PHASE2_ACTOR_INPUT_CAPTURE__.push(entry);
    };
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const rootSceneTab = page.locator(".workspace-root-dock-frame__tab", { hasText: "Scene" }).first();
  await rootSceneTab.waitFor({ state: "visible" });
  const rootSceneTabRect = await rootSceneTab.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  steps.push({
    name: "root scene tab visible",
    rect: rectSnapshot(rootSceneTabRect),
    topStack: await topStackAt(page, {
      x: rootSceneTabRect.x + Math.min(24, rootSceneTabRect.width / 2),
      y: rootSceneTabRect.y + rootSceneTabRect.height / 2,
    }),
  });

  await waitForNonZeroRect(page, ".scene-window__viewport canvas", "scene canvas");
  await waitForNonZeroRect(page, ".camera3-gizmo", "camera3 overlay");

  const beforeDebugRect = await readElementRect(page, ".floating-gizmo-window", 0);
  const titlebar = page.locator(".floating-gizmo-window__titlebar").first();
  const titlebarRect = await titlebar.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await page.mouse.move(titlebarRect.x + 80, titlebarRect.y + titlebarRect.height / 2);
  await page.mouse.down();
  await page.mouse.move(titlebarRect.x + 120, titlebarRect.y + titlebarRect.height / 2 + 25, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterDebugRect = await readElementRect(page, ".floating-gizmo-window", 0);
  steps.push({
    name: "floating frame drag",
    before: rectSnapshot(beforeDebugRect),
    after: rectSnapshot(afterDebugRect),
  });
  assert(
    Math.abs(afterDebugRect.x - beforeDebugRect.x) >= 10 || Math.abs(afterDebugRect.y - beforeDebugRect.y) >= 10,
    "floating frame titlebar drag should move the frame",
  );

  const hierarchyClose = page.locator('button[aria-label="Close Hierarchy"]').first();
  await hierarchyClose.click();
  await page.waitForTimeout(400);
  const hierarchyAfterClose = await page.locator('button[aria-label="Close Hierarchy"]').count();
  steps.push({ name: "close hierarchy tab", remainingCloseButtons: hierarchyAfterClose });
  assert(hierarchyAfterClose === 0, "Hierarchy tab close should remove the Hierarchy view");

  await clickWindowMenuItem(page, "Hierarchy Panel");
  const hierarchyAfterRestore = await page.locator('button[aria-label="Close Hierarchy"]').count();
  steps.push({ name: "menu restores hierarchy", closeButtons: hierarchyAfterRestore });
  assert(hierarchyAfterRestore > 0, "Window menu should restore/focus Hierarchy");

  const fullscreenButton = page.locator(".scene-window__mode-toggle-button").first();
  await fullscreenButton.click();
  await page.waitForTimeout(600);
  const floatingFrameVisibilityDuringFullscreen = await page.evaluate(() => {
    const visibleFrames = [...document.querySelectorAll(".floating-gizmo-window")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    return {
      visibleCount: visibleFrames.length,
      fullscreenCount: visibleFrames.filter((element) => element.classList.contains("floating-gizmo-window--fullscreen")).length,
      nonFullscreenCount: visibleFrames.filter((element) => !element.classList.contains("floating-gizmo-window--fullscreen")).length,
      visibleFrameTexts: visibleFrames.map((element) => element.textContent?.trim().slice(0, 80) ?? "")
    };
  });
  const fullscreenCanvasRect = await readElementRect(page, ".scene-window__viewport canvas");
  steps.push({
    name: "scene fullscreen",
    floatingFrameVisibilityDuringFullscreen,
    canvasRect: rectSnapshot(fullscreenCanvasRect),
  });
  assert(
    floatingFrameVisibilityDuringFullscreen.fullscreenCount === 1,
    "Scene fullscreen should show one runtime-only fullscreen floating frame",
  );
  assert(
    floatingFrameVisibilityDuringFullscreen.nonFullscreenCount === 0,
    "Scene fullscreen should suppress unrelated non-fullscreen floating frames",
  );
  assert(fullscreenCanvasRect.width > 1000 && fullscreenCanvasRect.height > 500, "Scene fullscreen canvas should be large");

  await page.locator(".scene-window__mode-toggle-button").first().click();
  await page.waitForTimeout(600);
  const floatingVisibleAfterRestore = await page.evaluate(() => {
    return [...document.querySelectorAll(".floating-gizmo-window")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    }).length;
  });
  steps.push({ name: "scene restore", floatingVisibleAfterRestore });
  assert(floatingVisibleAfterRestore > 0, "Scene restore should bring floating frames back");

  const cameraRect = await readElementRect(page, ".camera3-gizmo");
  const cameraPoint = {
    x: cameraRect.x + cameraRect.width * 0.55,
    y: cameraRect.y + cameraRect.height * 0.45,
  };
  await page.mouse.move(cameraPoint.x, cameraPoint.y);
  await page.mouse.down();
  await page.mouse.move(cameraPoint.x - 30, cameraPoint.y + 20, { steps: 5 });
  await page.mouse.up();
  await page.mouse.dblclick(cameraPoint.x, cameraPoint.y);
  await page.waitForTimeout(300);

  const actorInputCaptures = await page.evaluate(() => window.__PROJECT_PRISM_PHASE2_ACTOR_INPUT_CAPTURE__ ?? []);
  steps.push({
    name: "camera3 input capture",
    cameraRect: rectSnapshot(cameraRect),
    captureCount: actorInputCaptures.length,
    lastCaptures: actorInputCaptures.slice(-8),
  });
  assert(actorInputCaptures.length > 0, "Actor input smoke capture should receive pointer events");

  await page.screenshot({ path: outputPng, fullPage: true });

  const summary = {
    passed: validationErrors.length === 0 && errors.length === 0,
    url: baseUrl,
    viewport: { width: 1365, height: 768 },
    steps,
    actorInputCaptureCount: actorInputCaptures.length,
    validationErrors,
    errors,
    screenshot: outputPng,
  };
  await writeFile(outputJson, JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    console.error(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  await browser.close();
}

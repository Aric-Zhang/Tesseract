import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const [url, dataPath, screenshotPath] = process.argv.slice(2);
if (!url || !dataPath || !screenshotPath) {
  throw new Error("Usage: node temp/playwright-window-tab-close-persistence-smoke.mjs <url> <dataPath> <screenshotPath>");
}

const STORAGE_KEY = "wallpaper-tesseract.windowWorkspaceFrameLayout.v1";

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const steps = [];

page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text();
  if (/Failed to load resource: the server responded with a status of 404/.test(text)) return;
  errors.push(`console:${text}`);
});
page.on("pageerror", (error) => errors.push(`page:${error.message}`));

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.reload({ waitUntil: "networkidle" });
  await installHelpers(page);
  await page.waitForSelector(".floating-gizmo-window__tab");
  await page.waitForTimeout(300);
  steps.push({ name: "initial", state: await collectState(page) });

  await dragTabToTab(page, "Debug Log", "Scene");
  await page.waitForTimeout(350);
  await clickTabClose(page, "Debug Log");
  const debugClosedPersisted = await waitForPersisted(page, (persisted) => (
    persisted &&
    !viewKeys(persisted).includes("debug") &&
    viewKeys(persisted).includes("scene") &&
    viewKeys(persisted).includes("hierarchy") &&
    persisted.hiddenViewKeys.length === 0
  ), "debug tab removed from persisted layout");
  steps.push({ name: "close-debug-tab", state: await collectState(page), persisted: debugClosedPersisted });

  await page.reload({ waitUntil: "networkidle" });
  await installHelpers(page);
  await page.waitForSelector(".floating-gizmo-window__tab");
  await page.waitForTimeout(350);
  steps.push({ name: "reload-after-debug-close", state: await collectState(page) });

  await openWindowMenuItem(page, "Debug Log");
  await page.waitForTimeout(350);
  steps.push({ name: "restore-debug", state: await collectState(page) });

  await dragTabToTab(page, "Scene", "Debug Log");
  await page.waitForTimeout(350);
  await clickTabBody(page, "Scene");
  await clickSceneModeToggle(page);
  await page.waitForTimeout(550);
  const fullscreenPersisted = await waitForPersisted(page, (persisted) => (
    persisted &&
    !JSON.stringify(persisted).includes("floating-scene-view") &&
    viewKeys(persisted).includes("scene") &&
    viewKeys(persisted).includes("debug")
  ), "temporary fullscreen frame omitted from persisted layout");
  steps.push({ name: "scene-fullscreen-persisted", state: await collectState(page), persisted: fullscreenPersisted });

  await clickSceneModeToggle(page);
  await page.waitForTimeout(550);
  await clickTabClose(page, "Scene");
  const sceneClosedPersisted = await waitForPersisted(page, (persisted) => (
    persisted &&
    !viewKeys(persisted).includes("scene") &&
    viewKeys(persisted).includes("debug") &&
    viewKeys(persisted).includes("hierarchy") &&
    persisted.hiddenViewKeys.length === 0
  ), "scene tab removed from persisted layout");
  steps.push({ name: "close-scene-tab", state: await collectState(page), persisted: sceneClosedPersisted });

  await page.reload({ waitUntil: "networkidle" });
  await installHelpers(page);
  await page.waitForSelector(".floating-gizmo-window__tab");
  await page.waitForTimeout(350);
  steps.push({ name: "reload-after-scene-close", state: await collectState(page) });

  await openWindowMenuItem(page, "Scene");
  await page.waitForTimeout(850);
  steps.push({ name: "restore-scene", state: await collectState(page), persisted: await readPersisted(page) });

  const finalState = await collectState(page);
  const assertions = assertState(steps, finalState, errors);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await writeFile(dataPath, JSON.stringify({
    url,
    storageKey: STORAGE_KEY,
    passed: assertions.failures.length === 0,
    assertions,
    errors,
    steps,
    finalState
  }, null, 2));

  if (assertions.failures.length > 0) {
    throw new Error(assertions.failures.join("\n"));
  }
} finally {
  await browser.close();
}

async function installHelpers(page) {
  await page.evaluate(() => {
    window.__tabClosePersistenceToRect = (rect) => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    });
    window.__tabClosePersistenceFindTabByLabel = (label) => (
      Array.from(document.querySelectorAll(".floating-gizmo-window__tab"))
        .find((tab) => (tab.textContent ?? "").includes(label)) ?? null
    );
  });
}

async function dragTabToTab(page, sourceLabel, targetLabel) {
  const source = await getTabRect(page, sourceLabel);
  const target = await getTabRect(page, targetLabel, { excludeFrameClass: source.frameClassName });
  await page.mouse.move(source.left + 18, source.top + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.left + target.width / 2, target.top + target.height / 2, { steps: 14 });
  await page.mouse.up();
}

async function clickTabBody(page, label) {
  const rect = await getTabRect(page, label);
  await page.mouse.click(rect.left + Math.min(24, rect.width / 2), rect.top + rect.height / 2);
}

async function clickTabClose(page, label) {
  const rect = await page.evaluate((targetLabel) => {
    const tab = window.__tabClosePersistenceFindTabByLabel(targetLabel);
    const close = tab?.querySelector(".floating-gizmo-window__tab-close");
    return close ? window.__tabClosePersistenceToRect(close.getBoundingClientRect()) : null;
  }, label);
  if (!rect) throw new Error(`Tab close not found: ${label}`);
  await page.mouse.click(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

async function clickSceneModeToggle(page) {
  const rect = await page.evaluate(() => {
    const element = document.querySelector(".scene-window__mode-toggle-button");
    return element ? window.__tabClosePersistenceToRect(element.getBoundingClientRect()) : null;
  });
  if (!rect) throw new Error("Scene mode toggle not found");
  await page.mouse.move(rect.left + rect.width / 2, rect.top + rect.height / 2);
  await page.mouse.click(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

async function openWindowMenuItem(page, label) {
  const button = await page.evaluate(() => {
    const element = document.querySelector(".app-menu-bar__button");
    return element ? window.__tabClosePersistenceToRect(element.getBoundingClientRect()) : null;
  });
  if (!button) throw new Error("Window menu button not found");
  await page.mouse.click(button.left + button.width / 2, button.top + button.height / 2);
  await page.waitForTimeout(150);
  const item = await page.evaluate((targetLabel) => {
    const items = Array.from(document.querySelectorAll(".app-menu-bar__menu-item"));
    const element = items.find((candidate) => (candidate.textContent ?? "").includes(targetLabel));
    return element ? window.__tabClosePersistenceToRect(element.getBoundingClientRect()) : null;
  }, label);
  if (!item) throw new Error(`Window menu item not found: ${label}`);
  await page.mouse.click(item.left + item.width / 2, item.top + item.height / 2);
}

async function getTabRect(page, label, options = {}) {
  const rect = await page.evaluate(({ targetLabel, excludeFrameClass }) => {
    const tabs = Array.from(document.querySelectorAll(".floating-gizmo-window__tab"));
    for (const tab of tabs) {
      if (!(tab.textContent ?? "").includes(targetLabel)) continue;
      const frame = tab.closest(".floating-gizmo-window");
      const frameClassName = frame?.className ?? "";
      if (excludeFrameClass && frameClassName === excludeFrameClass) continue;
      return {
        ...window.__tabClosePersistenceToRect(tab.getBoundingClientRect()),
        frameClassName
      };
    }
    return null;
  }, { targetLabel: label, excludeFrameClass: options.excludeFrameClass ?? null });
  if (!rect) throw new Error(`Tab not found: ${label}`);
  return rect;
}

async function waitForPersisted(page, predicate, label) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const persisted = await readPersisted(page);
    if (predicate(persisted)) return persisted;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for persisted state: ${label}`);
}

async function readPersisted(page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);
}

async function collectState(page) {
  return page.evaluate((key) => {
    const frames = Array.from(document.querySelectorAll(".floating-gizmo-window")).map((frame) => ({
      className: frame.className,
      rect: window.__tabClosePersistenceToRect(frame.getBoundingClientRect()),
      tabs: Array.from(frame.querySelectorAll(".floating-gizmo-window__tab")).map((tab) => ({
        text: (tab.textContent ?? "").replace(/\s*x\s*$/, ""),
        active: tab.classList.contains("is-active"),
        rect: window.__tabClosePersistenceToRect(tab.getBoundingClientRect())
      })),
      fullscreen: frame.classList.contains("floating-gizmo-window--fullscreen"),
      closeCount: frame.querySelectorAll(".floating-gizmo-window__close").length
    }));
    const canvases = Array.from(document.querySelectorAll("canvas")).map((canvas) => (
      window.__tabClosePersistenceToRect(canvas.getBoundingClientRect())
    ));
    const raw = window.localStorage.getItem(key);
    const persisted = raw ? JSON.parse(raw) : null;
    return {
      frames,
      canvases,
      canvasCount: canvases.length,
      sceneTabCount: countTabs(frames, "Scene"),
      debugTabCount: countTabs(frames, "Debug Log"),
      hierarchyTabCount: countTabs(frames, "Hierarchy"),
      persisted
    };

    function countTabs(candidateFrames, label) {
      return candidateFrames
        .flatMap((frame) => frame.tabs)
        .filter((tab) => tab.text.includes(label))
        .length;
    }
  }, STORAGE_KEY);
}

function viewKeys(persisted) {
  return (persisted?.views ?? []).map((view) => view.viewKey);
}

function assertState(steps, finalState, errors) {
  const failures = [];
  const closeDebug = steps.find((step) => step.name === "close-debug-tab");
  const reloadDebug = steps.find((step) => step.name === "reload-after-debug-close");
  const restoreDebug = steps.find((step) => step.name === "restore-debug");
  const fullscreen = steps.find((step) => step.name === "scene-fullscreen-persisted");
  const closeScene = steps.find((step) => step.name === "close-scene-tab");
  const reloadScene = steps.find((step) => step.name === "reload-after-scene-close");

  if (errors.length > 0) failures.push(`console/page errors: ${errors.join("; ")}`);
  if (closeDebug?.state.debugTabCount !== 0) failures.push("Debug tab remained after close");
  if (viewKeys(closeDebug?.persisted).includes("debug")) failures.push("Closed Debug persisted as a live view");
  if ((closeDebug?.persisted?.hiddenViewKeys ?? []).length !== 0) failures.push("Closed Debug wrote hiddenViewKeys");
  if (reloadDebug?.state.debugTabCount !== 0) failures.push("Debug restored automatically after reload");
  if (restoreDebug?.state.debugTabCount !== 1) failures.push("Debug did not restore from Window menu");
  if (JSON.stringify(fullscreen?.persisted ?? {}).includes("floating-scene-view")) {
    failures.push("Temporary Scene fullscreen frame was persisted");
  }
  if (closeScene?.state.sceneTabCount !== 0) failures.push("Scene tab remained after close");
  if (viewKeys(closeScene?.persisted).includes("scene")) failures.push("Closed Scene persisted as a live view");
  if ((closeScene?.persisted?.hiddenViewKeys ?? []).length !== 0) failures.push("Closed Scene wrote hiddenViewKeys");
  if (reloadScene?.state.sceneTabCount !== 0) failures.push("Scene restored automatically after reload");
  if (finalState.sceneTabCount !== 1) failures.push("Scene did not restore from Window menu");
  if (finalState.canvasCount < 1) failures.push("Scene canvas was not recreated after menu restore");
  if (!finalState.canvases.some((rect) => rect.width > 0 && rect.height > 0)) {
    failures.push("Restored Scene canvas has no visible size");
  }
  return { failures };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (!String(error).includes("Executable doesn't exist")) throw error;
    return await chromium.launch({ channel: "msedge", headless: true });
  }
}

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const url = process.argv[2] ?? "http://127.0.0.1:5203/";
const dataPath = process.argv[3] ?? "temp/window-step8-6-playwright-pointer-smoke-data.json";
const screenshotPath = process.argv[4] ?? "temp/window-step8-6-playwright-pointer-smoke.png";

const errors = [];
const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  deviceScaleFactor: 1
});
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") {
    const text = message.text();
    if (/Failed to load resource: the server responded with a status of 404/.test(text)) {
      return;
    }
    errors.push(`console:${text}`);
  }
});
page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));

const steps = [];

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.__toRect = (rect) => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    });
  });
  await page.waitForSelector(".floating-gizmo-window__tab", { state: "visible", timeout: 15_000 });
  await page.waitForTimeout(800);
  steps.push({ name: "initial", state: await sampleState(page) });

  const debugTab = await tabCenter(page, "Debug Log");
  const sceneTab = await tabCenter(page, "Scene");
  const mergePreview = await dragAndSamplePreview(page, debugTab, sceneTab);
  await page.waitForTimeout(500);
  steps.push({
    name: "merge-debug-into-scene",
    preview: mergePreview,
    state: await sampleState(page)
  });

  const hierarchyTab = await tabCenter(page, "Hierarchy");
  const sceneContentLeft = await contentPoint(page, ".scene-window", "left");
  const splitPreview = await dragAndSamplePreview(page, hierarchyTab, sceneContentLeft);
  await page.waitForTimeout(500);
  steps.push({
    name: "split-hierarchy-into-scene-left",
    preview: splitPreview,
    state: await sampleState(page)
  });

  const debugTabAfterSplit = await tabCenter(page, "Debug Log");
  const sceneContentCenter = await contentPoint(page, ".scene-window", "center");
  const floatingPreview = await dragAndSamplePreview(page, debugTabAfterSplit, sceneContentCenter);
  await page.waitForTimeout(500);
  steps.push({
    name: "float-debug-from-content-center",
    preview: floatingPreview,
    state: await sampleState(page)
  });

  const beforeMove = await frameRectForTab(page, "Debug Log");
  const titlebarPoint = await titlebarEmptyPointForTab(page, "Debug Log");
  await page.mouse.move(titlebarPoint.x, titlebarPoint.y);
  await page.mouse.down();
  await page.mouse.move(titlebarPoint.x + 60, titlebarPoint.y + 35, { steps: 12 });
  const titlebarPreview = await samplePreview(page);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterMove = await frameRectForTab(page, "Debug Log");
  steps.push({
    name: "titlebar-empty-drag-moves-frame",
    previewDuringDrag: titlebarPreview,
    beforeMove,
    afterMove,
    movedBy: {
      dx: Math.round(afterMove.left - beforeMove.left),
      dy: Math.round(afterMove.top - beforeMove.top)
    },
    state: await sampleState(page)
  });

  const finalState = await sampleState(page);
  const assertions = assertSmoke({ steps, finalState, errors });
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await writeFile(dataPath, JSON.stringify({
    url,
    passed: assertions.passed,
    assertions,
    errors,
    steps,
    finalState
  }, null, 2));
  if (!assertions.passed) {
    throw new Error(`Pointer smoke failed: ${assertions.failures.join("; ")}`);
  }
} finally {
  await browser.close();
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    return await chromium.launch({ channel: "msedge", headless: true });
  }
}

async function dragAndSamplePreview(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await page.waitForTimeout(120);
  const preview = await samplePreview(page);
  await page.mouse.up();
  return preview;
}

async function tabCenter(page, label) {
  const rect = await page.evaluate((text) => {
    const tabs = [...document.querySelectorAll(".floating-gizmo-window__tab")];
    const tab = tabs.find((candidate) => candidate.textContent?.trim() === text);
    if (!tab) return null;
    const rect = tab.getBoundingClientRect();
    return window.__toRect(rect);
  }, label);
  if (!rect) throw new Error(`Tab not found: ${label}`);
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

async function contentPoint(page, frameSelector, placement) {
  const rect = await page.evaluate((selector) => {
    const frame = document.querySelector(selector);
    const content = frame?.querySelector(".floating-gizmo-window__content");
    return content ? window.__toRect(content.getBoundingClientRect()) : null;
  }, frameSelector);
  if (!rect) throw new Error(`Content not found: ${frameSelector}`);
  if (placement === "left") {
    return { x: rect.left + Math.max(8, rect.width * 0.04), y: rect.top + rect.height / 2 };
  }
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

async function titlebarEmptyPointForTab(page, label) {
  const point = await page.evaluate((text) => {
    const tabs = [...document.querySelectorAll(".floating-gizmo-window__tab")];
    const tab = tabs.find((candidate) => candidate.textContent?.trim() === text);
    const frame = tab?.closest(".floating-gizmo-window");
    const titlebar = frame?.querySelector(".floating-gizmo-window__titlebar");
    if (!frame || !titlebar) return null;
    const titleRect = titlebar.getBoundingClientRect();
    const closeRect = frame.querySelector(".floating-gizmo-window__close")?.getBoundingClientRect();
    const tabRects = [...titlebar.querySelectorAll(".floating-gizmo-window__tab")]
      .map((candidate) => candidate.getBoundingClientRect());
    const candidates = [
      { x: titleRect.left + titleRect.width * 0.62, y: titleRect.top + titleRect.height / 2 },
      { x: titleRect.left + titleRect.width * 0.48, y: titleRect.top + titleRect.height / 2 },
      { x: titleRect.left + titleRect.width * 0.78, y: titleRect.top + titleRect.height / 2 }
    ];
    const isInside = (point, rect) => (
      point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
    );
    return candidates.find((candidate) => (
      !tabRects.some((rect) => isInside(candidate, rect)) &&
      (!closeRect || !isInside(candidate, closeRect))
    )) ?? null;
  }, label);
  if (!point) throw new Error(`Could not find titlebar empty point for tab: ${label}`);
  return point;
}

async function frameRectForTab(page, label) {
  const rect = await page.evaluate((text) => {
    const tabs = [...document.querySelectorAll(".floating-gizmo-window__tab")];
    const tab = tabs.find((candidate) => candidate.textContent?.trim() === text);
    const frame = tab?.closest(".floating-gizmo-window");
    return frame ? window.__toRect(frame.getBoundingClientRect()) : null;
  }, label);
  if (!rect) throw new Error(`Frame not found for tab: ${label}`);
  return rect;
}

async function samplePreview(page) {
  return page.evaluate(() => {
    const preview = document.querySelector(".window-dock-preview");
    if (!preview) return null;
    return {
      hidden: preview.hidden,
      className: preview.className,
      dataset: { ...preview.dataset },
      rect: window.__toRect(preview.getBoundingClientRect())
    };
  });
}

async function sampleState(page) {
  return page.evaluate(() => ({
    frames: [...document.querySelectorAll(".floating-gizmo-window")].map((frame) => ({
      className: frame.className,
      rect: window.__toRect(frame.getBoundingClientRect()),
      tabs: [...frame.querySelectorAll(".floating-gizmo-window__tab")].map((tab) => ({
        text: tab.textContent?.trim() ?? "",
        active: tab.classList.contains("is-active"),
        rect: window.__toRect(tab.getBoundingClientRect())
      })),
      splitCount: frame.querySelectorAll(".floating-gizmo-window__split").length,
      paneCount: frame.querySelectorAll(".floating-gizmo-window__pane").length
    })),
    preview: (() => {
      const preview = document.querySelector(".window-dock-preview");
      return preview ? {
        hidden: preview.hidden,
        className: preview.className,
        dataset: { ...preview.dataset },
        rect: window.__toRect(preview.getBoundingClientRect())
      } : null;
    })(),
    canvasRect: (() => {
      const canvas = document.querySelector("canvas");
      return canvas ? window.__toRect(canvas.getBoundingClientRect()) : null;
    })()
  }));
}

function assertSmoke({ steps, finalState, errors }) {
  const failures = [];
  const merge = steps.find((step) => step.name === "merge-debug-into-scene");
  const split = steps.find((step) => step.name === "split-hierarchy-into-scene-left");
  const floating = steps.find((step) => step.name === "float-debug-from-content-center");
  const titlebar = steps.find((step) => step.name === "titlebar-empty-drag-moves-frame");
  if (errors.length > 0) failures.push(`console/page errors: ${errors.join(" | ")}`);
  if (merge?.preview?.dataset?.dockKind !== "merge-tabs") {
    failures.push("merge drag did not expose merge-tabs preview");
  }
  if (!merge?.state?.frames?.some((frame) => hasTabs(frame, ["Scene", "Debug Log"]))) {
    failures.push("Debug tab did not merge into Scene frame");
  }
  if (split?.preview?.dataset?.dockKind !== "split" || split?.preview?.dataset?.dockPlacement !== "left") {
    failures.push("split drag did not expose left split preview");
  }
  if (!split?.state?.frames?.some((frame) => frame.splitCount > 0 && hasTabs(frame, ["Scene", "Debug Log", "Hierarchy"]))) {
    failures.push("Hierarchy tab did not split into Scene frame");
  }
  if (floating?.preview?.dataset?.dockKind !== "floating") {
    failures.push("content center drag did not expose floating preview");
  }
  if (!floating?.state?.frames?.some((frame) => hasTabs(frame, ["Debug Log"]))) {
    failures.push("Debug tab did not float out after content-center drop");
  }
  if (titlebar?.previewDuringDrag && !titlebar.previewDuringDrag.hidden) {
    failures.push("titlebar empty drag displayed dock preview");
  }
  if (!titlebar?.movedBy || Math.abs(titlebar.movedBy.dx) < 20 || Math.abs(titlebar.movedBy.dy) < 15) {
    failures.push("titlebar empty drag did not move frame enough");
  }
  if (!finalState.canvasRect || finalState.canvasRect.width <= 0 || finalState.canvasRect.height <= 0) {
    failures.push("Scene canvas is missing or blank-sized");
  }
  return { passed: failures.length === 0, failures };
}

function hasTabs(frame, labels) {
  const tabTexts = frame.tabs.map((tab) => tab.text);
  return labels.every((label) => tabTexts.includes(label));
}


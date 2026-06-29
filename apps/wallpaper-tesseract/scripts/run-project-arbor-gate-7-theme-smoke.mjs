import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const url = "http://127.0.0.1:5173/?resetWorkspaceLayout=1";
const dataPath = resolve(workspaceRoot, "temp/project-arbor-gate-7-theme-smoke-data.json");
const reportPath = resolve(workspaceRoot, "temp/project-arbor-gate-7-theme-smoke-report.md");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".app-shell");
await ensureInspectorOpen();
const before = await sampleThemeStyles("before");
const themeMenu = await switchThemeThroughMenu("graphite-blue");
const after = await sampleThemeStyles("after");
const interactions = await exerciseInteractionSanity();
const mobile = await exerciseMobileViewport();

const evidence = {
  kind: "project-arbor-gate-7-theme-smoke",
  generatedAt: new Date().toISOString(),
  url,
  passed: true,
  validationErrors: [],
  consoleErrors,
  before,
  after,
  themeMenu,
  interactions,
  mobile
};

validateEvidence(evidence);

await writeFile(dataPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(reportPath, [
  "# Project Arbor Gate 7 Theme Smoke Report",
  "",
  `Evidence file: ${dataPath}`,
  `Generated: ${evidence.generatedAt}`,
  `Passed: ${evidence.passed ? "yes" : "no"}`,
  "",
  "## Coverage",
  "",
  `- Console errors: ${consoleErrors.length}`,
  `- Theme before -> after: ${before.themeId} -> ${after.themeId}`,
  `- Theme menu leaf topmost: ${themeMenu.leafTopmost}`,
  `- Theme change count: ${themeMenu.themeChangeCount}`,
  `- Window menu still opens: ${interactions.windowMenuOpened}`,
  `- Scene fullscreen toggles: ${interactions.sceneFullscreenToggled}`,
  `- Debug row sampled: ${Boolean(after.styles.debugRow)}`,
  `- Mobile menu reachable: ${mobile.menuReachable}`,
  `- Mobile theme submenu reachable: ${mobile.themeSubmenuReachable}`,
  "",
  "## Changed Styles",
  "",
  ...Object.entries(compareStyles(before.styles, after.styles)).map(([key, changed]) => (
    `- ${key}: ${changed ? "changed" : "unchanged"}`
  )),
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

async function ensureInspectorOpen() {
  await openMenuBarItem("Window");
  const newInspector = page.locator('.ui-menu-item[data-ui-menu-item-id="new:inspector"]').first();
  if (await newInspector.count()) {
    await newInspector.click();
    await page.waitForTimeout(200);
  } else {
    await page.keyboard.press("Escape");
  }
}

async function switchThemeThroughMenu(themeId) {
  await openMenuBarItem("Edit");
  const themeItem = page.locator('.ui-menu-item[data-ui-menu-item-id="theme"]').first();
  await themeItem.hover();
  await page.waitForTimeout(150);
  const leaf = page.locator(`.ui-menu-item[data-ui-menu-item-id="theme:${themeId}"]`).first();
  const leafRect = await rectOf(leaf);
  const topmost = await isTopmostAtCenter(leaf);
  await leaf.click();
  await page.waitForTimeout(200);
  const afterTheme = await page.locator(".app-shell").evaluate((element) => element.getAttribute("data-ui-theme"));
  return {
    selectedThemeId: afterTheme,
    leafRect,
    leafTopmost: topmost,
    themeChangeCount: afterTheme === themeId ? 1 : 0
  };
}

async function exerciseInteractionSanity() {
  await openMenuBarItem("Window");
  const windowPopup = await page.locator(".ui-popup-menu").filter({ has: page.locator('.ui-menu-item[data-ui-menu-item-id^="type:"]') }).count();
  await page.keyboard.press("Escape");
  const fullscreenButton = page.locator(".ui-fullscreenable-view__control").first();
  await fullscreenButton.click();
  await page.waitForTimeout(200);
  const fullscreenState = await fullscreenButton.evaluate((element) => element.getAttribute("data-ui-fullscreen-state"));
  await fullscreenButton.click();
  await page.waitForTimeout(200);
  const restoredState = await fullscreenButton.evaluate((element) => element.getAttribute("data-ui-fullscreen-state"));
  return {
    windowMenuOpened: windowPopup > 0,
    sceneFullscreenToggled: fullscreenState === "fullscreen" && restoredState === "windowed"
  };
}

async function exerciseMobileViewport() {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await openMenuBarItem("Edit");
  const themeItem = page.locator('.ui-menu-item[data-ui-menu-item-id="theme"]').first();
  const themeRect = await rectOf(themeItem);
  await themeItem.hover();
  await page.waitForTimeout(150);
  const leaf = page.locator('.ui-menu-item[data-ui-menu-item-id="theme:default-dark"]').first();
  const leafRect = await rectOf(leaf);
  const themeSubmenuReachable = await isTopmostAtCenter(leaf);
  await page.keyboard.press("Escape");
  const sceneRect = await rectOf(page.locator(".scene-view").first());
  const debugRect = await rectOf(page.locator(".ui-virtual-list-view").first());
  const hierarchyRect = await rectOf(page.locator(".ui-tree-view").first());
  await page.setViewportSize({ width: 1280, height: 720 });
  return {
    viewport: { width: 390, height: 844 },
    menuReachable: intersectsViewport(themeRect, 390, 844),
    themeSubmenuReachable,
    themeRect,
    leafRect,
    sceneVisible: intersectsViewport(sceneRect, 390, 844),
    debugVisible: intersectsViewport(debugRect, 390, 844),
    hierarchyVisible: intersectsViewport(hierarchyRect, 390, 844),
    horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  };
}

async function openMenuBarItem(label) {
  const item = page.locator(".ui-menu-bar-item").filter({ hasText: label }).first();
  await item.click();
  await page.waitForTimeout(150);
}

async function sampleThemeStyles(label) {
  return await page.evaluate((sampleLabel) => {
    function styleOf(selector, properties) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
    }
    function count(selector) {
      return document.querySelectorAll(selector).length;
    }
    return {
      label: sampleLabel,
      themeId: document.querySelector(".app-shell")?.getAttribute("data-ui-theme") ?? "",
      styles: {
        appShell: styleOf(".app-shell", ["background-color", "color"]),
        menuBarItem: styleOf(".ui-menu-bar-item", ["background-color", "border-color", "color"]),
        popup: styleOf(".ui-popup-menu", ["background-color", "border-color", "box-shadow"]),
        activeTab: styleOf(".window-frame-tab.is-active, .workspace-root-dock-frame__tab.is-active, .floating-gizmo-window__tab.is-active", ["background-color", "border-color", "color"]),
        hierarchyRow: styleOf(".ui-tree-view__row", ["background-color", "color"]),
        debugRow: styleOf(".ui-virtual-list-view__row", ["background-color", "color", "font-family"]),
        inspector: styleOf(".inspector-window__content", ["background-color", "color", "font-family"]),
        scrollbarHost: styleOf(".ui-scroll-view", ["scrollbar-color"])
      },
      counts: {
        menuBarItems: count(".ui-menu-bar-item"),
        themeItems: count('.ui-menu-item[data-ui-menu-item-id^="theme:"]'),
        hierarchyRows: count(".ui-tree-view__row"),
        debugRows: count(".ui-virtual-list-view__row"),
        inspectorPanels: count(".inspector-window__content")
      }
    };
  }, label);
}

async function rectOf(locator) {
  const box = await locator.boundingBox();
  if (!box) return null;
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    right: box.x + box.width,
    bottom: box.y + box.height
  };
}

async function isTopmostAtCenter(locator) {
  const box = await locator.boundingBox();
  if (!box) return false;
  return await locator.evaluate((element, point) => {
    const top = document.elementsFromPoint(point.x, point.y)[0];
    return top === element || element.contains(top);
  }, {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  });
}

function intersectsViewport(rect, width, height) {
  if (!rect) return false;
  return rect.x < width &&
    rect.right > 0 &&
    rect.y < height &&
    rect.bottom > 0 &&
    rect.width > 0 &&
    rect.height > 0;
}

function compareStyles(before, after) {
  const result = {};
  for (const key of Object.keys(before)) {
    result[key] = JSON.stringify(before[key]) !== JSON.stringify(after[key]);
  }
  return result;
}

function validateEvidence(evidence) {
  const errors = [];
  if (consoleErrors.length > 0) errors.push("console errors must be empty.");
  if (evidence.before.themeId !== "default-dark") errors.push("initial theme must be default-dark.");
  if (evidence.after.themeId !== "graphite-blue") errors.push("theme switch must select graphite-blue.");
  if (evidence.themeMenu.leafTopmost !== true) errors.push("theme submenu leaf must be topmost/clickable.");
  if (evidence.themeMenu.themeChangeCount !== 1) errors.push("theme leaf must produce one theme change.");
  const styleChanges = compareStyles(evidence.before.styles, evidence.after.styles);
  for (const key of ["appShell", "menuBarItem", "activeTab", "hierarchyRow", "debugRow", "inspector"]) {
    if (!styleChanges[key]) errors.push(`${key} sampled style must change after theme switch.`);
  }
  if (evidence.interactions.windowMenuOpened !== true) errors.push("Window menu must still open.");
  if (evidence.interactions.sceneFullscreenToggled !== true) errors.push("Scene fullscreen must still toggle.");
  if (evidence.mobile.menuReachable !== true) errors.push("mobile Edit menu must be reachable.");
  if (evidence.mobile.themeSubmenuReachable !== true) errors.push("mobile Theme submenu must be reachable.");
  if (evidence.mobile.horizontalOverflow !== false) errors.push("mobile theme chrome must not introduce horizontal overflow.");
  evidence.validationErrors = errors;
  evidence.passed = errors.length === 0;
}

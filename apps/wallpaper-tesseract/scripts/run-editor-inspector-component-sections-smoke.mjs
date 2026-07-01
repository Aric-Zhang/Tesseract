import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const url = process.env.EDITOR_INSPECTOR_COMPONENT_SECTIONS_SMOKE_URL ??
  "http://127.0.0.1:5173/?resetWorkspaceLayout=1";
const dataPath = resolve(workspaceRoot, "temp/editor-inspector-component-sections-smoke-data.json");
const reportPath = resolve(workspaceRoot, "temp/editor-inspector-component-sections-smoke-report.md");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

const evidence = {
  kind: "editor-inspector-component-sections-smoke",
  generatedAt: new Date().toISOString(),
  url,
  passed: false,
  validationErrors: [],
  consoleErrors,
  initial: null,
  sceneSelection: null,
  lockState: null,
  cameraSelection: null,
  debug: null
};

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(".app-shell");
  await ensureInspectorCount(2);
  evidence.initial = await sampleInspector(0);

  await selectHierarchyRow("Scene View");
  evidence.sceneSelection = await sampleInspector(0);

  await lockFirstInspector();
  evidence.lockState = await sampleInspector(0);

  await selectHierarchyRow("Camera3");
  evidence.cameraSelection = {
    first: await sampleInspector(0),
    second: await sampleInspector(1)
  };
  evidence.debug = {
    rowCount: await page.locator(".ui-virtual-list-view__row").count()
  };

  evidence.validationErrors = validateEvidence(evidence);
  evidence.passed = evidence.validationErrors.length === 0;
} catch (error) {
  evidence.validationErrors.push(error instanceof Error ? error.message : String(error));
} finally {
  await writeOutputs(evidence);
  await browser.close();
}

if (!evidence.passed) {
  console.error(JSON.stringify(evidence.validationErrors, null, 2));
  process.exit(1);
}

console.log(`Wrote ${dataPath}`);
console.log(`Wrote ${reportPath}`);

async function ensureInspectorCount(targetCount) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const count = await page.locator(".inspector-window__content").count();
    if (count >= targetCount) return;
    await openMenuBarItem("Window");
    const newInspector = page.locator('.ui-menu-item[data-ui-menu-item-id="new:inspector"]').first();
    if (await newInspector.count()) {
      await newInspector.click();
      await page.waitForTimeout(200);
    } else {
      await page.keyboard.press("Escape");
      break;
    }
  }
  const finalCount = await page.locator(".inspector-window__content").count();
  if (finalCount < targetCount) {
    throw new Error(`Expected at least ${targetCount} Inspector windows, found ${finalCount}.`);
  }
}

async function openMenuBarItem(label) {
  const item = page.locator(".ui-menu-bar-item").filter({ hasText: label }).first();
  await item.click();
  await page.waitForTimeout(150);
}

async function selectHierarchyRow(label) {
  const row = page.locator(".ui-tree-view__row").filter({ hasText: label }).first();
  await row.click();
  await page.waitForTimeout(200);
}

async function lockFirstInspector() {
  const firstInspector = page.locator(".inspector-window__content").first();
  const lockButton = firstInspector.locator('[data-ui-button="true"][aria-label="Lock Inspector"]').first();
  await lockButton.click();
  await page.waitForTimeout(150);
}

async function sampleInspector(index) {
  return await page.locator(".inspector-window__body").nth(index).evaluate((element) => {
    const sections = [...element.querySelectorAll("[data-inspector-component-id]")].map((section) => ({
      id: section.getAttribute("data-inspector-component-id"),
      type: section.getAttribute("data-inspector-component-type"),
      enabled: section.getAttribute("data-inspector-component-enabled"),
      text: section.textContent?.trim() ?? ""
    }));
    return {
      state: element.getAttribute("data-inspector-state"),
      actorId: element.getAttribute("data-inspector-actor-id"),
      locked: element.getAttribute("data-inspector-locked"),
      componentCount: Number(element.getAttribute("data-inspector-component-count") ?? "0"),
      title: element.querySelector(".inspector-window__actor-title")?.textContent?.trim() ?? "",
      text: element.textContent?.trim() ?? "",
      sections
    };
  });
}

function validateEvidence(evidence) {
  const errors = [];
  if (evidence.consoleErrors.length > 0) errors.push("console errors must be empty.");
  if (evidence.kind !== "editor-inspector-component-sections-smoke") errors.push("kind mismatch.");
  if (!evidence.generatedAt) errors.push("generatedAt is required.");
  if (!evidence.sceneSelection) errors.push("scene selection sample is required.");
  if (!evidence.cameraSelection) errors.push("camera selection sample is required.");
  if (evidence.sceneSelection?.state !== "inspecting") errors.push("Scene selection must inspect an actor.");
  if (!evidence.sceneSelection?.title.includes("Scene View")) errors.push("Scene selection must show Scene View title.");
  if ((evidence.sceneSelection?.componentCount ?? 0) <= 0) errors.push("Scene selection must show at least one Component.");
  if ((evidence.sceneSelection?.sections ?? []).some((section) => !section.id || !section.type || !section.enabled)) {
    errors.push("Every Scene component section must include id/type/enabled diagnostics.");
  }
  if (evidence.lockState?.locked !== "true") errors.push("First Inspector must be locked after lock button click.");
  if (!evidence.cameraSelection?.first?.title.includes("Scene View")) {
    errors.push("Locked Inspector must keep Scene View after selecting Camera3.");
  }
  if (!evidence.cameraSelection?.second?.title.includes("Camera3")) {
    errors.push("Unlocked Inspector must follow Camera3 selection.");
  }
  if ((evidence.cameraSelection?.second?.componentCount ?? 0) <= 0) errors.push("Camera3 selection must show Components.");
  if ((evidence.debug?.rowCount ?? 0) <= 0) errors.push("Debug diagnostics rows must remain visible.");
  return errors;
}

async function writeOutputs(evidence) {
  await writeFile(dataPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(reportPath, [
    "# Editor Inspector Component Sections Smoke Report",
    "",
    `Evidence file: ${dataPath}`,
    `Generated: ${evidence.generatedAt}`,
    `Passed: ${evidence.passed ? "yes" : "no"}`,
    "",
    "## Coverage",
    "",
    `- Console errors: ${evidence.consoleErrors.length}`,
    `- Initial Inspector state: ${evidence.initial?.state ?? "missing"}`,
    `- Scene title: ${evidence.sceneSelection?.title ?? "missing"}`,
    `- Scene component count: ${evidence.sceneSelection?.componentCount ?? 0}`,
    `- First Inspector locked: ${evidence.lockState?.locked ?? "missing"}`,
    `- Locked Inspector after Camera3 selection: ${evidence.cameraSelection?.first?.title ?? "missing"}`,
    `- Following Inspector after Camera3 selection: ${evidence.cameraSelection?.second?.title ?? "missing"}`,
    `- Camera3 component count: ${evidence.cameraSelection?.second?.componentCount ?? 0}`,
    `- Debug row count: ${evidence.debug?.rowCount ?? 0}`,
    "",
    "## Validation Errors",
    "",
    evidence.validationErrors.length === 0
      ? "- none"
      : evidence.validationErrors.map((error) => `- ${error}`).join("\n")
  ].join("\n"), "utf8");
}

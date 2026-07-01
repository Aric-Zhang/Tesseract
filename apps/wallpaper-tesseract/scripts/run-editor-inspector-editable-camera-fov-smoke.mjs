import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const url = process.env.EDITOR_INSPECTOR_EDITABLE_CAMERA_FOV_SMOKE_URL ??
  "http://127.0.0.1:5173/?resetWorkspaceLayout=1";
const dataPath = resolve(workspaceRoot, "temp/editor-inspector-editable-camera-fov-smoke-data.json");
const reportPath = resolve(workspaceRoot, "temp/editor-inspector-editable-camera-fov-smoke-report.md");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
await page.addInitScript(() => {
  window.__EDITOR_INSPECTOR_FOV_SMOKE_HITS__ = [];
  window.__PROJECT_PRISM_ACTOR_INPUT_CAPTURE__ = (entry) => {
    window.__EDITOR_INSPECTOR_FOV_SMOKE_HITS__.push({
      actorId: entry.actorId,
      bindingId: entry.bindingId,
      partId: entry.partId,
      targetComponentId: entry.targetComponentId,
      point: entry.point
    });
  };
});

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

const evidence = {
  kind: "editor-inspector-editable-camera-fov-smoke",
  generatedAt: new Date().toISOString(),
  url,
  passed: false,
  validationErrors: [],
  consoleErrors,
  before: null,
  focusClick: null,
  validEdit: null,
  invalidEdit: null,
  debug: null
};

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(".app-shell");
  await ensureInspectorCount(2);
  await selectHierarchyRow("Scene View");

  evidence.before = await sampleInspectors();
  const editInspectorIndex = await findClickableFovInspectorIndex();
  const followInspectorIndex = editInspectorIndex === 0 ? 1 : 0;
  evidence.editInspectorIndex = editInspectorIndex;
  evidence.followInspectorIndex = followInspectorIndex;
  const firstFrameRectBefore = await inspectorFrameRect(editInspectorIndex);
  const firstFovInput = fovInput(editInspectorIndex);
  await firstFovInput.click();
  await page.waitForTimeout(150);
  evidence.focusClick = {
    beforeFrameRect: firstFrameRectBefore,
    afterFrameRect: await inspectorFrameRect(editInspectorIndex),
    activeElement: await page.evaluate(() => document.activeElement?.tagName ?? ""),
    hits: await page.evaluate(() => window.__EDITOR_INSPECTOR_FOV_SMOKE_HITS__ ?? [])
  };

  await firstFovInput.fill("72");
  await firstFovInput.press("Enter");
  await waitForFovValue(followInspectorIndex, "72");
  evidence.validEdit = await sampleInspectors();

  await fovInput(editInspectorIndex).fill("999");
  await fovInput(editInspectorIndex).press("Enter");
  await page.waitForTimeout(300);
  evidence.invalidEdit = await sampleInspectors();
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

function fovInput(inspectorIndex) {
  return page.locator(".inspector-window__body").nth(inspectorIndex)
    .locator('[data-inspector-component-type="camera3-motion-component"]')
    .locator('[data-inspector-property-id="fov"] input[type="number"]')
    .first();
}

async function findClickableFovInspectorIndex() {
  const count = await page.locator(".inspector-window__body").count();
  for (let index = 0; index < count; index += 1) {
    const input = fovInput(index);
    if (await input.count() === 0) continue;
    try {
      await input.click({ trial: true, timeout: 1000 });
      return index;
    } catch {
      // Keep looking for the topmost, pointer-reachable Inspector.
    }
  }
  throw new Error("No pointer-reachable Camera3 FOV NumberField was found.");
}

async function waitForFovValue(inspectorIndex, value) {
  await page.waitForFunction(({ index, expected }) => {
    const body = document.querySelectorAll(".inspector-window__body")[index];
    const input = body?.querySelector(
      '[data-inspector-component-type="camera3-motion-component"] [data-inspector-property-id="fov"] input[type="number"]'
    );
    return input instanceof HTMLInputElement && Number(input.value) === Number(expected);
  }, { index: inspectorIndex, expected: value }, { timeout: 3000 });
}

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
  await page.waitForTimeout(250);
}

async function inspectorFrameRect(index) {
  return await page.locator(".inspector-window").nth(index).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  });
}

async function sampleInspectors() {
  const count = await page.locator(".inspector-window__body").count();
  const inspectors = [];
  for (let index = 0; index < Math.min(2, count); index += 1) {
    inspectors.push(await sampleInspector(index));
  }
  return inspectors;
}

async function sampleInspector(index) {
  return await page.locator(".inspector-window__body").nth(index).evaluate((element) => {
    const fovRow = element.querySelector(
      '[data-inspector-component-type="camera3-motion-component"] [data-inspector-property-id="fov"]'
    );
    const fovInput = fovRow?.querySelector("input");
    const cameraSection = element.querySelector('[data-inspector-component-type="camera3-motion-component"]');
    return {
      state: element.getAttribute("data-inspector-state"),
      actorId: element.getAttribute("data-inspector-actor-id"),
      title: element.querySelector(".inspector-window__actor-title")?.textContent?.trim() ?? "",
      componentCount: Number(element.getAttribute("data-inspector-component-count") ?? "0"),
      hasCameraSection: Boolean(cameraSection),
      fovText: fovRow?.textContent?.trim() ?? "",
      fovInputValue: fovInput instanceof HTMLInputElement ? fovInput.value : null,
      fovInvalid: fovRow?.querySelector("[data-ui-number-field-invalid]")?.getAttribute("data-ui-number-field-invalid") ?? null
    };
  });
}

function validateEvidence(evidence) {
  const errors = [];
  const before = evidence.before ?? [];
  const valid = evidence.validEdit ?? [];
  const invalid = evidence.invalidEdit ?? [];
  const followIndex = evidence.followInspectorIndex ?? 1;

  if (evidence.consoleErrors.length > 0) errors.push("console errors must be empty.");
  if (evidence.kind !== "editor-inspector-editable-camera-fov-smoke") errors.push("kind mismatch.");
  if (!evidence.generatedAt) errors.push("generatedAt is required.");
  if (before.length < 2) errors.push("Two Inspector bodies must be available.");
  if (!before.every((inspector) => inspector.title.includes("Scene View") && inspector.hasCameraSection)) {
    errors.push("Both Inspectors must show Scene View with Camera3 Motion before editing.");
  }
  if (!valid.every((inspector) => Number(inspector.fovInputValue) === 72)) {
    errors.push("Both Inspectors must converge to FOV 72 after a valid edit.");
  }
  if (Number(invalid[followIndex]?.fovInputValue) !== 72) {
    errors.push("Following Inspector must stay at committed FOV after invalid edit.");
  }
  if (!hasNumberFieldHit(evidence.focusClick?.hits ?? [])) {
    errors.push("Clicking the FOV NumberField must route through the NumberField actor-input hit.");
  }
  if (!sameRect(evidence.focusClick?.beforeFrameRect, evidence.focusClick?.afterFrameRect)) {
    errors.push("Clicking the FOV NumberField must not move or dock the Inspector window.");
  }
  if ((evidence.debug?.rowCount ?? 0) <= 0) errors.push("Debug diagnostics rows must remain visible.");
  return errors;
}

function sameRect(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.x - b.x) <= 1 &&
    Math.abs(a.y - b.y) <= 1 &&
    Math.abs(a.width - b.width) <= 1 &&
    Math.abs(a.height - b.height) <= 1;
}

function hasNumberFieldHit(hits) {
  return hits.some((hit) =>
    hit?.partId === "number-field" &&
    hit?.targetComponentId === "inspector-property-number-field"
  );
}

async function writeOutputs(evidence) {
  await writeFile(dataPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(reportPath, [
    "# Editor Inspector Editable Camera FOV Smoke Report",
    "",
    `Evidence file: ${dataPath}`,
    `Generated: ${evidence.generatedAt}`,
    `Passed: ${evidence.passed ? "yes" : "no"}`,
    "",
    "## Coverage",
    "",
    `- Console errors: ${evidence.consoleErrors.length}`,
    `- Initial inspector count: ${evidence.before?.length ?? 0}`,
    `- Initial FOV values: ${(evidence.before ?? []).map((item) => item.fovInputValue).join(", ")}`,
    `- Valid edit FOV values: ${(evidence.validEdit ?? []).map((item) => item.fovInputValue).join(", ")}`,
    `- Invalid edit FOV values: ${(evidence.invalidEdit ?? []).map((item) => item.fovInputValue).join(", ")}`,
    `- Focus active element: ${evidence.focusClick?.activeElement ?? "missing"}`,
    `- Debug row count: ${evidence.debug?.rowCount ?? 0}`,
    "",
    "## Validation Errors",
    "",
    evidence.validationErrors.length === 0
      ? "- none"
      : evidence.validationErrors.map((error) => `- ${error}`).join("\n")
  ].join("\n"), "utf8");
}

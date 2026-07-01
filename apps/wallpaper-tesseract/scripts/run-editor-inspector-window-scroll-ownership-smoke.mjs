import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const url = process.env.EDITOR_INSPECTOR_WINDOW_SCROLL_SMOKE_URL ??
  "http://127.0.0.1:5173/?resetWorkspaceLayout=1";
const dataPath = resolve(workspaceRoot, "temp/editor-inspector-window-scroll-ownership-smoke-data.json");
const reportPath = resolve(workspaceRoot, "temp/editor-inspector-window-scroll-ownership-smoke-report.md");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
await page.addInitScript(() => {
  window.__EDITOR_INSPECTOR_SCROLL_SMOKE_HITS__ = [];
  window.__EDITOR_INSPECTOR_SCROLL_READ_VIEWPORT__ = (viewport, contentElement) => {
    const rect = viewport.getBoundingClientRect();
    const style = getComputedStyle(viewport);
    return {
      found: true,
      contentClassName: contentElement.className,
      viewportClassName: viewport.className,
      viewportDataset: {
        scrollViewport: viewport.dataset.uiWindowContentScrollViewport ?? null,
        contentId: viewport.dataset.uiWindowContentId ?? null
      },
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      scrollTop: Math.round(viewport.scrollTop),
      scrollHeight: Math.round(viewport.scrollHeight),
      clientHeight: Math.round(viewport.clientHeight),
      scrollWidth: Math.round(viewport.scrollWidth),
      clientWidth: Math.round(viewport.clientWidth),
      offsetWidth: Math.round(viewport.offsetWidth),
      offsetHeight: Math.round(viewport.offsetHeight),
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollbarColor: style.scrollbarColor,
      hasVerticalOverflow: viewport.scrollHeight > viewport.clientHeight + 1,
      hasHorizontalOverflow: viewport.scrollWidth > viewport.clientWidth + 1,
      nativeVerticalGutter: Math.max(0, viewport.offsetWidth - viewport.clientWidth)
    };
  };
  window.__PROJECT_PRISM_ACTOR_INPUT_CAPTURE__ = (entry) => {
    window.__EDITOR_INSPECTOR_SCROLL_SMOKE_HITS__.push({
      actorId: entry.actorId,
      partId: entry.partId,
      targetComponentId: entry.targetComponentId,
      region: entry.region,
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
  kind: "editor-inspector-window-scroll-ownership-smoke",
  generatedAt: new Date().toISOString(),
  url,
  passed: false,
  validationErrors: [],
  consoleErrors,
  inspector: null,
  hierarchy: null,
  scene: null,
  debug: null,
  hits: []
};

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(".app-shell");
  await ensureInspectorCount(1);
  await selectHierarchyRow("Scene View");
  await page.waitForTimeout(250);

  evidence.inspector = await sampleScrollableViewport(".inspector-window__body");
  await wheelViewport(".inspector-window__body", 360);
  evidence.inspector.afterWheel = await sampleScrollableViewport(".inspector-window__body");
  evidence.inspector.drag = await dragViewportScrollbar(".inspector-window__body");
  evidence.inspector.bottomRightScrollbarPoint = await sampleViewportScrollbarPoint(".inspector-window__body", 0.92);
  evidence.inspector.sideResize = await dragFloatingResize(".inspector-window__body", "right");
  evidence.inspector.cornerResize = await dragFloatingResize(".inspector-window__body", "bottom-right");

  evidence.hierarchy = await sampleScrollableViewport(".hierarchy-panel");
  await wheelViewport(".hierarchy-panel", 240);
  evidence.hierarchy.afterWheel = await sampleScrollableViewport(".hierarchy-panel");

  evidence.scene = await sampleViewport(".scene-view");
  evidence.debug = await sampleDebug();
  evidence.hits = await page.evaluate(() => window.__EDITOR_INSPECTOR_SCROLL_SMOKE_HITS__ ?? []);
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

async function selectHierarchyRow(label) {
  const row = page.locator(".ui-tree-view__row").filter({ hasText: label }).first();
  await row.scrollIntoViewIfNeeded();
  await row.click();
}

async function ensureInspectorCount(targetCount) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const count = await page.locator(".inspector-window__content").count();
    if (count >= targetCount) return;
    await openMenuBarItem("Window");
    const newInspector = page.locator('.ui-menu-item[data-ui-menu-item-id="new:inspector"]').first();
    if (await newInspector.count()) {
      await newInspector.click();
      await page.waitForTimeout(250);
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

async function sampleScrollableViewport(selector) {
  return await page.locator(selector).first().evaluate((element) => {
    const viewport = element.closest(".ui-window-content-scroll-viewport");
    if (!(viewport instanceof HTMLElement)) {
      return { found: false };
    }
    return window.__EDITOR_INSPECTOR_SCROLL_READ_VIEWPORT__(viewport, element);
  });
}

async function sampleViewport(selector) {
  return await page.locator(selector).first().evaluate((element) => {
    const viewport = element.closest(".ui-window-content-scroll-viewport");
    return viewport instanceof HTMLElement
      ? window.__EDITOR_INSPECTOR_SCROLL_READ_VIEWPORT__(viewport, element)
      : { found: false };
  });
}

async function wheelViewport(selector, deltaY) {
  const center = await page.locator(selector).first().evaluate((element) => {
    const viewport = element.closest(".ui-window-content-scroll-viewport");
    const rect = (viewport ?? element).getBoundingClientRect();
    return {
      x: rect.left + Math.max(4, Math.min(rect.width - 4, rect.width / 2)),
      y: rect.top + Math.max(4, Math.min(rect.height - 4, rect.height / 2))
    };
  });
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(150);
}

async function dragViewportScrollbar(selector) {
  return await page.locator(selector).first().evaluate(async (element) => {
    const viewport = element.closest(".ui-window-content-scroll-viewport");
    if (!(viewport instanceof HTMLElement)) {
      return { attempted: false, reason: "missing viewport" };
    }
    const gutter = viewport.offsetWidth - viewport.clientWidth;
    if (gutter <= 0 || viewport.scrollHeight <= viewport.clientHeight) {
      return {
        attempted: false,
        reason: "no native vertical gutter",
        before: window.__EDITOR_INSPECTOR_SCROLL_READ_VIEWPORT__(viewport, element)
      };
    }
    return {
      attempted: true,
      gutter,
      before: window.__EDITOR_INSPECTOR_SCROLL_READ_VIEWPORT__(viewport, element)
    };
  }).then(async (result) => {
    if (!result.attempted) return result;
    const point = await page.locator(selector).first().evaluate((element) => {
      const viewport = element.closest(".ui-window-content-scroll-viewport");
      const rect = viewport.getBoundingClientRect();
      return {
        x: rect.right - Math.max(2, Math.min(6, (viewport.offsetWidth - viewport.clientWidth) / 2)),
        y: rect.top + Math.max(12, Math.min(rect.height - 12, rect.height * 0.35))
      };
    });
    const elementAtPoint = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      if (!(element instanceof HTMLElement)) {
        return { found: false };
      }
      return {
        found: true,
        tagName: element.tagName,
        className: element.className,
        withinResizeHandle: Boolean(element.closest(".floating-gizmo-window__resize")),
        withinWindowViewport: Boolean(element.closest(".ui-window-content-scroll-viewport"))
      };
    }, point);
    const frameBefore = await frameRectFor(selector);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y + 90, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    return {
      ...result,
      point,
      elementAtPoint,
      after: await sampleScrollableViewport(selector),
      frameBefore,
      frameAfter: await frameRectFor(selector)
    };
  });
}

async function sampleViewportScrollbarPoint(selector, yRatio) {
  const point = await page.locator(selector).first().evaluate((element, ratio) => {
    const viewport = element.closest(".ui-window-content-scroll-viewport");
    if (!(viewport instanceof HTMLElement)) {
      return null;
    }
    const rect = viewport.getBoundingClientRect();
    const gutter = viewport.offsetWidth - viewport.clientWidth;
    return {
      x: rect.right - Math.max(2, Math.min(6, gutter / 2)),
      y: rect.top + Math.max(12, Math.min(rect.height - 12, rect.height * ratio)),
      gutter
    };
  }, yRatio);
  if (!point) {
    return { found: false, reason: "missing viewport" };
  }
  return {
    found: true,
    point,
    elementAtPoint: await inspectElementAtPoint(point)
  };
}

async function dragFloatingResize(selector, mode) {
  const drag = await page.locator(selector).first().evaluate((element, resizeMode) => {
    const frame = element.closest(".floating-gizmo-window");
    if (!(frame instanceof HTMLElement)) {
      return null;
    }
    const rect = frame.getBoundingClientRect();
    if (resizeMode === "right") {
      return {
        point: {
          x: rect.right + 4,
          y: rect.top + Math.max(20, Math.min(rect.height - 20, rect.height * 0.5))
        },
        delta: { x: 72, y: 0 }
      };
    }
    return {
      point: {
        x: rect.right + 8,
        y: rect.bottom + 8
      },
      delta: { x: 56, y: 44 }
    };
  }, mode);
  if (!drag) {
    return { attempted: false, reason: "missing floating frame" };
  }
  const frameBefore = await frameRectFor(selector);
  const elementAtPoint = await inspectElementAtPoint(drag.point);
  await page.mouse.move(drag.point.x, drag.point.y);
  await page.mouse.down();
  await page.mouse.move(drag.point.x + drag.delta.x, drag.point.y + drag.delta.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  return {
    attempted: true,
    mode,
    point: drag.point,
    delta: drag.delta,
    elementAtPoint,
    frameBefore,
    frameAfter: await frameRectFor(selector)
  };
}

async function inspectElementAtPoint(point) {
  return await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    if (!(element instanceof HTMLElement)) {
      return { found: false };
    }
    return {
      found: true,
      tagName: element.tagName,
      className: element.className,
      withinResizeHandle: Boolean(element.closest(".floating-gizmo-window__resize")),
      withinWindowViewport: Boolean(element.closest(".ui-window-content-scroll-viewport"))
    };
  }, point);
}

async function frameRectFor(selector) {
  return await page.locator(selector).first().evaluate((element) => {
    const frame = element.closest(".floating-gizmo-window, .workspace-root-dock-frame, .app-shell__workspace");
    const rect = (frame ?? element).getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  });
}

async function sampleDebug() {
  return await page.locator(".debug-log-window.ui-scroll-view").first().evaluate((element) => {
    const outer = element.closest(".ui-window-content-scroll-viewport");
    const inner = element.classList.contains("ui-scroll-view") ? element : element.querySelector(".ui-scroll-view");
    const outerSample = outer instanceof HTMLElement
      ? window.__EDITOR_INSPECTOR_SCROLL_READ_VIEWPORT__(outer, element)
      : { found: false };
    const innerSample = inner instanceof HTMLElement
      ? window.__EDITOR_INSPECTOR_SCROLL_READ_VIEWPORT__(inner, element)
      : { found: false };
    return {
      outer: outerSample,
      inner: innerSample,
      virtualRowCount: element.querySelectorAll(".ui-virtual-list-view__row").length
    };
  });
}

function validateEvidence(evidence) {
  const errors = [];
  if (evidence.consoleErrors.length > 0) errors.push("console errors must be empty.");
  if (evidence.kind !== "editor-inspector-window-scroll-ownership-smoke") errors.push("kind mismatch.");
  if (!evidence.generatedAt) errors.push("generatedAt is required.");
  if (!evidence.inspector?.found) errors.push("Inspector must be inside a window content scroll viewport.");
  if (!evidence.inspector?.hasVerticalOverflow) errors.push("Inspector sample must overflow vertically.");
  if (!(evidence.inspector?.afterWheel?.scrollTop > evidence.inspector?.scrollTop)) {
    errors.push("Inspector window viewport must scroll with wheel.");
  }
  if (!evidence.inspector?.drag?.attempted) {
    errors.push(`Inspector scrollbar drag must be attempted with a native gutter: ${evidence.inspector?.drag?.reason ?? "unknown"}.`);
  } else {
    if (!(evidence.inspector.drag.gutter > 0)) {
      errors.push("Inspector scrollbar drag must prove a native vertical gutter.");
    }
    if (evidence.inspector.drag.elementAtPoint?.withinResizeHandle) {
      errors.push("Inspector scrollbar point must not be covered by a floating resize handle.");
    }
    if (!evidence.inspector.drag.elementAtPoint?.withinWindowViewport) {
      errors.push("Inspector scrollbar point must belong to the window content scroll viewport.");
    }
    if (evidence.inspector.drag.after.scrollTop === evidence.inspector.drag.before.scrollTop) {
      errors.push("Inspector scrollbar drag must change scrollTop.");
    }
    if (JSON.stringify(evidence.inspector.drag.frameBefore) !== JSON.stringify(evidence.inspector.drag.frameAfter)) {
      errors.push("Inspector scrollbar drag must not move or resize the window frame.");
    }
  }
  if (!evidence.inspector?.bottomRightScrollbarPoint?.found) {
    errors.push("Inspector bottom/right scrollbar sample point is required.");
  } else {
    if (!(evidence.inspector.bottomRightScrollbarPoint.point?.gutter > 0)) {
      errors.push("Inspector bottom/right scrollbar sample must prove a native gutter.");
    }
    if (evidence.inspector.bottomRightScrollbarPoint.elementAtPoint?.withinResizeHandle) {
      errors.push("Inspector bottom/right scrollbar sample must not hit a resize handle.");
    }
    if (!evidence.inspector.bottomRightScrollbarPoint.elementAtPoint?.withinWindowViewport) {
      errors.push("Inspector bottom/right scrollbar sample must remain inside the window viewport.");
    }
  }
  if (!evidence.inspector?.sideResize?.attempted) {
    errors.push(`Inspector side resize must be attempted: ${evidence.inspector?.sideResize?.reason ?? "unknown"}.`);
  } else {
    if (!evidence.inspector.sideResize.elementAtPoint?.withinResizeHandle) {
      errors.push("Inspector side resize start point must hit the resize handle element.");
    }
    if (!(evidence.inspector.sideResize.frameAfter.width > evidence.inspector.sideResize.frameBefore.width)) {
      errors.push("Inspector side resize must increase floating window width.");
    }
    if (evidence.inspector.sideResize.frameAfter.height !== evidence.inspector.sideResize.frameBefore.height) {
      errors.push("Inspector side resize must not change floating window height.");
    }
  }
  if (!evidence.inspector?.cornerResize?.attempted) {
    errors.push(`Inspector corner resize must be attempted: ${evidence.inspector?.cornerResize?.reason ?? "unknown"}.`);
  } else {
    if (!evidence.inspector.cornerResize.elementAtPoint?.withinResizeHandle) {
      errors.push("Inspector corner resize start point must hit the resize handle element.");
    }
    if (!(evidence.inspector.cornerResize.frameAfter.width > evidence.inspector.cornerResize.frameBefore.width)) {
      errors.push("Inspector corner resize must increase floating window width.");
    }
    if (!(evidence.inspector.cornerResize.frameAfter.height > evidence.inspector.cornerResize.frameBefore.height)) {
      errors.push("Inspector corner resize must increase floating window height.");
    }
  }
  if (!evidence.hierarchy?.found) errors.push("Hierarchy must be inside a window content scroll viewport.");
  if (!(evidence.hierarchy?.afterWheel?.scrollTop > evidence.hierarchy?.scrollTop)) {
    errors.push("Hierarchy window viewport must scroll with wheel.");
  }
  if (!evidence.scene?.found) errors.push("Scene must be inside a window content scroll viewport.");
  if (evidence.scene?.hasVerticalOverflow || evidence.scene?.hasHorizontalOverflow) {
    errors.push("Scene viewport must not get accidental window scrollbars.");
  }
  if (!evidence.debug?.outer?.found) errors.push("Debug must be inside a window content scroll viewport.");
  if (evidence.debug?.outer?.hasVerticalOverflow || evidence.debug?.outer?.hasHorizontalOverflow) {
    errors.push("Debug outer window viewport must not show a second scrollbar.");
  }
  if (!evidence.debug?.inner?.found || !evidence.debug.inner.hasVerticalOverflow) {
    errors.push("Debug inner virtual-list scroll view must remain scrollable.");
  }
  return errors;
}

async function writeOutputs(evidence) {
  await writeFile(dataPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  const report = [
    "# Editor Inspector Window Scroll Ownership Smoke",
    "",
    `- Passed: ${evidence.passed}`,
    `- Generated: ${evidence.generatedAt}`,
    `- URL: ${evidence.url}`,
    `- Console errors: ${evidence.consoleErrors.length}`,
    `- Inspector wheel: ${evidence.inspector?.scrollTop ?? "n/a"} -> ${evidence.inspector?.afterWheel?.scrollTop ?? "n/a"}`,
    `- Inspector drag attempted: ${Boolean(evidence.inspector?.drag?.attempted)}`,
    `- Inspector drag element covered by resize: ${Boolean(evidence.inspector?.drag?.elementAtPoint?.withinResizeHandle)}`,
    `- Inspector bottom/right gutter covered by resize: ${Boolean(evidence.inspector?.bottomRightScrollbarPoint?.elementAtPoint?.withinResizeHandle)}`,
    `- Inspector side resize width: ${evidence.inspector?.sideResize?.frameBefore?.width ?? "n/a"} -> ${evidence.inspector?.sideResize?.frameAfter?.width ?? "n/a"}`,
    `- Inspector corner resize size: ${evidence.inspector?.cornerResize?.frameBefore?.width ?? "n/a"}x${evidence.inspector?.cornerResize?.frameBefore?.height ?? "n/a"} -> ${evidence.inspector?.cornerResize?.frameAfter?.width ?? "n/a"}x${evidence.inspector?.cornerResize?.frameAfter?.height ?? "n/a"}`,
    `- Inspector actor-input scrollbar scope: covered by targeted unit tests; browser native hit captures recorded: ${evidence.hits.filter((hit) => hit.partId === "window-content-scrollbar").length}`,
    `- Hierarchy wheel: ${evidence.hierarchy?.scrollTop ?? "n/a"} -> ${evidence.hierarchy?.afterWheel?.scrollTop ?? "n/a"}`,
    `- Scene overflow: v=${Boolean(evidence.scene?.hasVerticalOverflow)} h=${Boolean(evidence.scene?.hasHorizontalOverflow)}`,
    `- Debug outer overflow: v=${Boolean(evidence.debug?.outer?.hasVerticalOverflow)} h=${Boolean(evidence.debug?.outer?.hasHorizontalOverflow)}`,
    "",
    "## Validation Errors",
    "",
    ...(evidence.validationErrors.length > 0 ? evidence.validationErrors.map((error) => `- ${error}`) : ["- None"]),
    ""
  ].join("\n");
  await writeFile(reportPath, report, "utf8");
}

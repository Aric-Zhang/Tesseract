import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ProjectArborGate4SmokeEvidence {
  readonly kind?: unknown;
  readonly passed?: unknown;
  readonly validationErrors?: unknown;
  readonly consoleErrors?: unknown;
  readonly opened?: unknown;
  readonly hoverSnapshots?: unknown;
  readonly dismissed?: unknown;
  readonly activation?: unknown;
  readonly tabDragSanity?: unknown;
  readonly tabCloseSanity?: unknown;
  readonly mobile?: unknown;
  readonly actorInputRouteEvidence?: unknown;
}

describe("Project Arbor Gate 4 smoke evidence", () => {
  it("validates a fresh Gate 4 browser smoke file when provided", () => {
    const evidencePath = process.env.PROJECT_ARBOR_GATE_4_SMOKE_EVIDENCE;
    if (!evidencePath) return;
    const resolvedPath = resolve(process.cwd(), "..", "..", evidencePath);
    expect(existsSync(resolvedPath), `smoke evidence file not found: ${evidencePath}`).toBe(true);
    const evidence = JSON.parse(readFileSync(resolvedPath, "utf8")) as ProjectArborGate4SmokeEvidence;
    expect(validateProjectArborGate4SmokeEvidence(evidence)).toEqual([]);
  });

  it("rejects missing hover and non-menu sanity evidence", () => {
    expect(validateProjectArborGate4SmokeEvidence({
      kind: "project-arbor-gate-4-smoke",
      passed: true,
      validationErrors: [],
      consoleErrors: [],
      opened: { popupHidden: false, items: [{ id: "type:scene" }] },
      hoverSnapshots: [],
      dismissed: { popupHidden: true },
      activation: { createdNewInspector: true },
      tabDragSanity: { stillHasTabs: true },
      tabCloseSanity: { closedOrChanged: false },
      mobile: { menuReachable: true },
      actorInputRouteEvidence: {
        menu: { popupHighlightedItemActorIds: [] },
        nonMenuSanity: {
          tabDragStillWorksWithMenuOpen: true,
          tabCloseStillWorksWithMenuOpen: false
        }
      }
    })).toContain("hoverSnapshots must contain highlighted menu item evidence.");
  });
});

function validateProjectArborGate4SmokeEvidence(
  evidence: ProjectArborGate4SmokeEvidence
): string[] {
  const errors: string[] = [];
  if (evidence.kind !== "project-arbor-gate-4-smoke") errors.push("kind must be project-arbor-gate-4-smoke.");
  if (evidence.passed !== true) errors.push("passed must be true.");
  if (!isEmptyArray(evidence.validationErrors)) errors.push("validationErrors must be empty.");
  if (!isEmptyArray(evidence.consoleErrors)) errors.push("consoleErrors must be empty.");

  const opened = asRecord(evidence.opened);
  if (opened?.popupHidden !== false) errors.push("Window menu popup must be open in opened evidence.");
  const openedItems = Array.isArray(opened?.items) ? opened.items : [];
  if (openedItems.length === 0) errors.push("Opened menu must contain items.");

  const hoverSnapshots = Array.isArray(evidence.hoverSnapshots) ? evidence.hoverSnapshots : [];
  if (hoverSnapshots.length === 0) {
    errors.push("hoverSnapshots must contain highlighted menu item evidence.");
  }
  for (const snapshot of hoverSnapshots) {
    const highlighted = (asRecord(snapshot)?.items as unknown[] | undefined)
      ?.filter((item) => asRecord(item)?.highlighted === true) ?? [];
    if (highlighted.length !== 1) {
      errors.push("Each hover snapshot must have exactly one highlighted item.");
      break;
    }
  }

  if (asRecord(evidence.dismissed)?.popupHidden !== true) errors.push("Escape dismiss evidence must close popup.");
  if (asRecord(evidence.activation)?.createdNewInspector !== true) {
    errors.push("Activation evidence must create a New Inspector instance.");
  }
  if (asRecord(evidence.tabDragSanity)?.stillHasTabs !== true) {
    errors.push("Tab drag sanity evidence must retain tabs.");
  }
  if (asRecord(evidence.tabCloseSanity)?.closedOrChanged !== true) {
    errors.push("Tab close sanity evidence must change tab state.");
  }
  if (asRecord(evidence.mobile)?.menuReachable !== true) {
    errors.push("Mobile menu evidence must show a reachable menu.");
  }

  const routeEvidence = asRecord(evidence.actorInputRouteEvidence);
  const hits = Array.isArray(routeEvidence?.hits) ? routeEvidence.hits : [];
  if (!hits.some((entry) => asRecord(entry)?.partId === "menu-item")) {
    errors.push("Actor-input route evidence must include a menu-item hit.");
  }
  const menuEvidence = asRecord(routeEvidence?.menu);
  const highlightedIds = Array.isArray(menuEvidence?.popupHighlightedItemActorIds)
    ? menuEvidence.popupHighlightedItemActorIds
    : [];
  if (highlightedIds.length === 0) errors.push("Actor-input route evidence must include highlighted menu item ids.");
  const nonMenu = asRecord(routeEvidence?.nonMenuSanity);
  if (nonMenu?.tabDragStillWorksWithMenuOpen !== true) {
    errors.push("Non-menu route evidence must include tab drag sanity.");
  }
  if (nonMenu?.tabCloseStillWorksWithMenuOpen !== true) {
    errors.push("Non-menu route evidence must include tab close sanity.");
  }
  return errors;
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

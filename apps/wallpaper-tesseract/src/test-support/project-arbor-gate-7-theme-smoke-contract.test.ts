import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ProjectArborGate7ThemeEvidence {
  readonly kind?: unknown;
  readonly passed?: unknown;
  readonly validationErrors?: unknown;
  readonly consoleErrors?: unknown;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly themeMenu?: unknown;
  readonly interactions?: unknown;
  readonly mobile?: unknown;
}

describe("Project Arbor Gate 7 theme smoke evidence", () => {
  it("validates a fresh Gate 7 theme smoke file when provided", () => {
    const evidencePath = process.env.PROJECT_ARBOR_GATE_7_THEME_SMOKE_EVIDENCE;
    if (!evidencePath) return;
    const resolvedPath = resolve(process.cwd(), "..", "..", evidencePath);
    expect(existsSync(resolvedPath), `smoke evidence file not found: ${evidencePath}`).toBe(true);
    const evidence = JSON.parse(readFileSync(resolvedPath, "utf8")) as ProjectArborGate7ThemeEvidence;
    expect(validateProjectArborGate7ThemeEvidence(evidence)).toEqual([]);
  });

  it("rejects theme evidence where the theme id changes but sampled styles do not", () => {
    const valid = createValidEvidence();
    const evidence = {
      ...valid,
      after: {
        ...asRecord(valid.after),
        styles: asRecord(asRecord(valid.before)?.styles)
      }
    };

    expect(validateProjectArborGate7ThemeEvidence(evidence)).toContain(
      "appShell sampled style must change after theme switch."
    );
  });

  it("rejects theme evidence without mobile submenu reachability", () => {
    const valid = createValidEvidence();
    const evidence = {
      ...valid,
      mobile: {
        ...asRecord(valid.mobile),
        themeSubmenuReachable: false
      }
    };

    expect(validateProjectArborGate7ThemeEvidence(evidence)).toContain(
      "mobile Theme submenu must be reachable."
    );
  });
});

export function validateProjectArborGate7ThemeEvidence(
  evidence: ProjectArborGate7ThemeEvidence
): string[] {
  const errors: string[] = [];
  if (evidence.kind !== "project-arbor-gate-7-theme-smoke") {
    errors.push("kind must be project-arbor-gate-7-theme-smoke.");
  }
  if (evidence.passed !== true) errors.push("passed must be true.");
  if (!isEmptyArray(evidence.validationErrors)) errors.push("validationErrors must be empty.");
  if (!isEmptyArray(evidence.consoleErrors)) errors.push("consoleErrors must be empty.");

  const before = asRecord(evidence.before);
  const after = asRecord(evidence.after);
  if (before?.themeId !== "default-dark") errors.push("initial theme must be default-dark.");
  if (after?.themeId !== "graphite-blue") errors.push("theme switch must select graphite-blue.");
  const beforeStyles = asRecord(before?.styles);
  const afterStyles = asRecord(after?.styles);
  for (const key of ["appShell", "menuBarItem", "activeTab", "hierarchyRow", "debugRow", "inspector"]) {
    if (JSON.stringify(beforeStyles?.[key]) === JSON.stringify(afterStyles?.[key])) {
      errors.push(`${key} sampled style must change after theme switch.`);
    }
  }

  const themeMenu = asRecord(evidence.themeMenu);
  if (themeMenu?.leafTopmost !== true) errors.push("theme submenu leaf must be topmost/clickable.");
  if (themeMenu?.themeChangeCount !== 1) errors.push("theme leaf must produce one theme change.");

  const interactions = asRecord(evidence.interactions);
  if (interactions?.windowMenuOpened !== true) errors.push("Window menu must still open.");
  if (interactions?.sceneFullscreenToggled !== true) errors.push("Scene fullscreen must still toggle.");

  const mobile = asRecord(evidence.mobile);
  if (mobile?.menuReachable !== true) errors.push("mobile Edit menu must be reachable.");
  if (mobile?.themeSubmenuReachable !== true) errors.push("mobile Theme submenu must be reachable.");
  if (mobile?.horizontalOverflow !== false) {
    errors.push("mobile theme chrome must not introduce horizontal overflow.");
  }

  return errors.sort();
}

function createValidEvidence(): ProjectArborGate7ThemeEvidence {
  return {
    kind: "project-arbor-gate-7-theme-smoke",
    passed: true,
    validationErrors: [],
    consoleErrors: [],
    before: {
      themeId: "default-dark",
      styles: {
        appShell: { "background-color": "rgb(16, 22, 28)" },
        menuBarItem: { "background-color": "rgb(20, 26, 32)" },
        activeTab: { "background-color": "rgb(37, 68, 92)" },
        hierarchyRow: { color: "rgba(232, 242, 252, 0.94)" },
        debugRow: { color: "rgba(232, 242, 252, 0.94)" },
        inspector: { "background-color": "rgb(21, 27, 33)" }
      }
    },
    after: {
      themeId: "graphite-blue",
      styles: {
        appShell: { "background-color": "rgb(15, 23, 32)" },
        menuBarItem: { "background-color": "rgb(29, 45, 59)" },
        activeTab: { "background-color": "rgb(47, 95, 128)" },
        hierarchyRow: { color: "rgba(216, 236, 255, 0.96)" },
        debugRow: { color: "rgba(216, 236, 255, 0.96)" },
        inspector: { "background-color": "rgb(24, 36, 49)" }
      }
    },
    themeMenu: {
      leafTopmost: true,
      themeChangeCount: 1
    },
    interactions: {
      windowMenuOpened: true,
      sceneFullscreenToggled: true
    },
    mobile: {
      menuReachable: true,
      themeSubmenuReachable: true,
      horizontalOverflow: false
    }
  };
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

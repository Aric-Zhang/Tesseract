import { describe, expect, it } from "vitest";
import {
  validateProjectPrismSmokeEvidence,
  type ProjectPrismSmokeEvidence
} from "./project-prism-smoke-contract";

describe("Project Prism smoke evidence contract", () => {
  it("accepts command-scoped interaction hit evidence", () => {
    expect(validateProjectPrismSmokeEvidence(createValidEvidence())).toEqual([]);
  });

  it("rejects log-tail style evidence with no structured actor hit", () => {
    const evidence = createValidEvidence({
      actorInputHit: null
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "interaction root-tab-close: actorInputHit actorId and partId are required"
    );
  });

  it("rejects smoke data with console errors", () => {
    const evidence = {
      ...createValidEvidence(),
      consoleErrors: ["boom"]
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain("consoleErrors must be empty, got 1");
  });

  it("rejects evidence when the structured actor hit does not match the expected target", () => {
    const evidence = createValidEvidence({
      actorInputHit: {
        actorId: "app-menu-bar",
        partId: "menu-dismiss"
      }
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "interaction root-tab-close: actorInputHit actorId expected workspace-root-frame, got app-menu-bar"
    );
  });

  it("rejects evidence when the DOM top target does not match the expected target", () => {
    const evidence = createValidEvidence({
      domTop: {
        tag: "div",
        className: "workspace-root-dock-frame",
        role: null,
        aria: null,
        text: ""
      }
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toEqual(expect.arrayContaining([
      "interaction root-tab-close: domTop tag expected button, got div",
      "interaction root-tab-close: domTop className must include window-frame-tab__close",
      "interaction root-tab-close: domTop aria must include Close Scene"
    ]));
  });
});

function createValidEvidence(
  interactionOverrides: Partial<ProjectPrismSmokeEvidence["interactions"][number]> = {}
): ProjectPrismSmokeEvidence {
  return {
    url: "http://127.0.0.1:5173/?resetWorkspaceLayout=1",
    viewport: { width: 1280, height: 720 },
    consoleErrors: [],
    interactions: [{
      name: "root-tab-close",
      point: { x: 120, y: 40 },
      expected: "root tab close receives the click",
      expectedTarget: {
        actorId: "workspace-root-frame",
        partId: "window-tab-action",
        domTag: "button",
        domClassIncludes: "window-frame-tab__close",
        domAriaIncludes: "Close Scene",
        actionResultContains: {
          sceneClosed: true
        }
      },
      domTop: {
        tag: "button",
        className: "window-frame-tab__close",
        aria: "Close Scene",
        role: null,
        text: "x"
      },
      domStack: [{
        tag: "button",
        className: "window-frame-tab__close",
        aria: "Close Scene",
        role: null,
        text: "x"
      }],
      actorInputHit: {
        actorId: "workspace-root-frame",
        partId: "window-tab-action"
      },
      actionResult: {
        sceneClosed: true
      },
      screenshotPath: "temp/root-tab-close.png",
      ...interactionOverrides
    }]
  };
}

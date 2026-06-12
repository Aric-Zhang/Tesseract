import { describe, expect, it } from "vitest";
import {
  validateProjectPrismSmokeEvidence,
  type ProjectPrismSmokeEvidence
} from "./project-prism-smoke-contract";

describe("Project Prism smoke evidence contract", () => {
  it("accepts graph, DOM, persistence, and command-scoped interaction evidence", () => {
    expect(validateProjectPrismSmokeEvidence(createValidEvidence())).toEqual([]);
  });

  it("rejects log-tail style evidence with no structured actor hit", () => {
    const evidence = createValidEvidence({
      interaction: {
        actorInputHit: null
      }
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

  it("rejects smoke data that is not marked as passed with no validation errors", () => {
    const evidence = {
      ...createValidEvidence(),
      passed: false,
      validationErrors: ["missing interaction"]
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toEqual(expect.arrayContaining([
      "passed must be true",
      "validationErrors must be empty, got 1"
    ]));
  });

  it("rejects evidence when the structured actor hit does not match the expected target", () => {
    const evidence = createValidEvidence({
      interaction: {
        actorInputHit: {
          actorId: "app-menu-bar",
          partId: "menu-dismiss"
        }
      }
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "interaction root-tab-close: actorInputHit actorId expected workspace-root-frame, got app-menu-bar"
    );
  });

  it("rejects evidence when the DOM top target does not match the expected target", () => {
    const evidence = createValidEvidence({
      interaction: {
        domTop: {
          tag: "div",
          className: "workspace-root-dock-frame",
          role: null,
          aria: null,
          text: ""
        }
      }
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toEqual(expect.arrayContaining([
      "interaction root-tab-close: domTop tag expected button, got div",
      "interaction root-tab-close: domTop className must include window-frame-tab__close",
      "interaction root-tab-close: domTop aria must include Close Scene"
    ]));
  });

  it("rejects graph evidence with missing graph ids and invalid active content", () => {
    const evidence = createValidEvidence({
      graph: {
        tabsets: [{
          frameId: "workspace-root-frame",
          tabsetId: "tabset:root",
          contentIds: ["content:scene"],
          activeContentId: "content:missing"
        }]
      }
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "graph tabset tabset:root: activeContentId must be in contentIds"
    );
  });

  it("rejects duplicate DOM parents and active content parity mismatches", () => {
    const evidence = createValidEvidence({
      dom: {
        contents: [{
          contentId: "content:scene",
          parentCount: 2,
          parentFrameId: "workspace-root-frame",
          parentTabsetId: "tabset:root",
          hidden: true,
          interactable: false,
          rect: { x: 0, y: 0, width: 0, height: 0 }
        }, {
          contentId: "content:debug",
          parentCount: 1,
          parentFrameId: "workspace-root-frame",
          parentTabsetId: "tabset:root",
          hidden: false,
          interactable: true,
          rect: { x: 0, y: 0, width: 100, height: 100 }
        }]
      }
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toEqual(expect.arrayContaining([
      "dom content content:scene: parentCount expected 1, got 2",
      "dom content content:scene: active graph content must be visible and interactable",
      "dom content content:scene: active content rect must be measurable",
      "dom content content:debug: inactive graph content must not remain visible and interactable"
    ]));
  });

  it("rejects persistence evidence that leaks runtime ownership ids", () => {
    const evidence = createValidEvidence({
      persistence: {
        containsActorIds: true,
        containsDomIds: true,
        containsRuntimeFrameIds: true,
        containsContentDomIds: true,
        runtimeOnlyFrameIds: ["fullscreen:scene"]
      }
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toEqual(expect.arrayContaining([
      "persistence must not contain actor ids",
      "persistence must not contain DOM ids",
      "persistence must not contain runtime frame ids",
      "persistence must not contain content DOM ids",
      "persistence must not include runtime-only frame ids, got fullscreen:scene"
    ]));
  });

  it("rejects evidence when required final-gate scenarios are missing", () => {
    const evidence = createValidEvidence({
      scenarios: [{
        name: "boot-baseline",
        passed: true,
        screenshotPaths: ["temp/boot.png"]
      }]
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain("scenario dock-mutation-5b-5c: missing");
  });

  it("rejects splitter interaction evidence without the expected graph split id", () => {
    const evidence = createValidEvidence({
      interaction: {
        name: "splitter-resize",
        actorInputHit: {
          actorId: "workspace-root-frame",
          partId: "splitter"
        },
        expectedTarget: {
          actorId: "workspace-root-frame",
          partId: "splitter",
          graphSplitId: "split:root"
        }
      }
    });

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "interaction splitter-resize: actorInputHit graphSplitId expected split:root, got <none>"
    );
  });
});

function createValidEvidence(
  overrides: {
    readonly graph?: Partial<ProjectPrismSmokeEvidence["graph"]>;
    readonly dom?: Partial<ProjectPrismSmokeEvidence["dom"]>;
    readonly persistence?: Partial<ProjectPrismSmokeEvidence["persistence"]>;
    readonly scenarios?: ProjectPrismSmokeEvidence["scenarios"];
    readonly interaction?: Partial<ProjectPrismSmokeEvidence["interactions"][number]>;
  } = {}
): ProjectPrismSmokeEvidence {
  const graph: ProjectPrismSmokeEvidence["graph"] = {
    revision: 42,
    frames: [{
      frameId: "workspace-root-frame",
      kind: "persistent",
      presentation: "windowed",
      visible: true,
      tabsetIds: ["tabset:root"],
      splitIds: ["split:root"]
    }],
    tabsets: [{
      frameId: "workspace-root-frame",
      tabsetId: "tabset:root",
      contentIds: ["content:scene", "content:debug"],
      activeContentId: "content:scene"
    }],
    splits: [{
      frameId: "workspace-root-frame",
      splitId: "split:root",
      direction: "horizontal"
    }],
    contents: [{
      contentId: "content:scene",
      frameId: "workspace-root-frame",
      tabsetId: "tabset:root",
      viewActorId: "scene-view",
      identity: { typeKey: "scene", instanceId: "scene:default" },
      active: true,
      interactable: true
    }, {
      contentId: "content:debug",
      frameId: "workspace-root-frame",
      tabsetId: "tabset:root",
      viewActorId: "debug-view",
      identity: { typeKey: "debug", instanceId: "debug:default" },
      active: false,
      interactable: false
    }],
    ...overrides.graph
  };
  const dom: ProjectPrismSmokeEvidence["dom"] = {
    contents: [{
      contentId: "content:scene",
      parentCount: 1,
      parentFrameId: "workspace-root-frame",
      parentTabsetId: "tabset:root",
      hidden: false,
      interactable: true,
      rect: { x: 0, y: 24, width: 640, height: 480 }
    }, {
      contentId: "content:debug",
      parentCount: 1,
      parentFrameId: "workspace-root-frame",
      parentTabsetId: "tabset:root",
      hidden: true,
      interactable: false,
      rect: { x: 0, y: 24, width: 640, height: 480 }
    }],
    ...overrides.dom
  };
  const persistence: ProjectPrismSmokeEvidence["persistence"] = {
    version: 2,
    descriptors: [
      { typeKey: "scene", instanceId: "scene:default" },
      { typeKey: "debug", instanceId: "debug:default" }
    ],
    frameIds: ["workspace-root-frame"],
    runtimeOnlyFrameIds: [],
    containsActorIds: false,
    containsDomIds: false,
    containsRuntimeFrameIds: false,
    containsContentDomIds: false,
    ...overrides.persistence
  };
  const scenarios: ProjectPrismSmokeEvidence["scenarios"] = overrides.scenarios ?? [
    "boot-baseline",
    "window-menu-open-focus",
    "root-tab-close-reopen",
    "dock-mutation-5b-5c",
    "splitter-resize",
    "scene-fullscreen-restore",
    "persistence-reload",
    "mobile-viewport",
    "render-input-sanity"
  ].map((name) => ({
    name,
    passed: true,
    screenshotPaths: [`temp/${name}.png`]
  }));
  return {
    passed: true,
    validationErrors: [],
    url: "http://127.0.0.1:5173/?resetWorkspaceLayout=1",
    viewport: { width: 1280, height: 720 },
    consoleErrors: [],
    graph,
    dom,
    persistence,
    scenarios,
    interactions: [{
      name: "root-tab-close",
      point: { x: 120, y: 40 },
      expected: "root tab close receives the click",
      expectedTarget: {
        actorId: "workspace-root-frame",
        partId: "window-tab-action",
        graphContentId: "content:scene",
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
        partId: "window-tab-action",
        graphContentId: "content:scene"
      },
      actionResult: {
        sceneClosed: true
      },
      screenshotPath: "temp/root-tab-close.png",
      ...overrides.interaction
    }]
  };
}

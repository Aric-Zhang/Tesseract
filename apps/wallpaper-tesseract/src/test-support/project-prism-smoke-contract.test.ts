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

  it("rejects evidence without fresh menu hover proof", () => {
    const evidence = createValidEvidence();
    delete (evidence as MutableSmokeEvidence).menuHover;

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain("menuHover evidence is required");
  });

  it("rejects evidence without fresh dock mutation proof", () => {
    const evidence = createValidEvidence();
    delete (evidence as MutableSmokeEvidence).dockMutation;

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain("dockMutation evidence is required");
  });

  it("rejects evidence without fresh mobile viewport proof", () => {
    const evidence = createValidEvidence();
    delete (evidence as MutableSmokeEvidence).mobileViewport;

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain("mobileViewport evidence is required");
  });

  it("rejects evidence without fresh Camera3 action proof", () => {
    const evidence = createValidEvidence();
    delete (evidence as MutableSmokeEvidence).camera3Action;

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain("camera3Action evidence is required");
  });

  it("rejects menu hover proof when the highlighted row does not follow the hovered row", () => {
    const evidence = {
      ...createValidEvidence(),
      menuHover: {
        ...createValidEvidence().menuHover,
        hoveredLabel: "Scene",
        highlightedLabel: "Debug Log Window"
      }
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "menuHover highlightedLabel expected Scene, got Debug Log Window"
    );
  });

  it("rejects dock mutation proof when the graph revision does not advance", () => {
    const evidence = {
      ...createValidEvidence(),
      dockMutation: {
        ...createValidEvidence().dockMutation,
        beforeGraphRevision: 42,
        afterGraphRevision: 42
      }
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "dockMutation afterGraphRevision must be greater than beforeGraphRevision"
    );
  });

  it("rejects dock mutation proof without preview element target data", () => {
    const evidence = {
      ...createValidEvidence(),
      dockMutation: {
        ...createValidEvidence().dockMutation,
        previewElement: {
          dockKind: "",
          targetFrameId: "",
          targetTabsetId: ""
        }
      }
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toEqual(expect.arrayContaining([
      "dockMutation previewElement dockKind is required",
      "dockMutation previewElement targetFrameId is required",
      "dockMutation previewElement targetTabsetId is required"
    ]));
  });

  it("rejects dock mutation proof without a DOM pane/tabset/splitter or layout delta", () => {
    const evidence = {
      ...createValidEvidence(),
      dockMutation: {
        ...createValidEvidence().dockMutation,
        domDelta: {
          beforePaneCount: 2,
          afterPaneCount: 2,
          beforeTabsetCount: 2,
          afterTabsetCount: 2,
          beforeSplitterCount: 1,
          afterSplitterCount: 1
        }
      }
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "dockMutation domDelta must show a pane, tabset, splitter, or layout signature change"
    );
  });

  it("accepts dock mutation proof when pane counts stay stable but layout signature changes", () => {
    const evidence = {
      ...createValidEvidence(),
      dockMutation: {
        ...createValidEvidence().dockMutation,
        domDelta: {
          beforePaneCount: 2,
          afterPaneCount: 2,
          beforeTabsetCount: 2,
          afterTabsetCount: 2,
          beforeSplitterCount: 1,
          afterSplitterCount: 1,
          beforeLayoutSignature: "scene|debug",
          afterLayoutSignature: "debug|scene"
        }
      }
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toEqual([]);
  });

  it("rejects mobile viewport proof with unmeasurable key UI rects", () => {
    const evidence = {
      ...createValidEvidence(),
      mobileViewport: {
        ...createValidEvidence().mobileViewport,
        camera3GizmoRect: { x: 0, y: 0, width: 0, height: 0 }
      }
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "mobileViewport camera3GizmoRect must be measurable"
    );
  });

  it("rejects mobile viewport proof when key UI rects are outside the viewport", () => {
    const evidence = {
      ...createValidEvidence(),
      mobileViewport: {
        ...createValidEvidence().mobileViewport,
        windowMenuRect: { x: 1200, y: 10, width: 48, height: 25 }
      }
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "mobileViewport windowMenuRect must intersect the mobile viewport"
    );
  });

  it("rejects Camera3 action proof when view state does not change", () => {
    const evidence = {
      ...createValidEvidence(),
      camera3Action: {
        ...createValidEvidence().camera3Action,
        beforeViewStateHash: "same",
        afterViewStateHash: "same"
      }
    };

    expect(validateProjectPrismSmokeEvidence(evidence)).toContain(
      "camera3Action view-state hash must change"
    );
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

type MutableSmokeEvidence = {
  -readonly [Key in keyof ProjectPrismSmokeEvidence]?: ProjectPrismSmokeEvidence[Key];
};

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
    }],
    menuHover: {
      pointer: { x: 1190, y: 54 },
      hoveredLabel: "Scene",
      highlightedLabel: "Scene",
      screenshotPath: "temp/menu-hover-scene.png"
    },
    dockMutation: {
      beforeGraphRevision: 42,
      afterGraphRevision: 43,
      source: { typeKey: "debug", instanceId: "debug:default" },
      target: { typeKey: "scene", instanceId: "scene:default" },
      previewElement: {
        dockKind: "split",
        targetFrameId: "workspace-root-frame",
        targetTabsetId: "tabset:root"
      },
      domDelta: {
        beforePaneCount: 1,
        afterPaneCount: 2,
        beforeTabsetCount: 1,
        afterTabsetCount: 2,
        beforeSplitterCount: 0,
        afterSplitterCount: 1
      },
      afterDomContents: [{
        contentId: "content:debug",
        parentCount: 1,
        parentFrameId: "workspace-root-frame",
        parentTabsetId: "tabset:root",
        hidden: false,
        interactable: true,
        rect: { x: 0, y: 24, width: 320, height: 480 }
      }],
      screenshotPath: "temp/dock-debug-into-scene.png"
    },
    mobileViewport: {
      viewport: { width: 390, height: 844 },
      sceneRect: { x: 0, y: 32, width: 390, height: 520 },
      tesseractRect: { x: 96, y: 180, width: 180, height: 180 },
      windowMenuRect: { x: 338, y: 10, width: 48, height: 25 },
      camera3GizmoRect: { x: 300, y: 96, width: 72, height: 72 },
      screenshotPath: "temp/mobile-viewport.png"
    },
    camera3Action: {
      actionName: "camera3-orbit",
      beforeViewStateHash: "camera-before",
      afterViewStateHash: "camera-after",
      actionResult: { routed: true },
      screenshotPath: "temp/camera3-action.png"
    }
  };
}

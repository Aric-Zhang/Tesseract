# Project Prism Phase 0B Boundary Matrix Closure Plan

Date: 2026-06-07

## Purpose

This plan closes the remaining Phase 0B work before any formal package
extraction. It does not block app-local architecture preparation, but it blocks declaring
Project Prism Phase 0 fully complete and blocks extracting `actor-core`,
`ui-framework`, or `runtime-core` as independent packages.

Detailed extraction-blocker analysis:

```text
temp/project-prism-phase-0b-extraction-blockers-implementation-plan.md
```

Remaining blocker resolution steps:

```text
temp/project-prism-phase-0b-remaining-blockers-resolution-steps.md
```

Current accepted state:

- Phase 0A boundary helper and zone map baseline: complete.
- Phase 0B shared fact module, first dependency matrix helper, dynamic import
  reporting, extraction blocker facts, and reusable smoke contract: first pass
  implemented.
- Phase 0C smoke baseline: recorded.
- Phase 0D interaction/render host gate: complete.
- Phase 0B generated boundary report and regenerated structured browser smoke:
  still incomplete.

## Rule

App-local architecture preparation may start from this baseline only as debt
reduction. It must not perform formal package extraction. Extraction requires
this plan to pass.

## Step 0B.0: Baseline And Fact Source Checkpoint

### Goal

Freeze the current executable facts before expanding the matrix.

### Work

- Run and record:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

- Record current dirty scope without reverting unrelated files.
- Verify `architecture-boundaries.test.ts` still imports shared helpers from
  `test-support/architecture-boundaries.ts`.

### Tests

All commands above must pass. Existing Vite chunk warnings are acceptable.

## Step 0B.1: Single Fact Source For Zone Map, Edges, And Report

### Goal

Stop maintaining zone map, dependency graph, and blocker report as separate
manual facts.

### Work

- Move Project Prism zone definitions into a reusable test-support fact module.
- Generate dependency edges from parsed import/export-from data.
- Add a report helper that emits:
  - candidate zones;
  - debt zones;
  - dependency violations;
  - blocker summaries;
  - deletion conditions.
- Keep the human boundary report as an artifact derived from those facts, not as
  an independent source of truth.

### Tests

- `architecture-boundaries` fails if a production file has no zone.
- `architecture-boundaries` fails if report facts omit a debt zone present in
  the zone map.
- production code cannot import test-support.

### Current Status

First pass implemented for zone/blocker facts. The human report still needs to
be generated from those facts before Phase 0B can be marked complete.

## Step 0B.2: Expand Dependency Matrix

### Goal

Turn the current first-batch dependency rules into a package-shaped matrix.

### Required Matrix

```text
actor-core-candidate:
  may not import app/runtime/ui/editor/gizmo/DOM/Three facts

actor-input-candidate:
  may import actor-core and gizmo-core only through explicit ports

ui-framework-candidate:
  may import actor-core/actor-input ports
  may not import Scene/Camera/Tesseract/Debug/Hierarchy/Inspector concrete facts
  may not import scene-runtime except through explicit ui-state-binding-debt

runtime-core-candidate:
  may import math packages and actor-core ports
  may not import DOM/UI/editor/gizmo/Three

runtime-three-candidate:
  may import runtime-core and Three
  may not import editor/ui-framework/app composition

editor-candidate:
  may import public ui/runtime ports
  may not become a fact source for UI framework internals

app-composition:
  may import public installers/bootstrap ports
  must not import concrete component internals or window/runtime controller internals
```

### Tests

- parsed edges, including barrel exports, enforce the matrix.
- no new allowlist is accepted; mixed files must be debt zones with deletion
  conditions.

### Current Status

First matrix helper and rules are implemented. Additional candidate coverage can
be added without changing the helper shape.

## Step 0B.3: Runtime Candidate Gates Inside The App

### Goal

Cover app-local runtime candidates, not only existing `packages/four-*`.

### Work

- Classify current runtime-like app files as either candidate or debt:
  - tesseract runtime ownership;
  - camera model/control;
  - renderable scene view binding;
  - Three/WebGL renderer ownership.
- For each debt entry, record:
  - what UI/editor fact it still imports;
  - which future package it blocks;
  - what port must replace the coupling.

### Tests

- existing `packages/four-*` remain independent from app/editor/ui.
- runtime-core candidates cannot import `HTMLElement`, `Document`,
  `window-runtime`, `features/app-menu`, concrete editor windows, or gizmo UI.
- runtime-three candidates cannot import editor or ui-framework candidates.

### Current Status

Runtime-like app files are currently recorded as ownership debt with blocker
facts. They are not yet clean runtime candidates.

## Step 0B.4: App Composition Thinness Gate

### Goal

Prevent `create-wallpaper-app.ts` from absorbing more concrete policy.

### Current Debt

`create-wallpaper-app.ts` still wires concrete scene/debug/hierarchy/inspector
state and policy. This is allowed only as `app-composition-debt`.

### Work

- Keep existing gates that forbid app composition importing concrete actor
  factories and controller internals.
- Add a stricter future gate description: once editor/runtime installers exist,
  app composition may import only:
  - shell/bootstrap;
  - actor/component registry bootstrap;
  - runtime installer;
  - editor installer;
  - ui-framework installer;
  - render loop.

### Tests

- app composition cannot import concrete view actor factories.
- app composition cannot instantiate window lifecycle/controller/factory
  internals directly.
- app composition cannot read browser storage directly.

## Step 0B.5: Improved Interaction Smoke Data Contract

### Goal

Improve the Phase 0D smoke data shape before reusing it as a long-term
regression gate.

### Work

- Replace log-tail `actorInputLine` sampling with command-scoped hit capture.
- Each interaction point should store:
  - point coordinates;
  - DOM top stack;
  - actor input hit actor;
  - actor input hit part;
  - action result;
  - screenshot path.

### Tests

- smoke data must fail validation if a required interaction has no structured
  hit result.
- wide desktop, narrow/mobile, root/floating overlap, split-region docking, and
  repeated dock/undock loop are recorded as comparable artifacts.

### Current Status

Reusable validation contract is implemented in
`apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.ts`.
Existing browser artifacts still need regeneration under that contract.

## Step 0B.6: Exit Report

### Goal

Create a Phase 0 exit report that can support formal package extraction.

### Required Contents

- generated zone map summary;
- generated dependency matrix result;
- debt zone list with blockers and deletion conditions;
- legacy locks and replacement contracts;
- Phase 1+ extraction blockers;
- browser smoke artifacts:
  - wide desktop;
  - mobile/narrow;
  - root/floating overlap;
  - split-region docking;
  - repeated dock/undock loop;
- exact validation commands and results.

## Exit Criteria

Phase 0 can be marked fully complete only when:

- this plan passes;
- Phase 0B is no longer listed as partially complete;
- boundary report is generated from the same facts as the tests;
- no extraction-blocking dependency matrix gaps remain;
- root, workspace, docking, and Scene render host browser gates have structured
  hit/action data.

# Project Prism Phase 0B Remaining Blockers Resolution Steps

Date: 2026-06-07

## Purpose

This document turns the remaining Project Prism Phase 0B blockers into concrete
resolution steps.

The key distinction:

- Phase 0B completes when package extraction boundaries, blockers, and browser
  interaction evidence are executable and reproducible.
- Phase 0B does not complete the actual extraction of `actor-core`,
  `ui-framework`, or `runtime-core`.
- Debt zones discovered by Phase 0B are not acceptable package APIs. They are
  assigned to later phases with explicit deletion conditions.

## Current Baseline

Already implemented:

- Shared Project Prism facts:
  - `apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts`
- Parsed import/export dependency helpers:
  - `apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts`
- Boundary tests consuming shared facts:
  - `apps/wallpaper-tesseract/src/architecture-boundaries.test.ts`
- Structured smoke evidence contract:
  - `apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.ts`

Known green validation from the current baseline:

```text
npm run test -w wallpaper-tesseract -- project-prism-smoke-contract architecture-boundaries
# passed, 2 files / 77 tests

npm run test -w wallpaper-tesseract
# passed, 65 files / 603 tests

npm run typecheck -w wallpaper-tesseract
# passed

npm run build -w wallpaper-tesseract
# passed, existing Vite chunk warning

npm run test
npm run typecheck
npm run build
# passed, existing Vite chunk warning
```

Phase 0B is still incomplete because:

- the boundary report is still manually maintained;
- the dependency matrix has first-pass executable coverage but not a generated
  extraction summary;
- existing browser smoke artifacts have not been regenerated using structured
  command-scoped hit evidence;
- package extraction blockers are classified, but not yet assigned into a
  final phase handoff report.

## Completion Model

This work should be treated as a small phase, not a single patch.

Recommended checkpoints:

```text
Phase 0B.1  Generated boundary facts/report
Phase 0B.2  Complete package-boundary matrix summary
Phase 0B.3  Structured browser evidence regeneration
Phase 0B.4  Final Phase 0B exit report and handoff gates
```

After Phase 0B.4 passes, formal package extraction can be planned. Actual
extraction still belongs to later phases.

## Phase 0B.1: Generated Boundary Facts And Report

### Goal

Remove the last manual dual-source-of-truth between executable boundary facts
and `temp/project-prism-phase-0-boundary-report.md`.

### Current Blocker

The authoritative facts live in:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts
```

But the human report is still hand-written:

```text
temp/project-prism-phase-0-boundary-report.md
```

This blocks extraction because future package moves could be justified from a
stale report while tests enforce different facts.

### Solution

Add a report-generation helper that reads the same facts used by tests and
emits a structured model plus markdown.

Suggested files:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-boundary-report.ts
apps/wallpaper-tesseract/src/test-support/project-prism-boundary-report.test.ts
temp/project-prism-phase-0b-boundary-summary.json
temp/project-prism-phase-0-boundary-report.md
```

The helper should emit both a machine-readable summary and markdown:

- candidate zones;
- debt zones;
- zone dependency rules;
- debt blockers and deletion conditions;
- runtime/UI/app composition extraction blockers;
- dynamic import summary;
- unresolved or unclassified files;
- current package extraction verdict.

The JSON summary is the authoritative generated artifact. Markdown is the
human-readable rendering of that summary.

### Boundaries

- Do not import `test-support` from production code.
- Do not create a second facts file for the report.
- Do not weaken current boundary tests with allowlists. Mixed files must remain
  debt zones with deletion conditions.

### Tests

Run:

```text
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Required assertions:

- every debt zone in `projectPrismSourceZones` has a report blocker;
- report markdown contains every blocker id from runtime/UI/app composition
  blocker facts;
- generated JSON and markdown contain the same package target verdicts;
- report markdown clearly says Phase 0B is incomplete when structured browser
  evidence is missing;
- production files cannot import `test-support`.

### Exit Criteria

- `temp/project-prism-phase-0-boundary-report.md` can be regenerated from the
  same facts used by tests.
- `temp/project-prism-phase-0b-boundary-summary.json` exists and is validated in
  tests.
- Manual edits may add prose only if they do not duplicate or contradict the
  generated blocker facts.

## Phase 0B.2: Complete Package-Boundary Matrix Summary

### Goal

Make the intended package graph executable enough that future extraction work
cannot accidentally preserve reverse dependencies through barrels, debt files,
or partial candidate zones.

### Current Blocker

The matrix helper exists, but Phase 0B still needs a generated summary that
answers:

- which package-shaped zones currently have clean candidates;
- which zones are empty by design;
- which zones are blocked by debt;
- which dependency directions are forbidden;
- which violations are true blockers versus intentionally classified debt.

### Solution

Extend the existing fact model rather than adding new ad hoc tests.

Suggested changes:

- Add package graph metadata to
  `project-prism-boundary-facts.ts`, for example:

```ts
ProjectPrismPackageTarget {
  id: "actor-core" | "actor-input" | "ui-framework" | "runtime-core" | ...;
  cleanCandidateZones: string[];
  debtZones: string[];
  blockedBy: string[];
  extractionPhase: string;
  extractionStatus: "allowed" | "blocked" | "deferred";
}
```

- Teach the report helper to output a package-target table.
- Keep `runtime-core-candidate` and `runtime-three-candidate` absent or empty
  until real clean candidates exist. Do not misclassify app-local runtime debt
  as clean candidates just to fill the table.

### Boundaries

- A package target may be `blocked`.
- A package target must not pretend debt files are clean package candidates.
- Current app-local Camera3/Tesseract/Scene ownership files should remain
  `runtime-ownership-debt` until later runtime extraction phases.

### Tests

Run:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Required assertions:

- every package target has either clean candidate zones or explicit blockers;
- no target can be marked `allowed` if any blocker listed in `blockedBy` still
  exists;
- candidate zones cannot import future higher-level package targets;
- debt zones are reported, not silently ignored;
- barrel export edges are included in the same matrix evaluation;
- dynamic imports are reported as unknown/debt evidence, not dropped.

### Exit Criteria

- The report can state, per package target, whether extraction is allowed,
  blocked, or deferred.
- Formal extraction remains blocked for `actor-core`, `ui-framework`, and
  `runtime-core` until their debt zones are deleted or moved to later-phase
  blockers.

## Phase 0B.3: Structured Browser Evidence Regeneration

### Goal

Replace historical smoke artifacts that sample debug log tails with command-
scoped structured evidence.

### Current Blocker

The reusable validator exists:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.ts
```

But current browser artifacts were not regenerated under this contract.

This blocks UI framework extraction because visual z-index, DOM hit target, and
actor input hit target can diverge during window/tab/dock refactors.

### Solution

Add a deterministic smoke harness that can capture per-interaction evidence.

Preferred shape:

- use a dev-only/test-only capture hook that records actor input hit results by
  command id;
- record `document.elementsFromPoint()` at the same interaction point;
- record action result from observable app state;
- write JSON conforming to `ProjectPrismSmokeEvidence`;
- validate the JSON with `validateProjectPrismSmokeEvidence()`.
- include `expectedTarget` semantics for interactions where visual target,
  DOM top, actor input hit, and action result must agree.

Suggested artifacts:

```text
temp/project-prism-phase-0b-wide-smoke-data.json
temp/project-prism-phase-0b-mobile-smoke-data.json
temp/project-prism-phase-0b-docking-loop-smoke-data.json
temp/project-prism-phase-0b-smoke-summary.json
temp/project-prism-phase-0b-smoke-report.md
```

### Required Browser Scenarios

Desktop wide viewport:

- root Scene visible and renderable;
- floating frame overlaps root tabs;
- covered root tab/control is not reachable;
- uncovered root tab/control is reachable;
- menu focus/open action selects an existing view.

Mobile/narrow viewport:

- tab close hit rect remains inside tab bounds;
- menu is reachable;
- Scene fullscreen/restore controls remain usable;
- no text/control overlap blocks actor input.

Docking loop:

- dock view into root;
- float it out;
- split it left/right/top/bottom;
- merge it back as tab;
- close/reopen via menu;
- repeat enough to catch stale content hosts.

Scene render host:

- Scene close/reopen;
- Scene fullscreen/restore;
- Camera3 gizmo drag/double-click;
- canvas rect and overlay rect remain non-zero.

### Boundaries

- Do not accept `actorInputLine` log-tail samples as pass evidence.
- Do not use manual screenshots without structured JSON.
- If in-app Browser automation is unstable, Playwright/CDP fallback is allowed,
  but the report must record the tool, URL, viewport, dev server port, and
  server PID.
- Stop the dev server started by the smoke harness.

### Tests

Run:

```text
npm run test -w wallpaper-tesseract -- project-prism-smoke-contract
npm run dev -w wallpaper-tesseract
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Validate each generated smoke JSON with
`validateProjectPrismSmokeEvidence()`.

### Exit Criteria

- Wide, mobile, and docking-loop evidence all validate with zero console errors.
- Reports include screenshots and structured JSON paths.
- Smoke summaries record expected target, DOM top, actor input hit, and action
  result consistency for every critical interaction.
- Phase 0B no longer depends on historical log-tail smoke samples.

## Phase 0B.4: Final Phase 0B Exit Report

### Goal

Produce a final report that can be trusted as the starting point for package
extraction planning.

### Current Blocker

The current boundary report states Phase 0B is partially complete. That is still
correct until generated facts and structured browser evidence are both present.

### Solution

Create a final report that separates:

- Phase 0B completion evidence;
- later-phase package extraction blockers;
- package targets that are safe to plan;
- package targets still blocked by debt.

Suggested file:

```text
temp/project-prism-phase-0b-exit-report.json
temp/project-prism-phase-0b-exit-report.md
```

### Required Contents

- generated zone map summary;
- generated package-target matrix summary;
- debt zone table with deletion conditions;
- runtime/UI/app composition blocker tables;
- structured browser smoke artifact table;
- exact validation commands and results;
- explicit handoff table for Phase 1/2/3/4+ blockers;
- final verdict:
  - whether Phase 0B is complete;
  - whether formal package extraction may start;
  - which package targets remain blocked.

### Tests

Run full validation:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

### Exit Criteria

Phase 0B can be marked complete only when:

- generated report facts match test facts;
- dependency matrix has no hidden gaps for current candidates;
- every remaining mixed file is explicit debt with deletion condition;
- browser smoke evidence is structured and comparable;
- package extraction blockers are assigned to later phases instead of hidden
  inside Phase 0B.
- JSON exit report and Markdown exit report agree on the final verdict.

## Deferred Package Extraction Blockers

These are not Phase 0B completion blockers once documented and assigned. They
are the reason formal package extraction still requires later phases.

## Phase 1: Shared Spine Decoupling

### Blocker

`SceneFrame`, `SceneCommandSink`, gizmo capability, state observer capability,
scene-runtime scheduler concepts, and `ComponentRuntimeBridge` responsibilities
still cross future package boundaries.

### Solution Direction

- Define scheduler/update ports.
- Define runtime/editor/UI command and state ports.
- Move gizmo and state observer capabilities out of core component contracts.
- Split `ComponentRuntimeBridge` by ownership.
- Lock old capability names out of candidate zones.

### Gate

No package extraction should begin until shared spine ports exist and old mixed
contracts cannot re-enter candidate zones.

## Phase 2: Actor Core And Actor Input Extraction

### Blocker

`actor-runtime/component.ts` and bridge files still know scene frame, command
sink, gizmo, and state observer concepts.

### Solution Direction

- Split pure actor tree/lifecycle/component attachment primitives from binding
  concepts.
- Move frame update to a scheduler/update port.
- Move command sink to editor/state ports.
- Move gizmo and state observer capabilities into binding packages.
- Delete legacy capability names rather than wrapping them.

### Gate

`actor-core` extraction may start only when candidate files no longer import
scene-runtime, gizmo-core, window-runtime, DOM, Three, or app features.

## Phase 3: UI Framework Port Split And Extraction

### Blocker

`window-runtime` and app menu/workspace features still depend on scene-runtime
paths, vectors, frame update, and runtime service registration.

### Solution Direction

- Introduce UI-owned layout state contracts.
- Introduce UI scheduler/service registration ports.
- Move geometry types to UI-owned contracts.
- Use app/editor adapters to connect scene/editor state to UI ports.

### Gate

`ui-framework` extraction may start only when generic UI code no longer imports
scene-runtime or concrete Scene/Camera/Tesseract/Debug/Hierarchy/Inspector
facts.

## Phase 4: Runtime Core Contracts And Projection Graph

### Blocker

Tesseract4, Camera3, Scene render host, and Three/WebGL ownership are still
owned by app/editor feature folders.

### Solution Direction

- Define runtime world/camera/projection actors.
- Define frame source, runtime command, and runtime query ports.
- Separate renderer-agnostic runtime from Three backend.
- Make editor Scene View consume runtime frame sources instead of owning runtime
  resources.

### Gate

Runtime-core contract work may begin after Phase 0B as app-local design and
tests, but `runtime-core` extraction may start only when runtime candidates do
not import DOM, window-runtime, app menu, editor windows, gizmo UI, or Three.

## Phase 5: Runtime Three Backend And Scene View Inversion

### Blocker

Even after runtime contracts exist, real Tesseract/Camera3/Three ownership still
needs to move out of editor Scene View.

### Solution Direction

- Move Tesseract/4D update ownership into runtime world actors.
- Move Camera3 ownership into runtime camera actors or runtime backend adapters.
- Move Three/WebGL render target ownership into `runtime-three`.
- Make Scene View consume frame sources.
- Make Gizmo mutate camera state through runtime commands.

### Gate

`runtime-three` may import Three but not editor/UI/app composition. Scene View
must not own world/camera resources.

## Phase 6: Editor Package Extraction

### Blocker

Debug, Inspector, Hierarchy, Scene View, Camera Gizmo, editor menus, and editor
workspace composition still live inside the wallpaper app source tree.

### Solution Direction

- Extract editor feature installers and defaults.
- Keep editor content out of `ui-framework`.
- Make Scene View consume runtime frame sources through editor/runtime ports.

### Gate

Editor may depend on actor-core, actor-input, ui-framework, runtime-core, and
runtime-three. Runtime and UI framework must not import editor feature content.

## Phase 7: App Composition Thin Bootstrap

### Blocker

`create-wallpaper-app.ts`, `install-component-definitions.ts`, and
`workspace-mode.ts` still wire concrete editor/runtime/UI policy.

### Solution Direction

- Editor package owns editor window registration and defaults.
- Runtime package owns world/camera/runtime defaults.
- UI framework owns workspace/menu/window bootstrap.
- App composition connects shell, stores, installers, and render loop only.

### Gate

The wallpaper app imports public installers and bootstrap ports only.

## Recommended Execution Order

1. Complete Phase 0B.1 generated report helper.
2. Complete Phase 0B.2 package-target matrix summary.
3. Complete Phase 0B.3 structured browser evidence regeneration.
4. Complete Phase 0B.4 final exit report.
5. Start Phase 1 shared spine decoupling.
6. Start Phase 2 actor-core/actor-input extraction.
7. Start Phase 3 ui-framework extraction.
8. Start Phase 4 runtime-core contracts.
9. Start Phase 5 runtime-three and Scene View inversion.
10. Start Phase 6 editor extraction.
11. Start Phase 7 app composition thinning.

This order keeps the boundary freeze honest before any package extraction, while
also preventing Phase 0B from expanding into the entire Project Prism rewrite.

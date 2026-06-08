# Project Prism Phase 3B Closure Report

Date: 2026-06-08

## Verdict

Phase 3B is complete enough to start Phase 3C extraction planning and package
scaffold work.

This does not mean the UI framework package has been extracted. It means the
generic UI system now has a product-free fixture proving the core root/floating
workspace loop without Scene, Camera3, Tesseract, Debug, Hierarchy, Inspector,
or app composition feature installers.

## Completed Scope

- Added `src/ui-framework-fixture/` as a product-free UI framework rehearsal.
- Added generic dockable view content, fixture state/scheduler/storage, and a
  fixture installer.
- Added a dedicated `ui-framework-fixture.html` Vite entry with fixture-only UI
  CSS imports.
- Added generic multi-instance fixture views using `WindowViewIdentity`.
- Added fixture unit coverage for:
  - root workspace + floating frame + menu creation;
  - type open/focus;
  - multi-instance creation;
  - single view close;
  - singleton close/reopen;
  - v2 logical identity persistence and hydrate.
- Added a product-free browser storage adapter with smoke-only DOM telemetry.
- Added boundary coverage that blocks fixture imports from product features,
  app composition, app runtime, scene runtime, and runtime ownership folders.
- Drafted the Phase 3C public UI framework API surface in
  `temp/project-prism-phase-3b-ui-framework-public-api-draft.md`.

## Browser Smoke

Report: `temp/project-prism-phase-3b-fixture-smoke-report.md`

Data: `temp/project-prism-phase-3b-fixture-smoke-data.json`

Screenshot: `temp/project-prism-phase-3b-fixture-smoke.png`

The smoke covered:

- fixture page load through the dedicated static entry;
- Window menu open;
- generic `new-instance` action;
- floating panel tab drag into root tabbar;
- root two-tab merge;
- inactive root tab click;
- content deck visibility;
- tab close hit rect inside tab bounds;
- inactive root tab close;
- reload/hydrate from logical persisted identity.

Result: passed, 0 validation errors.

Viewport: 594 x 698, which also covers the current narrow/mobile-like tab close
geometry risk.

## Validation Commands

Targeted:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report ui-framework-fixture
npm run typecheck -w wallpaper-tesseract
```

Both passed.

Boundary report regeneration:

```text
npm run prism:phase0:report
```

Passed and regenerated the shared Project Prism boundary report/summary.

## Important Notes

- The fixture has no dependency on `AppRuntimeContext`.
- The fixture browser entry uses optional actor-input attachment runtime only
  for smoke, not for the unit fixture baseline.
- The persisted layout smoke checks that `actorId`, `viewActorId`, and
  `frameActorId` do not enter persistence.
- Browser dev logs in the current in-app session contain older entries from
  other tabs, so the authoritative smoke evidence is the structured DOM/action
  result data. A future read-only actor-input telemetry hook can make hit logs
  cleaner.

## Remaining Before Phase 3C

- Run full workspace gates before the Phase 3B commit.
- Phase 3C should start with package scaffold and move pure model first.
- Do not move product-specific adapters into the new package.

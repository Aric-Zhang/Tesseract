# Project Prism Phase 3A Acceptance Report

Status: complete.

Phase 3A moved generic UI framework candidates away from app-local scene state,
runtime scheduling, and app-root component-definition installation. This closes
the old `ui-state-binding-debt` and `component-definition-installer-debt`
blockers in the generated boundary facts. `ui-framework` is now marked
`deferred` for Phase 3B/3C rather than blocked by those two debts.

## Source Changes

- Scene-backed floating-window state registration moved to:
  `apps/wallpaper-tesseract/src/editor/adapters/floating-window-scene-state-adapter.ts`.
- `window-runtime/index.ts` no longer exports the scene-backed
  `registerFloatingWindowParameters` adapter.
- UI scheduler ports were added in `window-runtime/ui-scheduler.ts`.
- App runtime scheduling is bridged through
  `apps/wallpaper-tesseract/src/app/adapters/ui-scheduler-runtime-adapter.ts`.
- Generic menu/workspace installers use `UiActorContext` / UI layout state
  ports instead of app feature context or `SceneParameterStore`.
- Central app `component-definitions.ts` was deleted.
- `actor-core` now owns the generic `installComponentDefinition` helper.
- Feature/domain component-definition installers import the helper from
  `actor-runtime`/`actor-core`, not from app root.

## Boundary Results

The generated boundary facts were updated:

- `ui-framework` target status: `deferred`.
- Removed blockers:
  - `ui-state-binding-debt`;
  - `component-definition-installer-debt`.
- Remaining Phase 3 work is now about product-free fixture proof, extraction,
  and app parity, not these two staging debts.

Refreshed artifacts:

- `temp/project-prism-phase-0-boundary-report.md`
- `temp/project-prism-phase-0b-boundary-summary.json`

## Verification

Targeted checks passed during the subphase:

```text
npm run test -w wallpaper-tesseract -- floating-window-state floating-window-component architecture-boundaries project-prism-boundary-report debug-window-parameters hierarchy-panel-state scene-window-state
npm run test -w wallpaper-tesseract -- window-workspace-controller window-workspace-layout-persistence-controller window-workspace-presentation-controller architecture-boundaries project-prism-boundary-report
npm run test -w wallpaper-tesseract -- floating-window-component app-menu-bar-component window-workspace-controller window-workspace-layout-persistence-controller window-workspace-presentation-controller architecture-boundaries project-prism-boundary-report
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report component-definitions floating-window-component app-menu-bar-component window-workspace-controller
npm run test -w actor-core
npm run typecheck -w wallpaper-tesseract
npm run typecheck -w actor-core
```

Full close gates passed:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

`npm run build` retains only the existing Vite chunk-size warning.

## Browser Smoke

Browser smoke passed:

- `temp/project-prism-phase-3a-browser-smoke-report.md`
- `temp/project-prism-phase-3a-browser-smoke-data.json`
- `temp/project-prism-phase-3a-browser-smoke.png`

Covered paths:

- Window menu open and focus-to-front.
- Floating Debug drag and resize.
- Debug close and Window menu restore.
- Scene fullscreen and restore.
- Reload after state changes.

Console errors: `0`.

## Next Phase 3 Step

Proceed to Phase 3B:

- build a product-free UI fixture using the same window/tab/dock/menu runtime;
- mount real DOM, real CSS, and actor-input bindings;
- prove root/floating tab, close, docking, menu, and persistence semantics
  without Scene, Debug, Hierarchy, Camera3, Tesseract, or editor product
  windows.

Do not extract a package until the Phase 3B fixture has both unit and browser
smoke evidence.

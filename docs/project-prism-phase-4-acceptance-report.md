# Project Prism Phase 4 Acceptance Report

Status: phase complete for runtime-core contracts and app-local adapter
prototypes. This is not production runtime ownership extraction.

## Completed Scope

- Created `packages/runtime-core` as a renderer-agnostic contract package.
- Added runtime ids, frame/update contracts, command/query contracts, world
  descriptors, camera descriptors, projection graph contracts, frame-source
  contracts, and a narrow runtime scheduler.
- Added headless graph and camera command fixtures proving multi-world,
  multi-camera, multi-frame-source usage without DOM, Three.js, editor UI, or
  actor-input.
- Split Project Prism boundary targets into:
  - `runtime-core-contracts`: allowed.
  - `runtime-production-ownership`: blocked.
- Added `runtime-core-candidate` package zone scanning for
  `packages/runtime-core/src`.
- Added app-local `runtime-adapter-debt` for Phase 4D prototypes. These
  adapters map current app facts to runtime-core contracts but do not own
  worlds, cameras, renderers, actors, or frame sources.
- Classified every public `scene-runtime` barrel export in
  `project-prism-state-domain-map.ts`.

## Explicit Non-Goals

- No production Scene rendering path was moved.
- No Three/WebGL resource ownership was moved into `runtime-core`.
- No Camera3/Tesseract runtime ownership was moved.
- No editor or UI framework state was absorbed into runtime-core.
- No adapter introduced a new production owner.

## Remaining Runtime Production Blockers

- `state-domain-debt`: `scene-runtime` still mixes runtime, editor, and UI
  state concepts. Phase 4E now documents the split target for each export.
- `runtime-ownership-debt`: Camera3, Tesseract4, and Scene render host still own
  runtime-like resources in app/editor feature areas.
- `runtime-adapter-debt`: Phase 4D adapters are temporary proof points and must
  be deleted or reduced in Phase 5.

## Verification

Required gates for this phase:

```text
npm run test -w runtime-core
npm run typecheck -w runtime-core
npm run build -w runtime-core
npm run test -w wallpaper-tesseract -- runtime-adapter project-prism-state-domain-map architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Browser smoke was not required for Phase 4 because production UI/rendering
behavior was not changed.

## Next Phase Direction

Phase 5 should move production runtime ownership deliberately:

- replace app-local `RuntimeObject` scheduling with runtime-owned work where
  appropriate;
- move Camera3 state into runtime camera contracts before editor gizmos command
  it;
- split Tesseract4 into runtime-world content and runtime-three renderable
  backend;
- make Scene View consume runtime frame sources without owning runtime
  resources;
- delete or shrink `runtime-adapter-debt` as each owner migrates.


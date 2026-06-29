# Project Canopy Gate 4 Runtime Consolidation Report

Date: 2026-06-30

Decision: keep the current runtime/math package shape. Do not create a runtime
merge implementation plan.

Project Canopy is complete after this decision. The remaining runtime/math
packages are not accidental micro-packages; they still protect distinct
ownership boundaries.

## Package Inventory

| Package | Role | Workspace deps | Peer deps | Source files | Source tests | `tests/` files |
| --- | --- | --- | --- | ---: | ---: | ---: |
| `runtime-core` | Renderer-agnostic runtime contracts | none | none | 18 | 8 | 0 |
| `runtime-three` | Three/WebGL backend for runtime-core | `four-camera`, `four-camera-three`, `runtime-core` | none | 13 | 2 | 0 |
| `wallpaper-runtime` | Wallpaper product runtime owner | `actor-system`, `four-camera`, `four-rotation`, `runtime-core`, `runtime-three` | none | 23 | 7 | 0 |
| `four-rotation` | Pure 4D rotation math | none | none | 7 | 0 | 4 |
| `four-camera` | 4D camera/projection model | `four-rotation` | none | 9 | 0 | 7 |
| `four-camera-three` | Three bridge for the 4D camera model | `four-camera` | `three` | 2 | 0 | 1 |

All six packages expose only their root package export today. No new umbrella
runtime export is needed.

## Production Importers

Production-only data excludes tests, docs, dist output, and `src/test-support`.

| Target package | Production importers |
| --- | --- |
| `runtime-core` | app frame/scheduler/Scene binding code, editor Camera3/view state code, `runtime-three`, and `wallpaper-runtime` |
| `runtime-three` | `wallpaper-runtime` only |
| `wallpaper-runtime` | app composition and Scene integration only |
| `four-rotation` | `four-camera` and `wallpaper-runtime` Tesseract world |
| `four-camera` | `four-camera-three`, `runtime-three`, and `wallpaper-runtime` Tesseract world |
| `four-camera-three` | `runtime-three` line renderable |

The importer shape matches ownership: generic runtime contracts are reused by
multiple layers, Three backend is consumed by the product runtime, and product
runtime is consumed only by app composition / Scene integration.

## Production Co-Imports

Files importing more than one runtime/math package:

| File | Packages | Classification |
| --- | --- | --- |
| `apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts` | `runtime-core`, `wallpaper-runtime` | legitimate top-level app composition |
| `packages/runtime-three/src/runtime-three-line-renderable.ts` | `four-camera`, `four-camera-three`, `runtime-core` | legitimate backend bridge composition |
| `packages/wallpaper-runtime/src/camera3/camera3-motion-component.ts` | `runtime-core`, `runtime-three` | legitimate product runtime component using generic runtime contracts plus backend camera motion |
| `packages/wallpaper-runtime/src/scene/runtime-scene-frame-source.ts` | `runtime-core`, `runtime-three` | legitimate product runtime frame-source bridge |
| `packages/wallpaper-runtime/src/tesseract4/tesseract4-runtime-renderable.ts` | `runtime-core`, `runtime-three` | legitimate product runtime renderable bridge |
| `packages/wallpaper-runtime/src/tesseract4/tesseract4-runtime-world.ts` | `four-camera`, `four-rotation`, `runtime-core` | legitimate product runtime world model composition |

No production file shows broad accidental coupling across all runtime packages.
The few co-imports are owner or bridge points, not evidence for a package merge.

## Boundary Audit

Existing boundary tests already lock the important ownership lines:

- `runtime-core` is renderer-agnostic and editor/UI/product-free.
- `runtime-three` is editor/UI/app/product-runtime-free.
- `wallpaper-runtime` is independent from editor, UI, app composition, DOM
  ownership, and feature presentation code.
- `four-rotation` and `four-camera` are free of Three/UI/DOM/product runtime
  imports.
- `four-camera-three` stays a renderer bridge and does not import app/editor/UI
  or wallpaper runtime code.

`npm run test -w wallpaper-tesseract -- architecture-boundaries` passed with
these checks.

## Direct `wallpaper-runtime -> three` Dependency

Current direct `three` import sites:

| File | Import | Use | Decision |
| --- | --- | --- | --- |
| `packages/wallpaper-runtime/src/camera3/camera3-motion-component.ts` | `import type * as THREE from "three"` | exposes the backend camera object returned by `RuntimeThreeCameraMotionController` | keep |
| `packages/wallpaper-runtime/src/tesseract4/tesseract4-runtime-renderable.ts` | `import type * as THREE from "three"` | types the object host contract as `THREE.Object3D` for Three scene attachment | keep |

Both imports are type-only. They are acceptable because `wallpaper-runtime` is
already the product runtime owner for the current Three-backed Wallpaper Engine
demo and already depends on `runtime-three`. Moving these types today would add
an adapter/facade without deleting real ownership. If a future renderer backend
is added, revisit this as a renderer abstraction task, not as part of Canopy.

## Merge Candidate Decisions

### Candidate A: `runtime-core` + `runtime-three`

Rejected. `runtime-core` remains a clean no-Three contract package, while
`runtime-three` remains a backend implementation. Merging would make
renderer-agnostic consumers pay for backend dependencies and weaken a useful
boundary.

### Candidate B: `runtime-three` + `wallpaper-runtime`

Rejected. `wallpaper-runtime` still owns product concepts: Camera3 motion,
Tesseract4 runtime/renderable ownership, runtime Scene content, frame-source
registration, and Scene view registry. Merging would make the Three backend know
Wallpaper product semantics.

### Candidate C: `runtime-core` + `wallpaper-runtime`

Rejected. This would mix reusable runtime contracts with product runtime
ownership.

### Candidate D: `four-rotation` + `four-camera`

Rejected for now. `four-rotation` is a small but clean math package with
independent tests. `four-camera` uses it, but the separation remains
understandable and does not create meaningful implementation friction.

### Candidate E: `four-camera` + `four-camera-three`

Rejected. `four-camera` is still a renderer-agnostic camera/projection model,
and `four-camera-three` is the Three bridge. Merging would force Three.js into
model-only consumers.

## Follow-Ups

No Canopy-blocking follow-up is required.

Non-blocking watch item:

- If future renderer backends are planned, reconsider the two type-only
  `wallpaper-runtime -> three` contracts as part of a renderer abstraction
  design. Do not introduce an adapter now.

## Validation

Executed during Gate 4:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run test
npm run typecheck
npm run build
git diff --check
```

`npm run build` retains the existing Vite chunk size warning.

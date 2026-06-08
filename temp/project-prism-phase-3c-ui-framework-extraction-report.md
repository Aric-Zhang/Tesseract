# Project Prism Phase 3C UI Framework Extraction Report

Date: 2026-06-08

Status: complete for the first reusable UI framework package baseline.

## Extracted Package

`packages/ui-framework` now owns the product-agnostic window, tab, dock, menu, and workspace layout contracts that were previously app-local.

Extracted areas:

- model: view identity/key, menu item model, floating window state, dock target resolution, dock surface model, dock tree, tab drag state, workspace layout, layout persistence.
- ports: UI geometry, layout command/state ports, scheduler, actor context, content host, frame port/registry, dock target region source, view factory registry.
- chrome: frame surface, tab chrome, hit data, tab actions, dock preview component.
- services: frame lifecycle controller, workspace controller, workspace presentation controller, workspace layout persistence controller, focus command port, stack priority port, view catalog.

## App-Local Adapters Intentionally Kept

The wallpaper app still owns actor/component adapters that bind generic UI behavior to app-specific state, actor input, and product features:

- `FloatingWindowComponent`
- `WorkspaceRootDockFrameComponent`
- App Menu actor/component definitions
- Scene-backed floating window state adapter
- product view factories and installers

These are not reusable UI model facts. They remain in the app until later phases split editor/runtime/product composition.

## Boundary Result

The generated Project Prism facts now mark `ui-framework` as `allowed`. The old dock-surface, UI state binding, and component definition installer blockers no longer block the reusable UI package baseline.

Remaining blockers belong to later phases:

- runtime/state ownership split
- editor/runtime feature split
- wallpaper app composition thinning

## Verification

Completed during Phase 3C/3D:

- `npm run test -w ui-framework`
- `npm run typecheck -w ui-framework`
- `npm run build -w ui-framework`
- `npm run test -w wallpaper-tesseract`
- `npm run typecheck -w wallpaper-tesseract`
- `npm run build -w wallpaper-tesseract`
- `npm run test`
- `npm run typecheck`
- `npm run build`

Browser parity evidence:

- `temp/project-prism-phase-3d-browser-smoke.json`
- `temp/project-prism-phase-3d-responsive-smoke.json`

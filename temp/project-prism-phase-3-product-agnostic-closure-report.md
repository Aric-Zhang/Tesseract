# Project Prism Phase 3 Product-Agnostic Closure

Date: 2026-06-09

## Scope

This closure follows the Phase 3 acceptance review after the self-dock bugfix
was committed separately. It tightens two remaining UI framework seams:

- product-specific view semantics leaking into public `ui-framework` models;
- optional self-dock preview facts that could let preview and commit disagree.

## Changes

- `WindowViewKey` and `WindowViewTypeKey` are now product-agnostic string
  contracts. The public UI framework model no longer enumerates `scene`,
  `debug`, or `hierarchy`.
- `WindowViewFullscreenReason` no longer exposes `scene-toggle`; the UI
  framework only knows generic `programmatic` and `toggle` reasons.
- `WindowDockTargetRegion.targetTabsetTabs` is required.
- `ResolveWindowDockPreviewOptions` now distinguishes no-source preview from
  source-aware preview. Source-aware preview requires `sourceViewActorId`, and
  same-frame preview fails closed when source tabset facts are incomplete.
- Architecture boundary tests now lock both rules:
  product-agnostic public window identity models and explicit dock preview
  tabset facts.

## Verification

- `npm run test -w ui-framework -- window-dock-targets window-tab-drag-session window-dock-preview-component window-view-identity`
- `npm run typecheck -w ui-framework`
- `npm run test -w ui-framework`
- `npm run build -w ui-framework`
- `npm run test -w wallpaper-tesseract -- architecture-boundaries`
- `npm run test -w wallpaper-tesseract -- architecture-boundaries ui-framework-fixture floating-window-component workspace-root-dock-frame-component`
- `npm run typecheck -w wallpaper-tesseract`
- `npm run build -w wallpaper-tesseract`

All checks passed during the closure pass. The wallpaper build retains the
existing Vite chunk size warning.

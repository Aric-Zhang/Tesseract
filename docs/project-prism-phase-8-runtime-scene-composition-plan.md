# Project Prism Phase 8 Runtime Scene Composition And Product Policy Split Plan

Status: next active plan after Phase 7 closure, drafted 2026-06-13.

Phase 7 accepted the deletion-first runtime-owner/app-bootstrap cleanup. The
app no longer owns the old `app-runtime`, `runtime/ports`, `update-runtime`,
old `features/camera3`, old `tesseract4`, mixed Scene content installer, or
app-local actor-id/bootstrap policy files under `src/app`.

Phase 8 starts from the smaller debt that remains visible in boundary facts. It
must not recreate a broad product facade, a compatibility barrel, or a second
runtime/editor truth path.

## Goal

Split the remaining product feature policy and Scene runtime composition so:

- Wallpaper app bootstrap stays thin and only wires shell/environment services.
- Product feature policy is owned by smaller feature/runtime/editor owners
  instead of a central product mega-installer.
- Scene runtime session/content and renderable registration move toward a
  runtime owner without editor owning runtime resources.
- Component definition installation is owned by packages/features instead of a
  central app-local aggregator.
- Browser smoke evidence for UI/runtime behavior is based on fresh actions, not
  only prior structural evidence.

## Non-Negotiables

- No compatibility facade wrapping `install-wallpaper-product-features.ts`.
- No duplicate actor id, view identity, window placement, or runtime Scene
  owner.
- No editor-owned runtime world, camera, render output, or Scene session.
- No broad casts or fake test ports to preserve old installer shapes.
- No package extraction that simply moves the same mixed responsibilities into
  a new directory.
- Delete old owners in the same slice that introduces the replacement owner.

## Entry Gate

Before implementation:

```text
git status --short
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-7-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run test -w wallpaper-tesseract -- runtime-scene-session runtime-work-attachment-runtime camera3-components tesseract4 install-scene-view-feature component-definitions workspace-mode architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

If this gate fails, fix the real owner or test drift. Do not add compatibility
aliases to make Phase 8 easier to start.

## Step 1: Shrink Product Feature Policy

Target:

```text
apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
```

Work:

- Identify facts that already have a clearer owner:
  - default window/view descriptors;
  - floating frame policies;
  - concrete actor ids;
  - hierarchy metadata;
  - debug log sink binding;
  - app menu command registration;
  - workspace-mode installation.
- Move each fact to its feature/runtime/editor owner only when doing so deletes
  central policy or removes duplication.
- Keep product-level composition only for ordering owner-owned installers.

Exit:

- Product feature installer no longer centralizes unrelated policy maps.
- Boundary facts either remove `wallpaper-app-concrete-feature-policy` or shrink
  it to a smaller current file list.
- `create-wallpaper-app.ts` remains free of concrete feature ids/policies.

## Step 2: Split Component Definition Installation By Owner

Target:

```text
apps/wallpaper-tesseract/src/features/install-wallpaper-component-definitions.ts
apps/wallpaper-tesseract/src/gizmo-runtime/install-component-definitions.ts
```

Work:

- Move install calls to package/feature installers where the component
  definitions live.
- If a definition is purely product binding, keep a small product binding owner
  rather than a central all-feature installer.
- Delete the app-local central installer when it no longer removes meaningful
  duplication.

Exit:

- No single app-local installer owns unrelated editor, runtime, ui-framework,
  app-menu, gizmo, and product definitions.
- `gizmo-runtime-definition-installer` is removed or narrowed in boundary facts.

## Step 3: Reduce Scene Feature Cross-Domain Assembly

Target:

```text
apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
apps/wallpaper-tesseract/src/features/scene/renderable-scene-view.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-session.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts
```

Work:

- Separate editor Scene actor presentation creation from runtime Scene
  session/content creation.
- Keep Camera3 gizmo presentation in editor, but ensure runtime Camera3 motion
  ownership stays in runtime.
- Move renderable frame-source registration toward runtime-owned Scene session
  contracts if it reduces the feature-level mixed owner.
- Delete old assembly code as soon as a narrower owner replaces it.

Exit:

- `install-scene-view-feature.ts` no longer simultaneously creates editor
  actors, runtime session, runtime content, Camera3 gizmo, and renderable bridge.
- Runtime Scene owner remains editor/UI/app-composition independent.
- `scene-runtime-composition-feature-installer` boundary blocker is removed or
  narrowed to current reality.

## Step 4: Resolve Workspace Mode Ownership

Target:

```text
apps/wallpaper-tesseract/src/features/workspace-mode.ts
```

Work:

- Decide whether workspace-mode is:
  - editor presentation state coordination;
  - ui-framework workspace presentation policy;
  - or a product command module.
- Move or delete the current controller accordingly.
- Do not create a second window placement truth.

Exit:

- Workspace mode no longer lives as ambiguous app-composition policy.
- Fullscreen/run mode behavior remains on window lifecycle/presentation ports.

## Step 5: Fresh Browser Smoke Evidence

Purpose: strengthen the evidence gap called out in the Phase 7 review.

Required fresh browser actions:

- App boot with zero console errors.
- Window menu opens and hover highlight follows the actual hovered row.
- Debug/Scene repeated dock path succeeds visually.
- Scene fullscreen enter/exit restores graph/DOM/input parity.
- Narrow/mobile viewport keeps Window menu, Scene view, Tesseract, and Camera3
  gizmo measurable.
- Camera3 gizmo interaction changes camera behavior.

Store evidence under:

```text
temp/project-prism-phase-8-smoke-data.json
temp/project-prism-phase-8-smoke-report.md
```

Validate:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

## Final Gate

Phase 8 can close when:

- Phase 7 residual blockers are removed or narrowed to smaller current files.
- Product policy, component definition installation, Scene runtime composition,
  and workspace-mode ownership no longer sit in one broad app-local layer.
- No old owner is left idle after replacement.
- Root validation passes:

```text
npm run test
npm run typecheck
npm run build
```

- Fresh Phase 8 smoke evidence validates.

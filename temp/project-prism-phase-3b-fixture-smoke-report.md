# Project Prism Phase 3B Fixture Browser Smoke

Date: 2026-06-08
URL: http://127.0.0.1:5184/ui-framework-fixture.html
Viewport: 594 x 698
Dev server: Vite on 127.0.0.1:5184, PID 24972

## Result

Passed: true
Validation errors: 0

Artifacts:

- Structured data: temp/project-prism-phase-3b-fixture-smoke-data.json
- Screenshot: temp/project-prism-phase-3b-fixture-smoke.png

## Covered Flow

1. Loaded the product-free UI framework fixture through a dedicated static HTML entry.
2. Verified root workspace frame, floating frame, app menu, and generic fixture views render without Scene, Camera3, Tesseract, Debug, Hierarchy, or Inspector feature installers.
3. Opened the Window menu and used the generic `new-instance` action to create a second `fixture-panel` instance.
4. Dragged the new floating panel tab into the root tabbar, producing a root two-tab layout.
5. Clicked the inactive root tab and verified the active tab class changed.
6. Verified content deck semantics: exactly one root content view is visible; inactive content is `hidden` and `display: none`.
7. Verified tab close geometry: the close rect stays inside the tab rect.
8. Closed the inactive root tab and verified no stale hidden tab remains visible or live in the root tab strip.
9. Reloaded without reset and verified persisted layout hydrates from logical identities only.

## Persistence Check

The persisted payload is version 2 and contains `typeKey` / `instanceId` descriptors. The smoke validation asserts the persisted JSON does not contain `actorId`, `viewActorId`, or `frameActorId`.

## Notes

The fixture uses a product-free browser storage adapter that mirrors the last stored payload onto `document.documentElement.dataset` only for smoke telemetry. This mirror is not part of the UI runtime behavior.

Browser dev logs in this in-app session included older Vite/gizmo entries from previous tabs, so this report treats DOM top-stack samples and action results as the authoritative evidence. A future app-local read-only actor-input telemetry hook would make this part more machine-checkable.

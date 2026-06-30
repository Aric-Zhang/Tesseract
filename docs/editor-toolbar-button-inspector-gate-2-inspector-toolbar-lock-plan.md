# Editor Toolbar Gate 2: Inspector Toolbar Lock Plan

Status: completed
Date: 2026-06-30
Parent plan: `docs/editor-toolbar-button-inspector-lock-plan.md`
Depends on: completed Gate 1

## Goal

Adopt the Gate 1 `ui-framework/controls` toolbar/button/toggle controls in the
real Inspector window. The Inspector should become an Arbor actor subtree:

```text
Inspector View Actor
  UiElementComponent(className: "inspector-window__content")
  UiLayoutHostComponent
  InspectorRootContentComponent  owns WindowRegisteredContent lifecycle

  Inspector Toolbar Actor
    UiElementComponent(className: "inspector-window__toolbar")
    UiLayoutItemComponent(slot: "top")
    ToolbarComponent

    Inspector Lock Button Actor
      UiElementComponent(tagName: "button")
      ToggleButtonComponent

  Inspector Body Actor
    UiElementComponent(className: "inspector-window__body")
    UiLayoutItemComponent(slot: "fill", stretch: "both")
    InspectorContentComponent
```

This gate must delete the current shape where `InspectorContentComponent` both
owns `WindowRegisteredContent` and writes inspected text directly into the root
window content element.

## Entry Gate

1. Gate 1 must be complete and validated.
2. Worktree may contain Gate 1 changes, but no unrelated implementation work
   should be edited.
3. Run baseline:

```text
npm run test -w editor -- inspector
npm run test -w ui-framework -- button toggle toolbar
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Stop if baseline fails for reasons unrelated to Gate 2.

## Non-Negotiables

- Window content registration lifecycle must belong to an actor component:
  `InspectorRootContentComponent`.
- Do not call `contentRegistration.registerContent(...)` naked from
  `createInspectorViewActor(...)`.
- `InspectorContentComponent` becomes body display/follow-lock logic only. It
  must not implement `WindowRegisteredContent` after this gate.
- The lock control is a `ToggleButtonComponent` child actor inside a
  `ToolbarComponent`; no Inspector-specific DOM button implementation.
- Pointer activation uses actor-input through `ToggleButtonComponent`.
- Keyboard activation uses Gate 1 generic button behavior.
- Inspector lock state truth remains `InspectorContentComponent.locked`.
  `ToggleButtonComponent.pressed` mirrors it; it is not a second lock source.
- No global icon registry and no product icons in `ui-framework`.
- No direct import of Hierarchy internals or the `Selection` facade from
  Inspector content.

## Step 1: Add Inspector Root Content Component

Create:

```text
packages/editor/src/inspector/inspector-root-content-component.ts
packages/editor/src/inspector/inspector-root-content-definition.ts
packages/editor/src/inspector/inspector-root-content-component.test.ts
```

Contract:

- requires same-actor `UiElementComponent`;
- accepts `contentId` and `WindowContentRegistrationPort`;
- registers `uiElement.element` as the window content;
- implements `WindowRegisteredContent`;
- owns registration disposal;
- forwards `setInteractable(...)` and `subscribeLayoutCommit(...)`;
- does not render Inspector body text;
- does not know about selection, actor display source, toolbar, or lock state.

Tests:

- registers the same root `UiElementComponent.element`;
- dispose clears the registration;
- repeated dispose is safe;
- forwards interactable and layout commit subscription;
- component has no selection/display/toolbar imports.

## Step 2: Slim InspectorContentComponent To Body Display

Update:

```text
packages/editor/src/inspector/inspector-content-component.ts
packages/editor/src/inspector/inspector-content-definition.ts
packages/editor/src/inspector/inspector-content-component.test.ts
```

Remove from `InspectorContentComponent`:

- `WindowRegisteredContent` implementation;
- `WindowContentRegistrationPort` option;
- `contentId` option;
- registration storage;
- `contentId`, `interactable`, `setInteractable`, and
  `subscribeLayoutCommit` forwarding methods.

Keep:

- same-actor `UiElementComponent`;
- `StateObserverResponder`;
- `locked` and `inspectedActorId` local presentation state;
- selection follow behavior via `selection.snapshot`;
- deterministic empty/missing/inspecting body text.

Add a narrow lock-state notification option as a required synchronization
contract for toolbar visuals:

```text
InspectorLockStateSink {
  inspectorLockStateChanged(locked: boolean): void
}
```

Rules:

- The sink is notification only; it does not own lock state.
- `setLocked(...)` remains the only body component mutation path for lock
  state.
- Every lock state mutation path, including direct component tests,
  programmatic calls, and toggle activation, must notify this sink after the
  body truth changes.
- The sink synchronizes the toolbar `ToggleButtonComponent` pressed state,
  icon, label, and title from the body truth. It must not mutate selection or
  decide lock state independently.

Tests:

- body component renders current active selection;
- no-selection and missing-actor states still work;
- unlocked follows selection changes;
- locked ignores selection changes;
- unlocking catches up to current selection;
- explicit `inspectActor(...)` still does not mutate editor selection;
- component no longer registers window content.
- direct `setLocked(true/false)` updates the toolbar toggle through the sink in
  integration/factory tests.

## Step 3: Add Inspector Lock Icon Descriptor Helper

Create only Editor-local icon data:

```text
packages/editor/src/inspector/inspector-lock-icons.ts
```

Contract:

- exports generic `UiButtonIconDescriptor` values for locked/unlocked state;
- no global icon registry;
- no `ui-framework` import from Editor into framework internals, only
  `ui-framework/controls` model types;
- icons should be simple code-drawn SVG path descriptors.

Tests can assert only that descriptors are stable and product-owned; avoid
snapshotting large SVG strings unless useful.

## Step 4: Refactor Inspector View Actor Factory

Update:

```text
packages/editor/src/inspector/inspector-view-actor-factory.ts
packages/editor/src/inspector/inspector-view-actor-factory.test.ts
```

New construction order:

1. Create Inspector View root actor under the parent frame actor.
2. Add root `UiElementComponent` with class `inspector-window__content`.
3. Add `UiLayoutHostComponent` to the root actor.
4. Add `InspectorRootContentComponent` to the root actor.
5. Create toolbar child actor.
6. Add toolbar `UiElementComponent`, `UiLayoutItemComponent(slot: "top")`, and
   `ToolbarComponent`.
7. Create body child actor.
8. Add body `UiElementComponent`, `UiLayoutItemComponent(slot: "fill",
   stretch: "both")`, and `InspectorContentComponent`.
   `InspectorContentComponent` must be installed through its definition on the
   body actor, and that definition must require/reuse
   `stateObserverBindingComponentType` on the body actor. Selection snapshot
   delivery must be proven against the body actor after this migration.
9. Create lock button actor under the toolbar actor.
10. Add button `UiElementComponent` with `tagName: "button"`.
11. Add `ToggleButtonComponent` with:
    - descriptor id such as `inspector-lock-toggle`;
    - `variant: "toolbar"`;
    - accessible label/title that reflects lock state;
    - locked/unlocked Editor icon descriptors;
    - initial pressed state from `InspectorContentComponent.locked`;
    - activation sink that calls `InspectorContentComponent.setLocked(...)` and
      then synchronizes `ToggleButtonComponent.setPressed(...)` from the body
      component truth.

Return type:

- `RegisteredInspectorViewActor` should track the root content component as the
  `WindowRegisteredContent` returned to window runtime.
- If callers need body access in tests, expose a named field on the handle such
  as `inspectorContent`, not by making the body component masquerade as window
  content.

Failure cleanup:

- Any actor created in this factory must be destroyed if later component
  creation fails.
- Do not introduce a service container or hidden global registry.

Tests:

- root actor is registered as window content;
- root has toolbar and body child actors;
- toolbar has lock button child actor;
- body element receives inspected text;
- lock toggle initial pressed state mirrors body locked state;
- actor-input toggle activation locks/unlocks body component;
- direct `InspectorContentComponent.setLocked(...)` synchronizes the toolbar
  toggle pressed/icon/label/title state;
- changing selection while locked keeps body text;
- unlocking catches up to current selection;
- selection snapshot state changes reach the body actor component through
  `stateObserverBindingComponentType`;
- content registration is disposed when the registered handle is disposed;
- creation failure after root registration or after any child actor creation
  disposes the root content registration and destroys already-created
  Inspector child actors;
- no naked content registration remains in the factory.

## Step 5: Component Definitions And Exports

Update:

```text
packages/editor/src/inspector/install-component-definitions.ts
packages/editor/src/inspector/index.ts
```

Register:

- `inspectorRootContentComponentDefinition`;
- existing slimmed `inspectorContentComponentDefinition`.

Export only the public/editor-test surface that is needed:

- root component type/options if tests or app need them;
- body content component as existing;
- icon helper only if it is intentionally reusable inside editor.

Do not expose a broad Inspector toolbar facade.

## Step 6: CSS Cleanup

Update:

```text
packages/editor/src/inspector/inspector.css
```

Expected style ownership:

- `.inspector-window__content`: root layout host container, full size, no body
  padding that would push toolbar/body incorrectly.
- `.inspector-window__toolbar`: optional editor-specific spacing only if
  generic `.ui-toolbar` is insufficient.
- `.inspector-window__body`: previous Inspector body padding/text style.

Rules:

- Button/toggle/toolbar visual state comes from `ui-framework` CSS.
- Do not add Inspector-specific button pressed/disabled styling.
- Do not add raw colors if existing theme tokens cover the style.

## Step 7: Boundary Tests And Grep Gates

Update:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Add invariants:

- `InspectorContentComponent` production source does not import or mention
  `WindowRegisteredContent`, `WindowContentRegistrationPort`,
  `contentRegistration`, or `registerContent`.
- `InspectorRootContentComponent` is the only Inspector production source that
  calls `registerContent`.
- `createInspectorViewActor(...)` does not call `registerContent` directly.
- Inspector production source does not use DOM `click` / `.onclick`.
- Inspector production source does not import `Selection` facade or Hierarchy
  internals.
- Inspector lock uses `ToggleButtonComponent` from `ui-framework/controls`.

Manual grep commands:

```text
rg -n "registerContent|WindowRegisteredContent|WindowContentRegistrationPort" packages/editor/src/inspector -g "*.ts" -g "!*.test.ts" -g "!inspector-root-content-*"
rg -n "addEventListener\\([\"']click|\\.onclick" packages/editor/src/inspector -g "*.ts" -g "!*.test.ts"
rg -n "\\bSelection\\b|from .*hierarchy|\\.\\./hierarchy" packages/editor/src/inspector -g "*.ts" -g "!*.test.ts"
rg -n "textContent\\s*=\\s*`?Inspecting|textContent\\s*=\\s*[\"']No actor selected" packages/editor/src/inspector -g "*.ts" -g "!*.test.ts"
```

Expected:

- first grep has no production hits outside the root content component;
- no DOM click shortcut;
- no Hierarchy/Selection facade dependency;
- inspected text rendering is only in the body component.

## Step 8: Browser Smoke

Run Vite and produce fresh smoke evidence under `temp/`.

Minimum browser flow:

1. Open app.
2. Ensure Hierarchy and at least one Inspector are visible.
3. Select `Scene View` in Hierarchy.
4. Verify unlocked Inspector body shows `Inspecting: Scene View`.
5. Activate Inspector lock toggle.
6. Verify lock button has pressed state (`aria-pressed="true"` or
   `data-ui-button-pressed="true"`).
7. Select `Camera3` in Hierarchy.
8. Verify locked Inspector still shows Scene.
9. Activate lock toggle again.
10. Verify Inspector catches up to Camera3.
11. If two Inspectors are visible, verify one locked and one unlocked can
    diverge.
12. Verify Window menu, Debug diagnostics, tab close, and dock preview still
    work at a smoke level.
13. Console errors must be 0.

Evidence files:

```text
temp/editor-toolbar-gate-2-inspector-lock-smoke-data.json
temp/editor-toolbar-gate-2-inspector-lock-smoke-report.md
```

## Step 9: Validation Matrix

Run:

```text
npm run test -w editor -- inspector
npm run typecheck -w editor
npm run build -w editor
npm run test -w ui-framework -- button toggle toolbar
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

If app smoke wiring or shared package exports changed, broaden to:

```text
npm run test
npm run typecheck
npm run build
```

`wallpaper-tesseract` build may retain the known Vite chunk size warning.

## Stop Conditions

Stop and revise the plan if:

- Inspector root content registration cannot be represented as an actor
  component without changing window runtime contracts.
- The lock toggle needs a second lock state outside
  `InspectorContentComponent.locked`.
- Toolbar adoption requires `WindowFrameSurfaceComponent` or window lifecycle
  special casing.
- Generic button/toggle APIs need product-specific Inspector concepts.
- The browser smoke shows actor-input priority regressions around tabs, menu,
  or dock preview.

## Acceptance Criteria

- Inspector window content registration is owned by an Inspector root component.
- Inspector body display is separate from the root content registration owner.
- Inspector has a visible toolbar child actor and lock toggle child actor.
- Lock toggle is a `ToggleButtonComponent`; it uses generic button/toggle
  behavior and Editor-owned icon descriptors.
- Locked Inspector does not follow selection changes; unlocked Inspector does.
- No old root text rendering / naked registration / DOM click shortcut remains.
- Gate 2 smoke and validation matrix pass.

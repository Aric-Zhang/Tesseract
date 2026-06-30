# Editor Toolbar Gate 3: Closure And Public Surface Audit Plan

Status: completed
Date: 2026-06-30
Parent plan: `docs/editor-toolbar-button-inspector-lock-plan.md`
Depends on: completed Gate 1 and Gate 2

## Goal

Close the Editor toolbar / Inspector lock work without adding new product
behavior. Gate 3 verifies that Gate 1 and Gate 2 did not leave old Inspector
window-registration paths, generic button escape hatches, stale selectors,
unwanted public exports, or unverified browser behavior.

This is a closure gate. It should primarily delete, narrow, verify, and
document. Do not add another UI abstraction, compatibility alias, or fallback
path in this gate.

## Entry Gate

1. Gate 1 and Gate 2 implementation must be complete.
2. Review `git status --short`.
3. If Gate 1 and Gate 2 are still uncommitted, either create a checkpoint or
   explicitly record that Gate 3 is being run on the combined uncommitted
   toolbar/Inspector changes.
4. Baseline targeted validation must pass before additional cleanup:

```text
npm run test -w ui-framework -- button toggle toolbar fullscreenable-view
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Stop and amend the plan if any failure indicates that Gate 1 or Gate 2 needs
new design work rather than cleanup.

## Non-Negotiables

- No new UI behavior.
- No compatibility barrel or alias for old Inspector content registration.
- No public export of internal Inspector component classes or definitions
  unless a production caller outside `packages/editor/src/inspector` proves it
  is needed.
- No public export of Inspector actor factory handles or component-definition
  installers from `packages/editor/src/inspector/index.ts` unless a production
  caller outside the Inspector owner proves it is required. Internal
  `packages/editor/src/install-component-definitions.ts` should import the
  Inspector installer directly from `./inspector/install-component-definitions`
  instead of keeping it in the feature public barrel.
- No public export of `UiButtonRenderer`; Button/Toggle/Fullscreen may use it
  only through package-internal relative imports.
- No DOM `click` shortcut for button, toggle, toolbar, or Inspector lock.
- No Inspector/product terms in `packages/ui-framework/src/ui/button` or
  `packages/ui-framework/src/ui/toolbar`.
- No root `ui-framework` production import.
- Temporary smoke data belongs under `temp/`; long-term project status belongs
  in `docs/current-project-progress.md`.

## Step 1: Public Surface Audit

Audit and narrow these public surfaces:

```text
packages/editor/src/inspector/index.ts
packages/ui-framework/src/controls/index.ts
packages/ui-framework/src/ui/button/index.ts
packages/ui-framework/src/ui/toolbar/index.ts
```

Required checks:

- `packages/editor/src/inspector/index.ts` exports only feature installer,
  workspace policy, and narrow display/selection source types needed by
  production callers outside `packages/editor/src/inspector`.
- It must not export:
  - `InspectorContentComponent`;
  - `InspectorRootContentComponent`;
  - `inspectorContentComponentType`;
  - `inspectorRootContentComponentType`;
  - `inspectorContentComponentDefinition`;
  - `inspectorRootContentComponentDefinition`;
  - `createInspectorViewActor`;
  - `RegisteredInspectorViewActor`;
  - `InspectorViewActorOptions`;
  - `installInspectorComponentDefinitions`.
- `packages/editor/src/install-component-definitions.ts` must import
  `installInspectorComponentDefinitions` directly from
  `./inspector/install-component-definitions`, not through
  `./inspector`.
- Public barrel types must not indirectly expose internal Inspector component
  classes through handle types. In particular, no public export should expose
  `RegisteredActor<InspectorRootContentComponent>` or an
  `inspectorContent: InspectorContentComponent` field.
- `ui-framework/controls` exports reusable public controls only. It must not
  export `UiButtonRenderer`.
- `ui/button/index.ts` and `ui/toolbar/index.ts` expose component/model/
  definition types needed by consumers, not package-private render helpers.

Boundary tests:

- `architecture-boundaries.test.ts` must lock all rules above, including the
  indirect leak cases (`RegisteredInspectorViewActor`,
  `createInspectorViewActor`, `InspectorViewActorOptions`, and
  `installInspectorComponentDefinitions`).

Manual grep:

```text
rg -n "Inspector(?:Root)?ContentComponent|inspector(?:Root)?ContentComponent(?:Type|Definition)" packages/editor/src/inspector/index.ts
rg -n "createInspectorViewActor|RegisteredInspectorViewActor|InspectorViewActorOptions|installInspectorComponentDefinitions" packages/editor/src/inspector/index.ts
rg -n "from \"./inspector\"|from './inspector'" packages/editor/src/install-component-definitions.ts
rg -n "UiButtonRenderer" packages/ui-framework/src/controls packages/ui-framework/src/ui/button/index.ts
```

Expected: no matches.

## Step 2: Delete Stale Old-Path Artifacts

Audit for stale implementation traces from the pre-Gate-2 Inspector shape.

Production grep:

```text
rg -n "registerContent|WindowRegisteredContent|WindowContentRegistrationPort" packages/editor/src/inspector -g "*.ts" -g "!*.test.ts" -g "!inspector-root-content-*"
rg -n "contentRegistration|contentId" packages/editor/src/inspector/inspector-content-* -g "*.ts" -g "!*.test.ts"
rg -n "textContent\\s*=\\s*`?Inspecting|textContent\\s*=\\s*[\"']No actor selected" packages/editor/src/inspector -g "*.ts" -g "!*.test.ts"
rg -n "addEventListener\\([\"']click|\\.onclick" packages/editor/src/inspector packages/ui-framework/src/ui/button packages/ui-framework/src/ui/toolbar -g "*.ts" -g "!*.test.ts"
```

Expected:

- only `InspectorRootContentComponent` owns window content registration;
- `InspectorContentComponent` has no registration options or window registered
  content methods;
- inspected body text rendering remains in `InspectorContentComponent` only;
- no DOM click shortcuts.

Delete any stale tests, fake helpers, comments, CSS selectors, or docs that
still describe the old single-component Inspector root as current behavior.

## Step 3: Style And Token Audit

Audit CSS touched by Gate 1/Gate 2:

```text
packages/ui-framework/src/ui/ui-framework-controls.css
packages/editor/src/inspector/inspector.css
packages/ui-framework/src/ui/theme/ui-theme-tokens.ts
```

Rules:

- `ui-framework` button/toolbar selectors are generic only.
- Inspector CSS may style Inspector layout/body spacing, but not generic button
  pressed/disabled state.
- Every `--ui-*` token reference must be backed by
  `ui-theme-tokens.ts` and the existing boundary token validator.
- No raw color/radius/font debt unless already allowlisted by architecture
  boundaries.

Run:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

## Step 4: Browser Smoke Evidence

Generate fresh Gate 3 browser evidence for the visible Inspector lock workflow.
Do not reuse Gate 2 evidence as closure proof. Use a Gate 3 evidence kind and
fresh timestamp so reviewers can tell the closure checklist was rerun after
public-surface cleanup.

Required flow:

1. Start from a reset layout.
2. Ensure Hierarchy and at least one Inspector are visible.
3. Select `Scene View` in Hierarchy.
4. Verify unlocked Inspector body shows `Inspecting: Scene View`.
5. Activate Inspector lock toggle.
6. Verify toggle pressed state is visible (`aria-pressed="true"` and
   `data-ui-button-pressed="true"`).
7. Select `Camera3` in Hierarchy.
8. Verify locked Inspector still shows Scene.
9. Unlock.
10. Verify Inspector catches up to Camera3.
11. Verify Window menu and Debug diagnostics still work at smoke level.
12. Console errors must be 0.

Expected evidence files:

```text
temp/editor-toolbar-gate-3-closure-smoke-data.json
temp/editor-toolbar-gate-3-closure-smoke-report.md
```

Required evidence fields:

- `kind: "editor-toolbar-gate-3-closure-smoke"`;
- `generatedAt` from the current run;
- `consoleErrors: []`;
- lock button before/after state including title, `aria-pressed`, and
  `data-ui-button-pressed`;
- locked body text remains `Inspecting: Scene View` after selecting Camera3;
- unlocked body text catches up to `Inspecting: Camera3`;
- Window menu still opens;
- Debug diagnostics still have visible rows.

Validation:

- If the smoke remains an inline one-off, the script must validate these fields
  before writing `passed: true`.
- If a stable contract is added later, it should validate the same fields and
  reject stale Gate 2 evidence by `kind`.

If the smoke script is kept as an inline one-off, do not move it into
`apps/wallpaper-tesseract/scripts`. If the workflow becomes a long-term
regression contract, add a reviewed stable runner and contract test instead of
leaving an active runner under `temp/`.

## Step 5: Final Validation Matrix

Run targeted checks:

```text
npm run test -w ui-framework -- button toggle toolbar fullscreenable-view
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor -- inspector
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Then run root checks because Gate 2 changed visible app UI composition:

```text
npm run test
npm run typecheck
npm run build
git diff --check
```

Expected:

- all tests/typechecks/builds pass;
- `npm run build` may keep the existing Vite chunk size warning only;
- `git diff --check` has no whitespace errors, only existing CRLF warnings if
  the worktree already shows them.

## Step 6: Documentation And Checkpoint

Update:

```text
docs/current-project-progress.md
docs/editor-toolbar-button-inspector-lock-plan.md
docs/editor-toolbar-button-inspector-gate-3-closure-plan.md
```

Required status:

- parent plan status reflects the completed toolbar/Inspector lock work;
- Gate 1, Gate 2, and Gate 3 are clearly marked complete when validation
  passes;
- smoke evidence paths are recorded;
- no active blocker remains in `docs/known-defects-and-todos.md` for this work.

After validation, commit a clean checkpoint if requested or if the next phase
will continue in the same branch.

## Stop Conditions

Stop and write an amendment if:

- public API narrowing breaks a production external caller and that caller
  truly needs a public component class;
- smoke reveals lock toggle visual state and `InspectorContentComponent.locked`
  can diverge;
- cleanup discovers a second Inspector content registration path;
- toolbar/button cleanup requires redesigning `ui-framework/controls` public
  API;
- root validation fails for behavior outside the touched subsystem.

## Acceptance Criteria

- Gate 1 and Gate 2 behavior remains verified.
- Internal Inspector root/body component classes and definitions do not leak
  through the public `inspector/index.ts` barrel.
- `UiButtonRenderer` remains package-private.
- Old Inspector single-component window-registration path is deleted.
- Visible Inspector lock smoke passes with fresh evidence.
- Root `test`, `typecheck`, and `build` pass.

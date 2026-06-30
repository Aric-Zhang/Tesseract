# Editor Inspector Component Details Gate 0: Interaction Contract Plan

Status: planned

Last updated: 2026-07-01

## Purpose

Lock the architecture contract before implementing Component sections,
read-only property rows, or editable property controls.

Gate 0 is intentionally a guardrail gate. It should add executable boundary
tests and update active documentation, but it must not implement Component row
rendering, descriptor registration, NumberField, Camera FOV editing, or a shared
frame-command batching primitive.

## Parent Plan

This gate belongs to:

```text
docs/editor-inspector-component-details-plan.md
```

The parent plan's required interaction shape is:

```text
Actor Input -> Editor-owned interaction controller -> frameUpdateAttachment refresh
```

## Current Facts To Preserve

- `actor-system/core` owns generic actors, components, definitions, and
  attachment plumbing. It must not know UI/DOM/Inspector/update hook semantics.
- `ui-framework` owns `frameUpdateAttachment`,
  `FrameUpdateAttachmentRuntime`, `UiFrameScheduler`-style frame update
  behavior, and reusable controls.
- `packages/editor/src/inspector` owns Inspector feature behavior and can define
  descriptor registry/types, but it must not import `wallpaper-runtime`.
- Wallpaper/runtime-specific Inspector descriptors must be app-local
  contributions because the app may depend on both `editor` and
  `wallpaper-runtime`.
- `ARCH-001` in `docs/known-defects-and-todos.md` records a future opportunity
  to extract a small frame-command batching primitive. It is a watch item, not
  a Gate 0 implementation requirement.

## Non-Goals

- Do not add `InspectorActorDetailsSource` implementation yet.
- Do not add `InspectorComponentDescriptorRegistry` implementation yet.
- Do not add `InspectorPropertyEditController`.
- Do not add `NumberFieldComponent`.
- Do not change Camera3, runtime camera commands, Dock, or window lifecycle.
- Do not extract `FrameCommandBatch`.
- Do not create an actor-system `OnGUI`, repaint, update, or frame-loop API.

## Step 0: Entry Audit

1. Check the worktree:

```powershell
git status --short
```

2. Confirm current uncommitted files are planning/ledger/progress documents
   only, unless the user intentionally starts implementation in the same turn.
3. Read:

```text
docs/editor-inspector-component-details-plan.md
docs/known-defects-and-todos.md
docs/current-project-progress.md
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

4. Do not stage or commit in this gate unless explicitly requested.
   For this execution pass, the user explicitly asked for a checkpoint if the
   worktree contains untracked work. Commit the planning/progress/ledger
   documents before changing boundary tests, so Gate 0 implementation remains
   reviewable as a separate diff.

Exit:

- The implementation baseline is understood.
- Gate 0 remains plan/test-only.

## Step 1: Add Boundary Tests For Hook Ownership

Update:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Add or extend tests that prove:

- `actor-system/core` production sources, and only production sources, do not
  import or define UI-specific frame hooks:
  - no `OnGUI`;
  - no `FrameUpdateParticipant`;
  - no `UiFrame`;
  - no `frameUpdateAttachment`;
  - no `Inspector`;
  - no DOM tokens such as `HTMLElement`, `document`, `addEventListener`.
- `frameUpdateAttachment` remains in `ui-framework`, not `actor-system`.
- `FrameUpdateAttachmentRuntime` remains the UI-frame hook owner.
- `ComponentAttachmentRuntime` remains generic and does not call
  `updateFrame(...)` itself.

Implementation hint:

- Reuse `collectWorkspaceSourceFiles(...)` and production-source filtering
  patterns already present in `architecture-boundaries.test.ts`.
- Prefer checking package source maps over broad `rg` commands in tests.
- Keep the scan target precise: `packages/actor-system/src/core` production
  files only. Do not scan docs/tests, and do not scan `ui-framework`, because
  `ui-framework` legitimately owns `frameUpdateAttachment`, `UiFrame`, DOM
  controls, and frame update runtime behavior.

Exit:

- Tests fail if actor-system grows UI/OnGUI semantics.
- Tests do not rely on historical docs or temp files.

## Step 2: Add Boundary Tests For Descriptor Ownership

Add tests that prove:

- `packages/editor` production imports do not depend on `wallpaper-runtime`.
- `packages/editor/package.json` dependencies and peerDependencies do not
  include `wallpaper-runtime`, even if production imports are temporarily empty.
- `packages/editor/src/inspector` may define descriptor registry/type names, but
  descriptor implementation files must not import product/runtime component
  classes from `wallpaper-runtime`.
- `packages/ui-framework` production sources do not mention:
  - `InspectorComponentDescriptor`;
  - `InspectorProperty`;
  - `Camera3MotionComponent`;
  - `Tesseract4Component`;
  - `wallpaper-runtime`.
- App-local production code may later import both `editor` and
  `wallpaper-runtime` for descriptor contribution. Gate 0 does not need to add
  that contribution yet.

Suggested test shape:

```ts
const editorEdges = listModuleEdges(editorPackageSources)
  .filter((edge) => edge.resolvedFile?.startsWith("packages/wallpaper-runtime/") ||
    edge.specifier.startsWith("wallpaper-runtime"));
expect(editorEdges).toEqual([]);
```

Exit:

- Future descriptor work cannot accidentally make `editor -> wallpaper-runtime`
  a package dependency.

## Step 3: Add Boundary Tests For Inspector Details Source

Gate 1 will introduce:

```ts
InspectorActorDetailsSource
```

Gate 0 should add tests that lock the intended import shape without requiring
the source to exist yet.

Add tests that prove current/future Inspector production sources:

- do not import `packages/editor/src/hierarchy/**`;
- do not read `TreeView` rows or Hierarchy object source internals;
- do not import app composition or window workspace internals to discover
  actors;
- `InspectorContentComponent` does not import `ActorSystem`, `ActorSystemView`,
  app composition, or Hierarchy internals directly. A factory or source adapter
  may wrap `ActorSystemView`, but the body component must receive the narrow
  source instead of a broad actor-system/app object.

Because the symbol does not exist yet, this test should be written as a
production source scan rather than an assertion that the source already imports
`InspectorActorDetailsSource`.

Exit:

- Gate 1 has a clear failure if it solves component listing by handing broad
  app/actor-system services to the Inspector body component.

## Step 4: Add Boundary Tests For Property Edit Controller Scope

Gate 3 will introduce:

```ts
InspectorPropertyEditController
```

Gate 0 should lock the intended ownership:

- the controller name must not appear in `actor-system`, `ui-framework`,
  `runtime-core`, `runtime-three`, `wallpaper-runtime`, or `four-*` production
  sources;
- definitions/implementations may only live under `packages/editor/src/inspector`;
- app-side production code may import/wire the controller in a later gate, but
  must not define its own controller class/function;
- no production source should define `FrameCommandBatch` or a similarly named
  generic batching primitive in Gate 0.

This keeps `ARCH-001` deferred until there is real duplication.

Exit:

- Future property-edit work cannot turn the controller into a global service or
  runtime/UI-framework concept.

## Step 5: Add Boundary Tests For Number Field Prerequisite

Gate 3 cannot use Inspector-private DOM input shortcuts.

Add tests or plan-local assertions that ensure future editable property work
must use a generic control contract:

- `packages/editor/src/inspector` production code must not contain
  `document.createElement("input")`, `HTMLInputElement`, `type = "number"`,
  `.type = "number"`, `.oninput =`, `.onchange =`, or direct DOM
  `input`/`change` listeners.
- `ui-framework/controls` is the intended owner for `NumberFieldComponent` or
  another reviewed generic field control.
  These DOM primitives are allowed in the future generic `ui-framework/controls`
  field implementation, not in Inspector-specific production code.

Do not add `NumberFieldComponent` in Gate 0.

Exit:

- The editable property gate has to create a reusable field control before
  using numeric editing.

## Step 6: Update Documentation

Update:

```text
docs/editor-inspector-component-details-plan.md
docs/current-project-progress.md
docs/known-defects-and-todos.md
```

Required updates:

- Mark Gate 0 as the first executable slice.
- Reference this detailed Gate 0 file from the parent plan.
- Keep `ARCH-001` as `watch`; do not convert it to an active blocker.
- State explicitly that Gate 0 changed boundary/documentation only and did not
  implement component rows or property editing.

Exit:

- Future agents can start Gate 1 without re-deriving the interaction contract.

## Step 7: Validation

Required:

```powershell
npm run test -w wallpaper-tesseract -- architecture-boundaries
git diff --check
```

Recommended if boundary helper code changes are non-trivial:

```powershell
npm run typecheck -w wallpaper-tesseract
```

Not required:

- browser smoke;
- root `npm run test`;
- root `npm run typecheck`;
- root `npm run build`.

Gate 0 does not change runtime or visible UI behavior.

## Exit Criteria

- `architecture-boundaries` locks:
  - actor-system stays UI/OnGUI agnostic;
  - ui-framework owns frame update hook semantics;
  - editor does not depend on wallpaper-runtime for descriptors;
  - Inspector cannot use Hierarchy/app internals as actor details source;
  - future property edit controller remains editor-owned;
  - editable numeric fields cannot be Inspector-private DOM shortcuts.
- Parent plan and current progress reference this Gate 0 executable plan.
- `ARCH-001` remains a watch item for future simplification, not a current
  implementation dependency.
- No production implementation behavior changes.

## Stop Conditions

Stop and revise the plan if:

- an intended boundary test cannot distinguish production code from tests/docs;
- existing production code already violates one of these rules and fixing it
  would require implementing Gate 1/2/3 behavior;
- the test needs to make actor-system aware of UI concepts to prove UI hook
  ownership;
- adding the boundary test would require app/editor/runtime imports that create
  a package cycle.

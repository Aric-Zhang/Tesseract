# Editor Inspector Component Details Gate 1: Component Sections Plan

Status: complete

Last updated: 2026-07-01

## Purpose

Make Inspector visibly useful for the first time after the selection/follow
work: when an Actor is inspected, every Component attached to that Actor must
appear as a vertical section in the Inspector body.

This gate is intentionally read-only. It proves the Actor details source,
component enumeration, and component section rendering path before adding
property descriptors or editable fields.

## Parent Plan

This gate belongs to:

```text
docs/editor-inspector-component-details-plan.md
```

Gate 0 must already be complete:

```text
docs/editor-inspector-component-details-gate-0-interaction-contract-plan.md
```

## Product References

Unity's Inspector stacks Components vertically under the selected GameObject
header. Unreal's Details panel similarly groups reflected data under object and
component/category headings. Gate 1 takes only the common low-risk part:

- one inspected Actor header;
- one section per attached Component;
- Component name/type/id/enabled state visible;
- no editable fields, no foldout persistence, no per-section Actor children.

## Current Facts

- `InspectorContentComponent` currently renders only:

```text
No actor selected
Missing actor: <id>
Inspecting: <name>
```

- `InspectorContentComponent` receives `InspectorActorDisplaySource`, which can
  only resolve an Actor display name.
- `createActorSystemInspectorActorDisplaySource(...)` wraps `ActorSystemView`,
  but `InspectorContentComponent` itself must not import or receive
  `ActorSystem` / `ActorSystemView`.
- `Actor` already exposes `listComponents()`, and every `Component` has `id`,
  `type`, `actor`, and `enabled`.
- There is no Inspector descriptor registry yet. Therefore Gate 1 must not
  invent descriptor order, property metadata, custom labels, or component
  editors.
- Existing boundary tests currently forbid Inspector private number/input DOM
  shortcuts. Gate 1 may create private non-input DOM for component sections, but
  must keep root content registration and editable field ownership out of the
  Inspector body.

## Non-Goals

- Do not implement `InspectorComponentDescriptorRegistry`.
- Do not display Component properties.
- Do not add `NumberFieldComponent`, text field controls, or editable inputs.
- Do not add Component foldout/expand-collapse behavior.
- Do not create per-Component Actor children.
- Do not add runtime Camera/FOV commands.
- Do not add `InspectorPropertyEditController`.
- Do not extract `FrameCommandBatch`.
- Do not make `packages/editor` depend on `wallpaper-runtime`.

## Architecture Decisions

### Actor Details Source Replaces Display Source

Delete the display-name-only path instead of layering on top of it.

Replace:

```text
InspectorActorDisplaySource
createActorSystemInspectorActorDisplaySource(...)
```

with a narrow details source owned by the Inspector package:

```ts
export interface InspectorActorDetailsSource {
  getActorDetails(actorId: string): InspectorActorDetails | null;
}

export interface InspectorActorDetails {
  readonly actorId: string;
  readonly actorName: string;
  readonly actorEnabled: boolean;
  readonly components: readonly InspectorComponentSummary[];
}

export interface InspectorComponentSummary {
  readonly id: string;
  readonly type: string;
  readonly displayName: string;
  readonly enabled: boolean;
}
```

The ActorSystem adapter may read `ActorSystemView`, `Actor`, and
`actor.listComponents()`. `InspectorContentComponent` must consume only
`InspectorActorDetailsSource`; it must not receive live `Actor` or `Component`
references.

### Component Order

Gate 1 uses `actor.listComponents()` order as the only ordering fact. This is
the attachment order already owned by actor-system. Descriptor-based ordering
belongs to Gate 2, when descriptor ownership exists.

### Component Name

Until descriptors exist, the Component's visible name is derived from
`component.type`. Keep this fallback intentionally lightweight and predictable:
use the type string itself, or a trivial deterministic formatting that does not
encode product semantics. Friendly names, grouping, ordering, and localization
belong to Gate 2 descriptors. The section must also show the raw `type`, `id`,
and enabled state so smoke and tests do not depend on a prettified label.

### Inspector Body DOM

`InspectorContentComponent` may create and replace private, non-input section
DOM inside its same-actor `UiElementComponent.element`.

It must not:

- create or register a window content root;
- create `input` / `textarea` / `select` controls;
- use DOM `input` / `change` shortcuts;
- add DOM click shortcuts;
- mutate selection directly.

The broad "no `createElement(...)` in Inspector" boundary from the text-only
Inspector era should be replaced by more precise rules: no alternate root, no
private editable field shortcuts, and no DOM click activation.

## Step 0: Entry Gate

1. Confirm Gate 0 boundary tests pass:

```powershell
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

2. Confirm the worktree and identify unrelated dirty files:

```powershell
git status --short
```

3. Read the current implementation:

```text
packages/editor/src/inspector/inspector-content-component.ts
packages/editor/src/inspector/inspector-actor-display-source.ts
packages/editor/src/inspector/inspector-view-actor-factory.ts
packages/editor/src/inspector/inspector-content-definition.ts
packages/editor/src/inspector/inspector-content-component.test.ts
packages/editor/src/inspector/inspector-view-actor-factory.test.ts
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Stop if Gate 0 guardrails are failing before any Gate 1 changes.

## Step 1: Replace Display Source With Details Source

1. Replace `inspector-actor-display-source.ts` with an actor-details source
   module. Prefer renaming the file to:

```text
packages/editor/src/inspector/inspector-actor-details-source.ts
```

2. Implement:

- `InspectorActorDetailsSource`;
- `InspectorActorDetails`;
- `InspectorComponentSummary`;
- `createActorSystemInspectorActorDetailsSource(actorSystem)`;
- `formatInspectorComponentDisplayName(type)`.

3. The ActorSystem adapter must:

- return `null` when the actor does not exist;
- read `actor.name` and `actor.enabled`;
- enumerate `actor.listComponents()`;
- map each Component to a fresh summary object;
- not expose the live Component object;
- keep `displayName` deterministic.

4. Delete or update the old `InspectorActorDisplaySource` export and tests.
   Do not keep a compatibility alias.
5. Update `packages/editor/src/inspector/index.ts` in the same step:
   - delete `InspectorActorDisplaySource`;
   - delete `createActorSystemInspectorActorDisplaySource`;
   - export only necessary `InspectorActorDetailsSource`/summary types;
   - keep `createActorSystemInspectorActorDetailsSource` package-internal unless
     a future production caller proves it needs a public adapter.

Exit:

- production code has no `InspectorActorDisplaySource` import;
- old display source file is deleted or renamed;
- the public barrel has no display-source compatibility export;
- tests prove summaries are snapshots, not live references.

## Step 2: Render Actor Header And Component Sections

1. Update `InspectorContentComponentOptions`:

```ts
readonly actorDetailsSource: InspectorActorDetailsSource;
```

Remove `actorDisplaySource`.

2. Replace the single text renderer with structured body rendering:

- empty state: no actor selected;
- missing state: missing actor id;
- inspecting state:
  - actor header;
  - actor id/name/enabled marker;
  - component stack;
  - one section per `InspectorComponentSummary`.

3. Add stable diagnostics for tests and smoke:

```text
data-inspector-content="true"
data-inspector-state="empty|missing|inspecting"
data-inspector-actor-id="<actor id>"
data-inspector-component-count="<count>"
data-inspector-component-id="<component id>"
data-inspector-component-type="<component type>"
data-inspector-component-enabled="true|false"
```

4. Keep section DOM private to `InspectorContentComponent`. Do not create
   section actors in Gate 1.

5. Keep lock/follow semantics unchanged:

- unlocked Inspector follows `selection.snapshot.activeActorId`;
- locked Inspector keeps its local inspected actor;
- unlock catches up to the current active selection.

Exit:

- selecting an Actor with Components shows every Component section;
- actors with no Components render a deterministic empty component list;
- missing/no-selection states still work;
- the old `Inspecting: <name>` text is no longer the primary renderer.
- tests cover multiple Components with the same `type` and different `id`, so
  section identity cannot accidentally key by type alone.

## Step 3: Update Factory And Definitions

1. Update `inspector-content-definition.ts` to require
   `actorDetailsSource` instead of `actorDisplaySource`.
2. Update `inspector-view-actor-factory.ts` to pass:

```ts
createActorSystemInspectorActorDetailsSource(context.actorSystem)
```

3. Keep actor tree shape unchanged:

```text
Inspector root actor
  Inspector Toolbar actor
    Inspector Lock Toggle actor
  Inspector Body actor
    InspectorContentComponent
```

4. Do not pass broad app composition, Hierarchy internals, or runtime owners
   into Inspector body.

Exit:

- Inspector factory tests prove body actor still owns `InspectorContentComponent`;
- root content registration still belongs only to `InspectorRootContentComponent`;
- failure cleanup still destroys root/toolbar/body/lock actors.

## Step 4: Style Component Sections

Update:

```text
packages/editor/src/inspector/inspector.css
```

Use existing `--ui-*` tokens only. Add minimal styles for:

- actor header;
- component stack spacing;
- component section;
- component title row;
- type/id/enabled metadata.

Do not add raw colors, fonts, border radii, or shadows outside the existing
style allowlist.

Exit:

- component sections are readable in the current theme;
- theme switching still affects Inspector through existing tokens.

## Step 5: Tests

Update or add targeted tests:

```text
packages/editor/src/inspector/inspector-actor-details-source.test.ts
packages/editor/src/inspector/inspector-content-component.test.ts
packages/editor/src/inspector/inspector-view-actor-factory.test.ts
```

Required coverage:

- details source returns actor name, enabled state, and all components;
- details source returns `null` for missing actor;
- details source does not expose live Component references;
- component summaries preserve `actor.listComponents()` order;
- component display name is deterministic from type;
- Inspector renders no-selection, missing, no-component, and component-stack
  states;
- disabled components are visibly marked through data/text;
- lock/follow behavior remains unchanged;
- two Inspectors can diverge with one locked and one following;
- factory passes details source and no longer references display source;
- root/toolbar/body/lock actor structure is unchanged.

## Step 6: Boundary Tests

Update:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Boundary expectations:

- `InspectorContentComponent` consumes `InspectorActorDetailsSource`.
- `InspectorContentComponent` still must not import `ActorSystem` or
  `ActorSystemView`.
- `packages/editor/src/inspector` has no production `InspectorActorDisplaySource`
  compatibility path.
- `InspectorContentComponent` may create private non-input section DOM, but the
  old broad `createElement(...)` ban must be replaced with these more precise
  guardrails:
  - no window content registration outside `InspectorRootContentComponent`;
  - no second root/content host creation or registration from the body;
  - no `input` / `textarea` / `select` element shortcuts;
  - no DOM click activation shortcuts;
  - no `input` / number field shortcuts;
  - no `Selection` facade use;
  - no Hierarchy/app internals import.
- `packages/editor` still has no `wallpaper-runtime` import or manifest
  dependency.

## Step 7: Browser Smoke

Because this gate changes visible Inspector behavior, add a fresh smoke runner
or extend a current one with a dedicated evidence file. The runner must validate
its own evidence before writing `passed: true`, or pair with a test-support
contract that rejects stale/partial evidence.

```text
apps/wallpaper-tesseract/scripts/run-editor-inspector-component-sections-smoke.mjs
temp/editor-inspector-component-sections-smoke-data.json
temp/editor-inspector-component-sections-smoke-report.md
```

Required smoke assertions:

- console errors are 0;
- initial Inspector shows no-selection or the current selected actor state
  deterministically;
- selecting Scene updates Inspector actor header;
- selecting Camera3 updates Inspector actor header;
- selected Actor component count is greater than 0 when the Actor has
  Components;
- every visible component section records id/type/enabled diagnostics;
- lock button still freezes one Inspector while another follows;
- Debug diagnostics still show rows, proving app composition provider wiring did
  not regress.
- required fields are present and non-stale before `passed: true` is written.

No property values or editing are required.

## Step 8: Documentation

Update:

```text
docs/editor-inspector-component-details-plan.md
docs/current-project-progress.md
```

Required updates:

- Mark Gate 1 complete only after tests and smoke pass.
- Record the smoke evidence file paths.
- State explicitly that Gate 1 displays Component sections only; descriptors,
  property rows, editable fields, and runtime commands remain future gates.

## Validation

Targeted while iterating:

```powershell
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Before handoff:

```powershell
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run build -w editor
npm run build -w wallpaper-tesseract
git diff --check
```

Browser validation:

```powershell
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-editor-inspector-component-sections-smoke.mjs
```

Root validation is recommended if Gate 1 touches shared helpers outside
`packages/editor/src/inspector` or app smoke contracts:

```powershell
npm run test
npm run typecheck
npm run build
```

## Exit Criteria

- Inspector displays a vertical Component section stack for the inspected Actor.
- Component type/name/id/enabled state are visible and smoke-measurable.
- Old display-name-only source and `Inspecting: <name>` primary renderer are
  deleted.
- No descriptor registry, property rows, editable fields, runtime command
  changes, or frame-command batching primitive were added.
- Inspector still follows selection when unlocked and stays pinned when locked.
- Boundary tests keep actor details access on the narrow source and keep
  wallpaper-runtime descriptors out of `packages/editor`.

## Completion Evidence

Completed on 2026-07-01.

Implementation summary:

- Replaced the display-name-only Inspector source with
  `InspectorActorDetailsSource`.
- Deleted `InspectorActorDisplaySource` and its public barrel exports instead
  of keeping a compatibility alias.
- Kept `createActorSystemInspectorActorDetailsSource` out of the Inspector
  public barrel because no external production caller needs it.
- `InspectorContentComponent` now renders an actor header and read-only
  Component section stack from snapshot summaries.
- Component ordering uses `actor.listComponents()` order only; descriptor-based
  names, ordering, grouping, properties, and editing remain future gates.
- Boundary tests now allow Inspector private non-input section DOM while still
  forbidding private editable inputs, DOM click shortcuts, second content hosts,
  Hierarchy/app internals, and `wallpaper-runtime` descriptor dependencies.

Validation:

```powershell
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w editor
npm run prism:smoke:prepare
$env:EDITOR_INSPECTOR_COMPONENT_SECTIONS_SMOKE_URL="http://127.0.0.1:5176/?resetWorkspaceLayout=1"; node apps/wallpaper-tesseract/scripts/run-editor-inspector-component-sections-smoke.mjs
```

Smoke evidence:

```text
temp/editor-inspector-component-sections-smoke-data.json
temp/editor-inspector-component-sections-smoke-report.md
```

The smoke recorded console errors 0, Scene component count 5, Camera3 component
count 4, Inspector lock/follow split behavior, and Debug row count 16.

## Stop Conditions

Stop and revise the plan if:

- rendering Component sections requires exposing live Component objects to
  Inspector UI;
- component order cannot be derived from `actor.listComponents()` without adding
  descriptor metadata;
- browser smoke needs a hidden product-only API to select actors or inspect
  component rows;
- implementing this gate would require `packages/editor` to depend on
  `wallpaper-runtime`;
- implementing this gate would require private input/number controls in
  Inspector instead of waiting for generic `ui-framework/controls` fields.

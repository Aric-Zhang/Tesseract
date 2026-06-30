# Gate 1: Diagnostics Product Migration Plan

Status: `completed`

Last updated: 2026-06-30

Parent plan:

```text
docs/editor-selection-and-inspector-plan.md
```

Prerequisite:

```text
docs/editor-selection-and-inspector-gate-0-foundation-diagnostics-plan.md
```

## Goal

Move the product Debug Log path onto `foundation/diagnostics` and delete the old
app-to-Debug-window direct callback path in the same gate.

After this gate:

- app composition owns one `DiagnosticHub`;
- app composition installs that hub as the process-level `Debug` provider;
- app composition passes a `DiagnosticSource` to the Debug window feature;
- Debug Window is only a viewer of diagnostics;
- `DiagnosticHub` remains the only owner of diagnostic ids, timestamps,
  capacity, and retained event history;
- Debug Window close/reopen leaves exactly one live diagnostic subscription per
  live view;
- old `debugLogTarget` / `onDebugLogContentChanged` wiring is gone;
- Debug UI no longer imports `actor-system/gizmo` log entry types.

This gate must not touch Selection or Inspector behavior.

Completion evidence:

```text
npm run test -w foundation
npm run typecheck -w foundation
npm run build -w foundation
npm run test -w editor -- debug
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- create-wallpaper-app app-shell architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
npm run prism:smoke:prepare
node temp/run-editor-gate-1-diagnostics-smoke.mjs
```

Browser smoke evidence:

```text
temp/editor-gate-1-diagnostics-smoke-data.json
temp/editor-gate-1-diagnostics-smoke-report.md
```

Commit hygiene note:

- The current worktree still contains TreeView expand/collapse baseline work
  from before this gate.
- When checkpointing, stage TreeView, Gate 0 foundation, and Gate 1 diagnostics
  migration separately so UI behavior and diagnostics ownership remain
  reviewable independently.

## Pre-Gate-1 Baseline

```text
GizmoEventSystem.onDebugLog
  -> create-wallpaper-app.ts debugLogTarget?.append(entry)
  -> DebugLogContentComponent.append(entry)
  -> DebugLogDataSource.append(GizmoDebugLogEntry)
  -> VirtualListViewComponent
```

Pre-Gate-1 debt:

- `create-wallpaper-app.ts` owns a mutable `debugLogTarget`.
- `installToolWindowFeatures(...)` exposes `onDebugLogContentChanged`.
- `DebugLogContentComponent` exposes `append(...)`.
- `DebugLogDataSource` owns a second log buffer, line ids, revision, and
  `GizmoDebugLogEntry` formatting.
- Debug UI knows about `actor-system/gizmo` debug entry shape.

This is exactly the double-fact path Gate 1 must delete.

## Non-Negotiables

- Do not keep `debugLogTarget` or `onDebugLogContentChanged`.
- Do not add a compatibility adapter from `GizmoDebugLogEntry` to
  `DebugLogContentComponent.append(...)`.
- Do not let Debug Window own diagnostic retention, ids, timestamps, or
  capacity.
- Do not let `packages/editor/src/debug` import `actor-system/gizmo`.
- Do not make `actor-system/gizmo` import `foundation`.
- Do not add a second diagnostic provider or provider fallback.
- Do not use `Debug` facade inside Debug Window to read events. Debug Window
  consumes `DiagnosticSource`.
- Do not let Debug display formatting read `event.data` to recover old
  `GizmoDebugLogEntry` fields. `data` is opaque payload.
- Do not migrate Selection/Inspector in this gate.

## Step 0: Entry Gate

Required checks:

```text
git status --short
npm run test -w foundation
npm run typecheck -w foundation
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Required working-tree discipline:

- Gate 0 changes and current TreeView expand/collapse dirty baseline must be
  clearly separated before implementation.
- If TreeView work remains dirty, do not edit those files in this gate.
- If Gate 0 foundation tests fail, stop and fix Gate 0 first.

## Step 1: Add Runtime Dependencies

Update:

```text
packages/editor/package.json
apps/wallpaper-tesseract/package.json
package-lock.json
```

Expected dependencies:

- `editor -> foundation`
- `wallpaper-tesseract -> foundation`

Update:

```text
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts
```

Dependency-rule changes:

- remove `foundation` from the `editor` forbidden package list;
- `wallpaper-tesseract` may depend on `foundation` through manifest
  dependency;
- keep `foundation` forbidden for `actor-system`, `ui-framework`,
  `runtime-core`, `runtime-three`, `wallpaper-runtime`, and all `four-*`
  packages.

Do not add `foundation` to:

- `actor-system`;
- `ui-framework`;
- `runtime-core`;
- `runtime-three`;
- `wallpaper-runtime`;
- `four-*`.

Run:

```text
npm install --package-lock-only
```

Boundary expectations:

- package graph remains acyclic;
- undeclared workspace import check remains empty;
- `foundation -> []` remains enforced.

## Step 2: Convert Editor Debug Source To Diagnostic View Adapter

Update:

```text
packages/editor/src/debug/components/debug-log-data-source.ts
packages/editor/src/debug/components/debug-log-data-source.test.ts
```

Target shape:

- `DebugLogDataSource` may keep its current file/name if useful, but its
  semantics must change from "Debug-owned log buffer" to
  `DiagnosticSource -> VirtualListDataSource` adapter.
- It receives a `DiagnosticSource`.
- It subscribes to diagnostic events.
- If it subscribes during construction, it must own the returned registration
  and expose `dispose()` to unsubscribe.
- `DebugLogContentComponent.dispose()` or view runtime dispose must call this
  data-source dispose path.
- It exposes `revision` for `VirtualListViewComponent`.
- It uses `DiagnosticEvent.id` as row key.
- It formats `DiagnosticEvent.timestampMs`, `level`, `source`, `message`, and
  optional tags for display.
- It must not inspect `event.data`, `event.rawMessage`, or
  `GizmoDebugLogEntry` fields for row formatting. Those payloads stay opaque.
- It may keep a current snapshot cache for view performance, but that cache is
  not a second log truth:
  - no independent capacity;
  - no independent line id sequence;
  - no independent retained event model;
  - no `append(...)`.
- Empty state keeps a single muted placeholder item.
- Dispose/unsubscribe must be explicit. If the data source owns the
  subscription, expose `dispose()`.

Tests:

- reads initial `DiagnosticSource.snapshot()`;
- updates revision when source emits;
- row keys use `diagnostic:<event.id>` or equivalent event-id key;
- row text is derived only from `DiagnosticEvent` envelope fields
  `timestampMs`, `level`, `source`, `message`, and `tags`;
- row text does not change when only opaque `data` changes;
- placeholder appears when no diagnostic event exists;
- dispose stops future revision updates;
- close/reopen style construction creates exactly one active subscription per
  live Debug view;
- source capacity controls retained rows;
- no test constructs `GizmoDebugLogEntry`.

Deletion checks:

```text
rg -n "GizmoDebugLogEntry|append\\(" packages/editor/src/debug/components/debug-log-data-source.ts
```

Allowed hits:

- none in `debug-log-data-source.ts`.

## Step 3: Remove `DebugLogContentComponent.append`

Update:

```text
packages/editor/src/debug/components/debug-log-content-component.ts
packages/editor/src/debug/components/debug-log-content-component.test.ts
packages/editor/src/debug/components/debug-log-content-definition.ts
```

Target shape:

- `DebugLogContentComponent` no longer imports `GizmoDebugLogEntry`.
- It no longer exposes `append(...)`.
- It no longer mutates a Debug-owned data source.
- It refreshes the virtual list when the diagnostic view adapter revision
  changes.
- It disposes any diagnostic data-source subscription it owns or receives.
- Window content registration remains unchanged.

Recommended implementation:

- `DebugLogContentComponentOptions` receives a diagnostic-backed data source.
- The component stores `lastRenderedRevision`.
- `updateFrame(...)` checks `source.revision`.
- If revision changed, call `refreshItemsPreservingEnd()` and
  `refreshScrollDiagnostics()`.
- Constructor performs the first render.

Tests:

- initial render occurs once;
- multiple diagnostic events before a frame produce one virtual-list refresh;
- idle frames do not refresh;
- dispose prevents later subscription/refresh effects;
- component dispose unsubscribes from diagnostics when the component owns the
  diagnostic view adapter;
- no `append(...)` test path remains.

Deletion checks:

```text
rg -n "append\\(|GizmoDebugLogEntry" packages/editor/src/debug
```

Allowed hits:

- historical docs only;
- no production hit in `packages/editor/src/debug`.

## Step 4: Inject Diagnostics Into Debug View Actor

Update:

```text
packages/editor/src/debug/components/debug-log-window-actor-factory.ts
packages/editor/src/debug/components/debug-log-window-actor-factory.test.ts
packages/editor/src/debug/components/index.ts
packages/editor/src/debug/index.ts
```

Target shape:

```ts
interface DebugLogViewActorOptions {
  readonly diagnostics: DiagnosticSource;
  ...
}
```

Rules:

- `createDebugLogViewActor(...)` creates the diagnostic-backed
  `DebugLogDataSource` from `options.diagnostics`.
- `maxLines` is removed from Debug view actor options unless it still has a
  real non-diagnostic meaning. Capacity belongs to `DiagnosticHub`.
- Debug view actor returns content as before for window registration, not for
  logging.
- Public exports must not expose append-oriented types.

Tests:

- actor factory renders initial diagnostic snapshot;
- actor factory updates when diagnostic source emits;
- disposing the view actor unsubscribes from diagnostics;
- close/reopen creates no duplicate diagnostic subscription;
- no actor factory test uses `GizmoDebugLogEntry`;
- no factory option named `maxLines` remains unless justified in test names and
  docs as view-only, not retention.

## Step 5: Remove Tool-Window Debug Callback Surface

Update:

```text
packages/editor/src/tool-windows/install-tool-window-features.ts
packages/editor/src/tool-windows/**/*.test.ts
packages/editor/src/index.ts
```

Target shape:

```ts
interface InstallToolWindowFeaturesOptions {
  readonly diagnostics: DiagnosticSource;
  ...
}
```

Rules:

- remove `onDebugLogContentChanged`;
- remove `DebugLogContentComponent` from installer public options;
- pass `diagnostics` to `createDebugLogViewActor(...)`;
- Debug view runtime dispose no longer clears a logging target;
- tool-window installer remains an installer, not a diagnostics owner.

Tests:

- install registers Debug view factory with diagnostics;
- creating/disposing Debug view runtime does not call any callback;
- no `onDebugLogContentChanged` symbol remains in production editor code.

Deletion checks:

```text
rg -n "onDebugLogContentChanged|DebugLogContentComponent" packages/editor/src/tool-windows packages/editor/src/index.ts
```

Allowed hits:

- `DebugLogContentComponent` may remain in component module exports only if
  still needed by tests or window content typing;
- `onDebugLogContentChanged` has no hits.

## Step 6: Wire App Composition To Diagnostics

Update:

```text
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
apps/wallpaper-tesseract/src/**/*.test.ts
```

Target shape:

- create one `DiagnosticHub`;
- install it with `installDiagnosticProvider(...)`;
- pass it to `installToolWindowFeatures({ diagnostics: diagnosticHub, ... })`;
- dispose the diagnostic provider registration during app dispose;
- dispose the diagnostic provider registration if app initialization throws
  after provider installation;
- remove `debugLogTarget`;
- remove `onDebugLogContentChanged` callback;
- keep `GizmoEventSystem` debug behavior, but map `onDebugLog(entry)` to
  diagnostics explicitly.

Recommended gizmo adapter:

```ts
onDebugLog: (entry) => diagnosticHub.emit({
  level: "log",
  message: entry.message,
  data: entry,
  source: "actor-system/gizmo",
  tags: ["gizmo", entry.type]
})
```

Rules:

- Do not make `actor-system/gizmo` depend on `foundation`.
- Do not pass Debug UI component references into app composition.
- Do not emit a new default "diagnostics ready" product log unless a test
  explicitly needs it; avoid adding permanent noise to Debug Window.

Tests:

- app composition installs and disposes the diagnostic provider;
- app initialization failure after provider installation disposes the provider
  registration, so a later app creation does not fail with double install;
- `GizmoEventSystem.onDebugLog` feeds the hub;
- no app-level mutable Debug component target exists.

Deletion checks:

```text
rg -n "debugLogTarget|onDebugLogContentChanged" apps/wallpaper-tesseract/src packages/editor/src
```

Allowed hits:

- active plan docs only;
- tests asserting old path removal only if useful.

## Step 7: Boundary Tests

Update:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Add invariants:

- production code has no `debugLogTarget`;
- production code has no `onDebugLogContentChanged`;
- `packages/editor/src/debug` does not import `actor-system/gizmo`;
- `DebugLogContentComponent` has no `append(...)` method;
- `DebugLogDataSource` has no `append(...)` method;
- `DebugLogDataSource` does not own capacity/id fields such as `#maxLines`,
  `#nextLineId`, or `GizmoDebugLogEntry`;
- Debug display code does not read `event.data.type`, `event.data.timeStamp`, or
  other opaque payload fields for row formatting;
- `create-wallpaper-app.ts` creates `DiagnosticHub`;
- `create-wallpaper-app.ts` installs diagnostic provider and disposes the
  registration;
- `create-wallpaper-app.ts` disposes diagnostic provider registration on
  initialization failure after provider install;
- `installToolWindowFeatures(...)` requires a diagnostics source;
- `foundation/facade` Gate 0 allowlist is widened only for the future Selection
  gate if needed; Gate 1 should not add new facade slots outside diagnostics.

Keep existing Gate 0 rules:

- `foundation -> []`;
- no `foundation/profiling`;
- `actor-system/core` and `four-*` do not import foundation convenience APIs.

## Step 8: Validation

Targeted:

```text
npm run test -w foundation
npm run test -w editor -- debug
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
```

Recommended before checkpoint:

```text
npm run test
npm run typecheck
npm run build
git diff --check
```

Browser smoke is required because this gate changes real Debug Log behavior:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Manual/browser checks:

- Debug window opens.
- Debug window shows diagnostics emitted from gizmo interaction.
- Reopen Debug window and verify events do not duplicate.
- `Debug.log(...)` facade forwarding is covered by `foundation` tests; browser
  smoke should use the real product gizmo diagnostic path unless a reviewed
  smoke-only hook already exists.
- Idle Debug window does not mutate DOM continuously.
- Console errors are 0.

If a smoke probe is added, keep it under test/smoke support and remove or keep
it as a named smoke-only hook. Do not add product UI buttons just for the gate.

If browser smoke cannot be completed in the implementation environment, stop
with a blocker record instead of marking Gate 1 complete.

## Exit Criteria

Gate 1 is complete only when:

- `editor` and `wallpaper-tesseract` declare `foundation` dependency;
- app composition creates and disposes one diagnostic provider registration;
- app initialization failure after diagnostic provider installation disposes the
  provider registration;
- Debug Window consumes `DiagnosticSource`;
- Debug Window close/reopen has exactly one live subscription per live view;
- Debug Window no longer receives component append callbacks;
- `debugLogTarget` is deleted;
- `onDebugLogContentChanged` is deleted;
- `DebugLogContentComponent.append(...)` is deleted;
- Debug UI no longer imports `actor-system/gizmo`;
- `DebugLogDataSource` is a diagnostic view adapter, not a retained log owner;
- boundary tests enforce the old path deletion;
- targeted tests pass;
- browser smoke proves visible Debug behavior still works, including
  close/reopen with no duplicated events and no continuous idle mutations.

## Stop Conditions

Stop and revise before implementation continues if:

- Debug Window cannot update without retaining a second event buffer/id source;
- app composition needs to pass Debug component references again;
- `actor-system/gizmo` appears to need a direct `foundation` dependency;
- Debug migration requires changing Selection/Inspector behavior;
- `DiagnosticHub` capacity becomes insufficient and someone tries to add a
  second Debug-specific retention policy;
- browser smoke shows duplicated events after Debug close/reopen.

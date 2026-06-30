# Gate 0: Foundation Diagnostics Base Plan

Status: `complete`

Last updated: 2026-06-30

Parent plan:

```text
docs/editor-selection-and-inspector-plan.md
```

Completed: 2026-06-30

## Goal

Create the smallest durable foundation layer needed by later Debug,
Selection, Inspector, and future Profiler work:

- add `packages/foundation`;
- add `foundation/facade` as the one provider-slot mechanism;
- add `foundation/diagnostics` and `Debug.log/info/warn/error`;
- make diagnostics event retention a single fact owned by `DiagnosticHub`;
- lock the new package graph and import boundaries before product code starts
  depending on it.

This gate must not connect Debug Window yet. Product migration belongs to Gate
1, where the old Debug log path is deleted in the same slice.

## Non-Negotiables

- No root `foundation` export.
- No `foundation/profiling` implementation in this gate.
- No Editor, UI, Runtime, DOM, Three, app-local, actor-system, or four-* imports
  inside `foundation`.
- No no-op fallback provider.
- No provider stack.
- No compatibility package or re-export shell.
- No product Debug Window migration in this gate.
- No changes to Selection or Inspector behavior in this gate.
- No production package outside `foundation/diagnostics` should create a facade
  slot in this gate. `foundation/facade` is reusable infrastructure, but Gate 0
  only proves it through diagnostics.

## Entry Gate

Before editing:

```text
git status --short
npm run test -w ui-framework -- tree scroll collection
npm run test -w editor -- hierarchy
```

Required condition:

- current TreeView expand/collapse work is either committed or explicitly kept
  as a separate dirty baseline;
- do not mix TreeView implementation changes with this gate.

If TreeView tests fail, stop and finish/checkpoint that work first.

## Step 1: Create `packages/foundation`

Create:

```text
packages/foundation/package.json
packages/foundation/tsconfig.json
packages/foundation/src/facade/facade-slot.ts
packages/foundation/src/facade/index.ts
packages/foundation/src/diagnostics/diagnostic-event.ts
packages/foundation/src/diagnostics/diagnostic-hub.ts
packages/foundation/src/diagnostics/debug-facade.ts
packages/foundation/src/diagnostics/index.ts
```

`package.json` shape:

```json
{
  "name": "foundation",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "files": [
    "dist/**/*.js",
    "dist/**/*.js.map",
    "dist/**/*.d.ts",
    "dist/**/*.d.ts.map"
  ],
  "exports": {
    "./facade": {
      "types": "./dist/facade/index.d.ts",
      "import": "./dist/facade/index.js"
    },
    "./diagnostics": {
      "types": "./dist/diagnostics/index.d.ts",
      "import": "./dist/diagnostics/index.js"
    }
  },
  "scripts": {
    "test": "vitest run --passWithNoTests src",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "build": "tsc -p tsconfig.json"
  }
}
```

`tsconfig.json` should match the existing package pattern:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true,
    "tsBuildInfoFile": "node_modules/.cache/tsconfig.tsbuildinfo"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

Exit:

- package has no `dependencies`;
- package has no root `"."` export;
- package has no `"types"` root pointer;
- package does not export `./profiling`.

## Step 2: Implement `foundation/facade`

Implement:

```ts
interface FacadeProviderRegistration {
  dispose(): void;
}

interface FacadeSlot<TProvider> {
  install(provider: TProvider): FacadeProviderRegistration;
  current(): TProvider;
  isInstalled(): boolean;
}

function createFacadeSlot<TProvider>(name: string): FacadeSlot<TProvider>;
```

Semantics:

- `current()` throws a clear error when no provider is installed.
- `install(provider)` throws if a provider is already installed.
- `dispose()` removes only the provider installed by that registration.
- stale registration `dispose()` is idempotent and must not remove a newer
  provider.
- `isInstalled()` reflects whether the slot currently has a provider.
- error messages should include the facade slot name.
- no default provider is created.

Tests:

```text
packages/foundation/src/facade/facade-slot.test.ts
```

Cover:

- current before install throws;
- install then current returns the provider;
- install while installed throws;
- dispose uninstalls provider;
- dispose twice is safe;
- stale dispose does not remove a newer provider;
- different slots are independent.

## Step 3: Implement `foundation/diagnostics`

Create diagnostic types:

```ts
type DiagnosticLevel = "log" | "info" | "warn" | "error";

interface DiagnosticEventInput {
  readonly level: DiagnosticLevel;
  readonly message: unknown;
  readonly data?: unknown;
  readonly source?: string;
  readonly tags?: readonly string[];
}

interface DiagnosticEvent {
  readonly id: number;
  readonly timestampMs: number;
  readonly level: DiagnosticLevel;
  readonly message: string;
  readonly rawMessage?: unknown;
  readonly data?: unknown;
  readonly source?: string;
  readonly tags?: readonly string[];
}

interface DiagnosticSink {
  emit(input: DiagnosticEventInput): void;
}

interface DiagnosticSource {
  snapshot(): readonly DiagnosticEvent[];
  subscribe(listener: (event: DiagnosticEvent) => void): FacadeProviderRegistration;
}
```

Implement `DiagnosticHub`:

- constructor accepts:

```ts
interface DiagnosticHubOptions {
  readonly capacity?: number;
  readonly now?: () => number;
}
```

- default capacity must be explicit in one constant;
- capacity must be positive integer;
- owns monotonic `id`;
- owns `timestampMs` via `now`;
- stringifies `message` deterministically;
- stores `rawMessage` when useful for non-string inputs;
- clones `tags`;
- owns retained history;
- `snapshot()` returns cloned/frozen or otherwise caller-immutable events;
- event envelope immutability is required: callers must not be able to mutate a
  returned `DiagnosticEvent` object or its `tags` array and affect hub state;
- `data` and `rawMessage` are opaque payload references by default. Gate 0 does
  not deep-clone arbitrary payload objects because that would create unclear
  serialization rules and cost. Document this contract in the type comments;
- `subscribe(...)` returns disposable registration;
- subscriber exceptions should not corrupt the retained event history. Prefer
  rethrowing after current emit completes rather than swallowing silently.

Implement `Debug` facade:

```ts
Debug.log(message: unknown, data?: unknown): void;
Debug.info(message: unknown, data?: unknown): void;
Debug.warn(message: unknown, data?: unknown): void;
Debug.error(message: unknown, data?: unknown): void;
```

Rules:

- delegates to the installed diagnostic provider;
- expose installation through a narrow named API such as:

```ts
function installDiagnosticProvider(provider: DiagnosticSink): FacadeProviderRegistration;
```

- do not export the internal facade slot object;
- fails loudly before provider install;
- does not retain events itself;
- does not import Editor, Debug Window, app, DOM, or actor-system;
- does not expose provider mutation except through explicit install/dispose API
  from `foundation/diagnostics`.

Tests:

```text
packages/foundation/src/diagnostics/diagnostic-hub.test.ts
packages/foundation/src/diagnostics/debug-facade.test.ts
```

Cover:

- monotonic ids;
- deterministic timestamp with injected `now`;
- capacity trimming;
- positive capacity validation;
- snapshot event object immutability;
- snapshot `tags` immutability and input tag cloning;
- `data` / `rawMessage` payload identity is documented as opaque reference
  payload, not deep-cloned event state;
- tags cloned from input;
- subscribers receive events in order;
- unsubscribe stops delivery;
- listener disposal is idempotent;
- subscriber error does not prevent history retention;
- `Debug.log/info/warn/error` map to correct levels;
- `Debug` throws before install;
- `Debug` forwards to installed provider;
- external code installs providers only through
  `installDiagnosticProvider(...)` or the chosen narrow equivalent;
- the internal diagnostics facade slot is not exported;
- dispose restores uninstalled state;
- double provider install fails through facade slot.

## Step 4: Wire Workspace Package Metadata

Update:

```text
package-lock.json
scripts/workspace-sequence-config.mjs
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Workspace order:

```text
foundation
actor-system
ui-framework
runtime-core
four-rotation
four-camera
four-camera-three
runtime-three
wallpaper-runtime
editor
wallpaper-tesseract
```

Rationale:

- `foundation -> []`;
- future packages may depend on foundation;
- foundation should build/test before packages that may later consume it.

Package graph descriptor:

```text
descriptor("foundation", "packages/foundation", "foundation")
```

Extend `WorkspacePackageZone` with:

```ts
"foundation"
```

Dependency rules:

- add rule for `foundation` forbidding every other workspace package;
- keep existing pure math rules forbidding `foundation`;
- keep `actor-system` forbidden package list including `foundation` for this
  gate, because selection code must not depend on foundation yet.

Architecture-boundary additions:

- workspace sequence order includes `foundation` first;
- `foundation` package manifest has exact exports `./facade` and
  `./diagnostics`;
- `foundation` has no root export;
- production imports from `packages/foundation/src` to any workspace package
  fail;
- production imports of `foundation/facade` from outside
  `packages/foundation/src/diagnostics` fail in Gate 0. This rule is gate-local
  and may be revised in the later Selection gate when `packages/editor`
  legitimately installs the `Selection` facade provider;
- production `createFacadeSlot(...)` calls outside `packages/foundation/src`
  fail in Gate 0;
- no `foundation/profiling` export exists;
- no production import of `foundation/profiling` exists;
- `four-*` production sources do not import `foundation` or
  `foundation/diagnostics`;
- `actor-system/core` production sources do not import `foundation`.

Do not relax any existing package dependency rule unless a later gate requires
it and explains the owner reason.

## Step 5: Update Documentation

Update:

```text
docs/current-project-progress.md
docs/editor-selection-and-inspector-plan.md
```

Required notes:

- Gate 0 complete only after `foundation` is package-graph enforced.
- `foundation/profiling` remains deferred unless the conditional gate is
  explicitly reached.
- Debug Window is not migrated in Gate 0; Gate 1 owns deletion of the old Debug
  path.

Do not update `AGENTS.md` unless this package becomes accepted stable
architecture after implementation review. Current package status belongs in
`docs/current-project-progress.md`.

## Step 6: Validation

Targeted:

```text
npm run test -w foundation
npm run typecheck -w foundation
npm run build -w foundation
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Recommended before checkpoint:

```text
npm run test
npm run typecheck
npm run build
git diff --check
```

No browser smoke is required for Gate 0 because product behavior must not
change. If product code changes, stop and revise the plan.

## Exit Criteria

Gate 0 is complete only when:

- `packages/foundation` exists and builds;
- root workspace sequences include `foundation`;
- `foundation` has exact public exports `./facade` and `./diagnostics`;
- `foundation` has no root export and no `./profiling` export;
- `foundation/package.json` has no dependencies;
- facade slot tests pass;
- diagnostics and Debug facade tests pass;
- architecture boundary tests enforce `foundation -> []`;
- architecture boundary tests enforce Gate 0 facade-slot usage is limited to
  diagnostics;
- architecture boundary tests enforce no `foundation/profiling` import/export;
- no Debug Window/product migration has been attempted;
- TreeView dirty work remains separate or is already checkpointed.

## Stop Conditions

Stop and revise before implementation continues if:

- `foundation` needs any workspace dependency;
- diagnostics needs to know about Debug Window, VirtualListView, Editor, Runtime,
  DOM, or app code;
- `Debug` needs a no-op fallback provider;
- a real profiler consumer appears and would require UI/runtime semantics inside
  foundation;
- package graph rules require allowing `actor-system/core -> foundation`;
- product Debug migration becomes necessary to make Gate 0 tests pass.

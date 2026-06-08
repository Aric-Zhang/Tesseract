# Project Prism Phase 3A Baseline Report

Status: Step 3A.0 complete.

Generated after the Phase 3.0 checkpoint. This report records the remaining UI
framework blockers before Phase 3A starts moving state/scheduler/installer
contracts.

## Boundary Facts

The generated Project Prism facts currently keep `ui-framework` blocked by:

- `ui-state-binding-debt`
- `component-definition-installer-debt`

`dock-surface-truth-debt` is no longer present in the generated blocker list.

## Generic UI Candidate Couplings

### Scene-Backed UI State

`window-runtime` still contains and publicly exports scene-backed floating
window state registration:

- `apps/wallpaper-tesseract/src/window-runtime/floating-window-scene-state-adapter.ts`
- `apps/wallpaper-tesseract/src/window-runtime/index.ts`

Current public export:

```text
export { registerFloatingWindowParameters } from "./floating-window-scene-state-adapter";
export type { RegisterFloatingWindowParametersOptions } from "./floating-window-scene-state-adapter";
```

Required Phase 3A deletion condition:

- Scene-backed state adapter moves to app/editor integration.
- `window-runtime` public exports no scene-backed adapters.

### Workspace Runtime Service Registration

`features/window-workspace/install-window-workspace-feature.ts` still imports:

- `SceneParameterStore`
- `RuntimeObject`
- `RuntimeRegistration`

It also accepts:

```text
sceneStore: SceneParameterStore
registerRuntimeService: (object: RuntimeObject) => RuntimeRegistration
```

Required Phase 3A deletion condition:

- Generic workspace UI services use UI-owned scheduler/state ports.
- Scene/app runtime registration is isolated in app integration.

### Runtime Ports Inside Window Runtime

Generic window runtime still imports app runtime ports in:

- `window-runtime/floating-window-component.ts`
- `window-runtime/window-workspace-controller.ts`
- `window-runtime/window-workspace-layout-persistence-controller.ts`
- `window-runtime/window-workspace-presentation-controller.ts`

Required Phase 3A deletion condition:

- UI runtime uses UI-owned event/scheduler contracts.
- App runtime adapters bridge those contracts to the existing app frame loop.

### Component Definition Installer Debt

UI-facing installers still import the app-local helper:

- `window-runtime/install-component-definitions.ts`
- `features/app-menu/install-component-definitions.ts`
- `gizmo-runtime/install-component-definitions.ts`

Required Phase 3A deletion condition:

- Reusable UI installers do not import app-root `component-definitions.ts`.
- Central app installation only composes package/feature installers.

## Public Barrel Risks

`window-runtime/index.ts` is the immediate public barrel risk because it exports
the scene-backed adapter. Phase 3A.1 must remove this export before deeper state
port work continues.

## Test/Fixture Couplings

Several generic UI tests import `scene-runtime` only to get scene store/path or
vec helpers:

- `window-runtime/floating-window-state.test.ts`
- `window-runtime/floating-window-component.test.ts`
- `window-runtime/dock-target-region-source.test.ts`
- `window-runtime/window-workspace-controller.test.ts`
- `features/app-menu/app-menu-bar-component.test.ts`
- `features/app-menu/app-menu-bar-actor-factory.test.ts`

Phase 3A should move generic tests to fake UI state/scheduler helpers. Adapter
tests may keep scene-runtime imports and must be clearly named as app/editor
adapter tests.

## Immediate Execution Order

1. Step 3A.1: remove scene-backed adapter exports from UI public barrel.
2. Step 3A.2: add UI-owned state reader/observer/store test contracts.
3. Step 3A.3: move `floating-window-scene-state-adapter` out of
   `window-runtime`.
4. Step 3A.4: replace app `RuntimeObject` registration with UI scheduler ports.
5. Step 3A.5+: workspace mode and installer ownership cleanup.

## Baseline Verification

Commands:

```text
node scripts/generate-project-prism-phase0-report.mjs
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
```


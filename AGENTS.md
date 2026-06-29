# AGENTS.md

This file is the stable handoff guide for agents working in this repository.
Read it before making changes.

Mutable project status does not belong here. For the current package list,
source topology, Project Prism phase status, active plans, and current
verification matrix, read:

```text
docs/current-project-progress.md
```

Update that progress document whenever the implementation stage, package
layout, active plan, or verification matrix changes.

Known defects, confirmed follow-up cleanup, and debugging findings that should
survive temp cleanup live in:

```text
docs/known-defects-and-todos.md
```

Update that defect ledger whenever a confirmed bug is found, fixed, verified,
or converted into an architecture cleanup item.

Historical plans, reports, smoke artifacts, and temporary logs live under
`temp/`. Treat old plans as project memory, not automatic instructions.

## Stable Architecture Direction

Project Prism favors a clean, coherent architecture over preserving
transitional code. New work should move the codebase toward these boundaries:

- `actor-system/core` is minimal and framework-agnostic: actor system, actor
  tree, component definitions, component registry, lifecycle, parent/effective
  active state, and generic ports only. No DOM, Three.js, actor-system/gizmo,
  scene runtime, window runtime, or app runtime dependencies.
- `actor-system/input` is separate from actor-system/core. It may adapt actor
  participation to input/gizmo semantics, but actor-system/core must not know
  about editor UI, rendering, docking, or app composition.
- `actor-system/gizmo` is framework-agnostic pointer/gizmo event machinery. It
  must not depend on editor UI, runtime/rendering code, window/docking code, or
  app composition.
- UI/window framework code is product-agnostic: app shell, window frame, root
  workspace frame, tabs, docking, splitters, layout persistence, pointer
  surfaces, and frame lifecycle. It must not know about Scene rendering,
  Tesseract, Camera3, Debug Log contents, Inspector contents, or Hierarchy
  business data.
- Runtime/rendering code is editor-agnostic: worlds, projection graph, cameras,
  render/update orchestration, frame sources, and runtime commands. It must not
  import editor features, debug/inspector/hierarchy/menu/window/dock UI, or app
  composition.
- Editor/features own presentation and commands. They may compose runtime and
  UI framework ports, but should not become hidden owners of runtime resources.
- App composition is thin. It installs features, passes dependencies, and wires
  top-level ports. It should not directly create renderer internals, frame
  policies, Scene view runtimes, or feature actors.

Current architecture rules:

- Actor-backed features should use `ActorSystem` and `ComponentRegistry`.
- Component dependencies belong in `ComponentDefinition.requires`.
- External runtime registration belongs in binding components and narrow
  bridge/attachment runtimes, not in business components.
- Component mutation must go through `ComponentRegistry`.
- Do not import `ActorImpl` outside the actor runtime/package that owns it.
- Do not expose actor component arrays.
- State updates should go through explicit command or model ports, not direct
  DOM/event mutation.
- Pointer-driven selection should stay on the actor input/gizmo path, not DOM
  click mutation.

There is an architecture boundary test at:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Update it whenever a clarified architecture rule should become an invariant.

## Architecture Integrity During Refactors

Use these rules during architecture work:

- Before adding any new model, port, service, cache, adapter, fallback, or
  state field, first check whether it is truly necessary, whether an existing
  owner already knows the same fact, whether it creates a parallel truth path,
  and whether it makes the architecture harder to understand.
- Do not add architecture complexity as the first response to a feature,
  refactor, or bug fix. First try to solve the problem by simplifying the
  existing ownership model, deleting obsolete paths, or routing the change
  through the intended actor/component, UI, runtime, or app-composition owner.
- Treat the actor tree -> component composition model as the source of truth.
  Do not create parallel ownership, lifecycle, active-state, or identity
  channels to avoid changing the actor/component path.
- Keep each reusable fact in one owner. If view identity, frame ownership,
  scene runtime location, menu state, docking targets, persistence data, or
  runtime frame source state can be derived from several places, choose one
  authoritative model and delete or collapse the others.
- If the same or similar behavior has been implemented more than once, design
  the cleanup around one elegant shared fact or contract. Prefer collapsing
  duplicate implementations to preserving multiple paths with synchronization.
- When a refactor replaces old logic with a new owner or contract, delete the
  old logic in the same cleanup path. Do not leave old code idle, keep it as a
  compatibility path, or preserve it as a fallback merely because it still has
  callers. If deletion has a wider blast radius, expand the change scope enough
  to remove the old logic cleanly.
- Treat any code path derived from the old logic as removable unless the active
  plan explicitly names it as a short-lived migration boundary with a deletion
  step. A bridge may exist only to complete the replacement; it must not become
  a product behavior path or a reason to keep parallel facts.
- Legacy compatibility is not a design constraint. New code must not depend on
  compatibility aliases, migration-only APIs, old registration helpers, or
  fallback behavior that keeps the previous ownership model alive.
- During old-fact cleanup and multi-truth convergence, expect many changes to
  delete more code than they add. Prefer shrinking the system, removing
  duplicated state, and replacing obsolete implementations over layering more
  logic onto the existing codebase.
- Remove hacks and patches once their underlying contract is clear. Avoid
  preserving special cases simply because tests currently cover them.
- Let refactors expose broken assumptions. Do not hide architecture problems
  behind defensive fallback paths if the intended model can make the failure
  explicit and testable.
- Prefer bold, internally consistent changes over local edits that leave the
  subsystem harder to reason about. Scope discipline still matters: change the
  subsystem needed for the architecture goal, but finish the ownership cleanup
  inside that subsystem.
- Periodically ask whether a simpler architecture can satisfy the current
  design goal. During architecture refactors, it is acceptable to make large,
  clean changes when they reduce structural complexity, remove code debt, reuse
  existing contracts, and replace old implementations completely.
- Before implementing new behavior, estimate the maintenance cost it adds. Ask
  whether the behavior is necessary, whether the existing architecture can
  express it, and whether the better answer is to simplify or delete current
  implementation instead.
- If blockers multiply or old facts become hard to delete, step back and
  reconsider the architecture as a whole. More blockers are often a sign that
  the ownership model is still too complicated, not a reason to add more
  adapters or compatibility branches.
- Add new architecture surface area only after repeated review shows that the
  target design cannot stay simple without it. When complexity is necessary,
  make its owner, lifecycle, invariants, and boundary tests explicit.
- Strengthen `architecture-boundaries.test.ts` when a rule graduates from
  review opinion to project invariant.

## Window, Docking, And View Identity Rules

Preserve these standards:

- Lifecycle mutations have one owner. Creating, destroying, reparenting,
  docking, floating, closing, focusing, and fullscreen-isolating views should
  go through the window lifecycle owner or a narrow port owned by it.
- Frame components emit lifecycle intent. They should not mutate the actor
  tree, rehost content, or destroy actors directly.
- Per-view close uses the view-level lifecycle contract. Do not implement tab
  close by reusing whole-frame disposal.
- Runtime-only presentation frames must not be serialized as persistent user
  layout.
- Persist logical view descriptors, not actor ids, DOM ids, frame ids, or other
  runtime ownership details.
- Dock targets are semantic tabset/pane regions, not accidental frame-level
  hit names.
- Root workspace and floating frames should share the same surface/view
  contracts where practical. Avoid shell-only state that duplicates
  window-runtime ownership.
- Window menu entries should be explicit type/instance commands. Do not
  reintroduce checkbox-style close toggles for ordinary dockable windows.
- Scene fullscreen is a presentation of a Scene view, not a persistent mutation
  of a mixed owner frame.
- Inactive tabs and hidden split panes must not be actor input interactable.
  Frame stack priority controls cross-window priority; tab-local logic only
  chooses local route/hit behavior.

## Actor Input And UI Interaction

Actor input is the expected path for interactive UI and gizmo behavior.

Keep these constraints:

- Identify input participants with the actor input participant contract rather
  than ad hoc DOM listeners.
- Keep `stackPriority` separate from actor-local `routeScore`.
- `GizmoEventBindingComponent.priority` should preserve cross-actor/window
  stack priority semantics.
- Binding `GizmoHit.priority` may carry actor-local route score.
- If a component implements both a new actor input participant path and a
  legacy responder path, the new participant path wins.
- Preserve click and double-click behavior when refactoring routing.
- Active interactions must cancel if any component in the active path is
  detached or disabled.
- Hierarchy selection, menu activation, tab actions, docking, and gizmo
  interactions should route through actor input or narrow intent ports, not
  through direct DOM mutation shortcuts.
- `actor-system/gizmo` must remain framework-agnostic. Runtime/rendering code
  must not depend on editor UI input details.

Older actor input plans remain useful context, but they are not automatically
authoritative once implementation has moved on.

## Component Definition Installation

Keep component definition installation aligned with ownership:

- Core/binding definitions should stay limited to broadly reusable actor and
  runtime bridge behavior.
- Window definitions belong with window/UI framework installation, not core.
- Feature definitions such as app menu, scene, Camera3, Debug, Hierarchy,
  Inspector, and Tesseract should stay in feature-specific installers or
  grouped feature installation functions.
- Do not put product-specific feature definitions into actor-system/core or the
  reusable UI/window layer.

## Testing And Browser Verification

Prefer targeted checks while iterating, then broaden to root checks before a
handoff or when changes touch shared packages. Use the current package and
smoke matrix in `docs/current-project-progress.md`.

Root-level checks are:

```text
npm run test
npm run typecheck
npm run build
```

For UI/input/window/runtime-render changes, unit tests are not enough. Run the
Vite dev server and perform the current browser smoke matrix from the progress
document:

```text
npm run dev -w wallpaper-tesseract
```

Store temporary screenshots, smoke data, DOM dumps, or logs under `temp/` when
useful.

## Coding Guidelines

- Follow the existing TypeScript style.
- Keep changes scoped to the requested subsystem.
- Prefer local helpers and current patterns when they support the target
  architecture.
- Add abstractions when they clarify ownership, remove real duplication, or
  move code toward Project Prism boundaries.
- Do not preserve a local pattern just because it is old if it conflicts with
  actor tree -> component composition or Prism package boundaries.
- Keep comments sparse and useful.
- Do not rewrite unrelated code during architecture work.
- Preserve user changes in the dirty worktree.
- Use tests to lock behavior before risky refactors.

Always compare plans against the current implementation before editing.

## Plan Execution Persistence

When executing an approved multi-step plan, keep going through the planned
steps unless a real blocker appears that requires redesigning later steps. Do
not stop mid-plan merely because a step is large, risky, or has revealed normal
implementation work.

Use these rules while executing plans:

- If the current step succeeds and the next planned step is still valid, proceed
  to the next step.
- If an upcoming step is high risk, create a Git checkpoint commit at a clean,
  meaningful boundary if useful, then continue executing the plan.
- If a later step proves that the plan itself is wrong, stop and write the
  needed plan amendment before continuing.
- If a rollback becomes necessary, roll back only to an appropriate checkpoint
  and only for the work being executed. Preserve unrelated user or pre-existing
  worktree changes.
- Keep validation evidence with each checkpoint or step report so future agents
  can tell what was proven before continuing.

## Git And Worktree Notes

This repository may be intentionally dirty. Do not revert unrelated changes.
Before editing a file, understand whether existing changes in that file are part
of the user's work. If unrelated files are dirty, leave them alone.

Do not use destructive git commands such as `git reset --hard` or checkout-based
reverts unless the user explicitly asks for that exact operation.

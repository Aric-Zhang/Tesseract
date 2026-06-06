# Window View Multi-Instance Identity Design

Date: 2026-06-06

## Purpose

This document is the design gate before implementing true multi-instance
windows. The current docking model is stable for singleton views such as
`scene`, `debug`, and `hierarchy`, but it still uses `WindowViewKey` as the
primary persisted view identity. That is correct for singleton views and
incorrect for future multi-instance views such as multiple Scene, Inspector, or
Debug-like panes.

The goal is to separate four identities before changing persistence:

- view type;
- view instance;
- actor id;
- menu action identity.

## Current Baseline

Implemented today:

- `WindowViewKey` identifies the singleton logical view used by menu, docking,
  and persistence.
- `WindowViewFactoryRegistry` registers factories by `viewKey`.
- Runtime actor ids are intentionally not serialized in persisted frame roots.
- Menu open/focus is keyed by view key and lifecycle intent.
- Closing a tab removes the view from the persisted live layout and leaves
  `hiddenViewKeys` empty.

This baseline should remain valid for singleton views.

## Identity Model

### `WindowViewTypeKey`

Stable product-level view type.

Examples:

```text
scene
debug
hierarchy
inspector
```

This is the key used by:

- factory registration;
- menu grouping;
- "New X" commands;
- default singleton policy.

### `WindowViewInstanceId`

Stable logical instance id for one created view instance.

Examples:

```text
scene:main
debug:default
inspector:01J...
```

This is the key used by:

- persisted layout view descriptors;
- docking tabs;
- menu focus targets for existing instances;
- close/remove semantics.

### Actor Id

Runtime-only actor identity. Actor ids may be deterministic for singleton
instances, but persistence must not depend on actor ids.

Actor id role:

- route actor input;
- define ActorSystem parent/child relationships;
- support current runtime lookup;
- appear in Hierarchy as live runtime objects.

Actor id must not be used as persisted instance identity.

### Menu Action Identity

Menu identity should distinguish:

- `open-or-focus-type`: focus an existing singleton or create it if missing;
- `focus-instance`: focus a known live instance;
- `new-instance`: create another instance of a type.

The Window menu should not use checkbox close semantics for normal windows.
For singleton rows, selecting the menu item opens or focuses the singleton. For
multi-instance rows, selecting the top-level type focuses the most recently
active live instance; a separate "New X" action creates another instance.

## Proposed Types

```ts
export type WindowViewTypeKey = Brand<string, "WindowViewTypeKey">;
export type WindowViewInstanceId = Brand<string, "WindowViewInstanceId">;

export interface WindowViewIdentity {
  readonly typeKey: WindowViewTypeKey;
  readonly instanceId: WindowViewInstanceId;
  readonly multiplicity: "singleton" | "multi";
}
```

Compatibility:

- singleton `WindowViewKey` can temporarily map to
  `{ typeKey: key, instanceId: `${key}:default` }`;
- old persisted schema remains version 1 until migration is explicitly written;
- new schema should be versioned instead of overloading version 1.

## Factory Registry Contract

Factories should be registered by type:

```text
WindowViewFactoryRegistry
  typeKey -> factory
```

Factory create options should receive:

- `identity`;
- `reason`;
- `parentFrameActor` for view-only creation;
- optional persisted creation data once schema migration exists.

The registry may keep singleton helpers, but singleton behavior should be a
policy on the factory metadata, not an assumption baked into actor ids.

## Menu Rules

Singleton:

- menu row label: `Scene`, `Hierarchy`, `Debug Log`;
- click/Enter opens if missing;
- click/Enter focuses if live;
- close is done by frame/tab close controls, not checkbox menu state.

Multi-instance:

- type row focuses the most recently active live instance, if one exists;
- type row creates an instance only if no live instance exists and the product
  chooses that behavior;
- explicit `New X` creates a new instance;
- future submenu/list may expose each live instance.

## Persistence Rules

Version 1 remains singleton-only:

- `views` keyed by current view key;
- actor ids are omitted from frame roots.

Version 2 should store:

```text
views: [
  { instanceId, typeKey, title, canDock, ... }
]
frames[].root.tabs: [instanceId]
```

Migration:

- version 1 `scene` -> instance `scene:default`;
- version 1 `debug` -> instance `debug:default`;
- version 1 `hierarchy` -> instance `hierarchy:default`;
- unknown view keys are skipped as today.

## First Pilot Recommendation

Do not use Scene as the first pilot. Scene has renderer/camera/tesseract
resource ownership and fullscreen/run-mode coupling.

Recommended pilot:

- a lightweight Debug-like view type, or a future Inspector placeholder;
- no shared renderer;
- no app-level singleton resources.

## Test Plan Before Pilot

Design-level tests:

- registry rejects duplicate singleton live instances unless explicitly focused;
- registry can create two multi instances with distinct instance ids;
- menu type action focuses most recently active instance;
- "New X" creates an additional instance;
- persisted schema v2 round-trips instance ids and omits actor ids;
- v1 migration creates default singleton instance ids;
- closing one instance does not remove another.

Commands:

```text
npm run test -w wallpaper-tesseract -- window-view-factory-registry window-menu-view-source app-menu-model window-workspace-layout-persistence
npm run typecheck -w wallpaper-tesseract
```

## Stop Condition

Do not start Step 9 pilot until this identity model is accepted or revised.
The risk is mixing actor id, view type, and persisted instance identity again,
which would make docking persistence harder to maintain.

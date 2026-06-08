# Project Prism Phase 3B UI Framework Public API Draft

Status: draft for Phase 3C extraction.

This draft freezes the intended package shape before moving files. It is not a
package extraction report.

## Public Package Surface

`ui-framework` should export stable contracts for:

- App shell/root slots:
  - app shell creation;
  - root dock frame mounting;
  - floating frame overlay mounting.
- Window/frame components:
  - floating frame component and definition;
  - workspace root dock frame component and definition;
  - shared frame surface/tab chrome component and definition.
- Dock model:
  - dock tree types;
  - dock region source;
  - dock target resolution;
  - dock preview controller/component;
  - tab drag session state machine.
- Window lifecycle:
  - frame lifecycle controller;
  - frame intent sink;
  - frame port registry;
  - view factory/type registry;
  - view identity types.
- Menu:
  - app menu model;
  - app menu component/definition;
  - menu install helper.
- Persistence:
  - workspace frame layout persistence model;
  - serializer/parser/hydrator;
  - persistence scheduler service.
- UI ports:
  - UI geometry/value types;
  - UI layout state reader/command sink;
  - UI scheduler/frame service;
  - UI actor context.
- Component definition installation:
  - package-owned installer for UI definitions.

## Internal-Only Modules

These should not become public package exports:

- fixture/demo entry files;
- smoke-only storage telemetry;
- test fake DOM helpers;
- reducer helper internals that are not part of a stable dock tree contract;
- CSS implementation details except the documented stylesheet entry;
- app-specific adapters such as scene-backed floating-window state adapters.

## Identity Contract

Public UI APIs must keep these identities separate:

- `WindowViewIdentity.typeKey` and `instanceId` are logical menu/persistence
  identity.
- `viewActorId` is runtime hosting/input identity and must not appear in
  persisted layout.
- `WindowViewKey` remains app-local compatibility where still needed, but must
  not become the long-term persistence identity.

## Extraction Guardrails

Phase 3C must not export or reintroduce:

- wallpaper app actor ids as public API;
- scene parameter paths;
- Scene/Camera3/Tesseract/Debug/Hierarchy/Inspector feature imports;
- `AppRuntimeContext`;
- actor ids in persisted layout;
- root/floating duplicate tab chrome implementations.

## Fixture Evidence

The product-free fixture is the extraction rehearsal. It must continue to prove:

- root frame, floating frame, menu, tabs, close actions, and persistence work
  without product feature installers;
- generic multi-instance views hydrate from logical identity;
- inactive tab content is not visible or interactable;
- tab close hit rect stays inside the tab rect on the current narrow viewport.

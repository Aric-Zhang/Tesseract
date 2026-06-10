# Project Prism Phase 4 State Domain Map

This report is generated from the Phase 4E classification facts in
`apps/wallpaper-tesseract/src/test-support/project-prism-state-domain-map.ts`.
It is intentionally a classification artifact, not a production migration.

## Runtime Scheduler / Runtime-State Candidates

- `SceneFrameClock`, `SceneFrame`, `FrameUpdatable`, `RuntimeDisposable`,
  `RuntimeRegistration`: migrate toward `runtime-core` frame/lifecycle
  contracts.
- `SceneRuntime`, `RuntimeObject`: remain production ownership debt until
  runtime work is scheduled by runtime packages instead of the app-local object
  bus.

## Editor-State Candidates

- `SceneUpdateSource`, `SceneUpdateSourceKind`: editor command/source metadata.
  These must not move into `runtime-core`.

## UI Layout-State Candidates

- `Vec2`, `vec2`, `addVec2`, `cloneVec2`, `equalsVec2`, `assertVec2`: UI
  geometry/value helpers. These belong in UI framework or a shared geometry
  contract, not runtime-core.

## Mixed State To Delete After Split

- `FrameStateController`, `SceneParameterStore`, `SceneCommandSink`,
  `SceneUpdateCommand`, `SceneUpdateOperation`, `ParameterPath`,
  `parameterPath`, `sceneParameterPaths`, and their related event/definition
  types are mixed scene/editor/UI state facts.

Deletion condition: runtime, editor, and UI layout state each have their own
command/state ports, and no package consumes a scene-wide parameter bus.


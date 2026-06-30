export const WORKSPACE_ORDER = Object.freeze([
  "foundation",
  "actor-system",
  "ui-framework",
  "runtime-core",
  "four-rotation",
  "four-camera",
  "four-camera-three",
  "runtime-three",
  "wallpaper-runtime",
  "editor",
  "wallpaper-tesseract"
]);

const dependencyWorkspaces = WORKSPACE_ORDER.slice(0, -1);

const command = (workspace, script) => Object.freeze({ workspace, script });

export const SEQUENCES = Object.freeze({
  test: Object.freeze([
    ...dependencyWorkspaces.flatMap((workspace) => [
      command(workspace, "build"),
      command(workspace, "test")
    ]),
    command("wallpaper-tesseract", "test")
  ]),
  typecheck: Object.freeze([
    ...dependencyWorkspaces.flatMap((workspace) => [
      command(workspace, "typecheck"),
      command(workspace, "build")
    ]),
    command("wallpaper-tesseract", "typecheck")
  ]),
  build: Object.freeze(WORKSPACE_ORDER.map((workspace) => command(workspace, "build"))),
  "prism:smoke:prepare": Object.freeze(
    dependencyWorkspaces.map((workspace) => command(workspace, "build"))
  )
});

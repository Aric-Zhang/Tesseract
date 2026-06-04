import type { SceneCommandSink, SceneUpdateCommand } from "../scene-runtime";

export interface RecordingSceneCommandSink extends SceneCommandSink {
  readonly commands: SceneUpdateCommand[];
}

export function createRecordingSceneCommandSink(
  commands: SceneUpdateCommand[] = []
): RecordingSceneCommandSink {
  return {
    commands,
    submit(command) {
      commands.push(command);
    }
  };
}

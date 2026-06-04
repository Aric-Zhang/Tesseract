import type { RuntimeRegistration } from "../scene-runtime";

export interface RecordingRuntimeRegistrationOptions {
  readonly disposeCall?: string;
  readonly failOnDispose?: boolean;
}

export function createRecordingRuntimeRegistration(
  label: string,
  calls: string[],
  options: RecordingRuntimeRegistrationOptions = {}
): RuntimeRegistration {
  return {
    dispose() {
      calls.push(options.disposeCall ?? label);
      if (options.failOnDispose) {
        throw new Error(`${label} dispose failed`);
      }
    }
  };
}

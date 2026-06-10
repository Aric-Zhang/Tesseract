import type { RuntimeFrame, RuntimeFrameClock } from "runtime-core";
import type { UpdateFrame, UpdateFrameClock as AppUpdateFrameClock } from "../runtime/ports";

export type RuntimeFrameClockAdapter = Pick<RuntimeFrameClock, "tick">;

// Phase 4D bridge. Delete once app scheduling emits RuntimeFrame directly.
export function toRuntimeFrame(frame: UpdateFrame): RuntimeFrame {
  return {
    timeMs: frame.timeMs,
    deltaMs: frame.deltaMs,
    frameIndex: frame.frameIndex
  };
}

export function toRuntimeFrameClock(clock: AppUpdateFrameClock): RuntimeFrameClockAdapter {
  return {
    tick(timeMs) {
      return toRuntimeFrame(clock.tick(timeMs));
    }
  };
}

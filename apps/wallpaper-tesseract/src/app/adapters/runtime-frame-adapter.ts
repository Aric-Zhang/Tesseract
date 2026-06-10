import type { RuntimeFrame } from "runtime-core";
import type { UpdateFrame } from "../../runtime/ports";

export function toRuntimeFrame(frame: UpdateFrame): RuntimeFrame {
  return {
    timeMs: frame.timeMs,
    deltaMs: frame.deltaMs,
    frameIndex: frame.frameIndex
  };
}

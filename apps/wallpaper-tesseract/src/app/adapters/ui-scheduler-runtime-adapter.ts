import type { AppRuntimeContext } from "../../app-runtime";
import type { RuntimeObject, UpdateFrame } from "../../runtime/ports";
import type { UiFrame, UiScheduledService, UiSchedulerRegistration } from "../../window-runtime";

export function registerUiScheduledServiceWithRuntime(
  runtimeContext: Pick<AppRuntimeContext, "registerRuntimeService">,
  service: UiScheduledService
): UiSchedulerRegistration {
  const runtimeObject: RuntimeObject = {
    id: service.id,
    priority: service.priority,
    get enabled() {
      return service.enabled;
    },
    set enabled(value: boolean | undefined) {
      service.enabled = value;
    },
    updateFrame(frame: UpdateFrame) {
      service.updateFrame?.(toUiFrame(frame));
    },
    dispose() {
      service.dispose?.();
    }
  };

  return runtimeContext.registerRuntimeService(runtimeObject);
}

function toUiFrame(frame: UpdateFrame): UiFrame {
  return {
    timeMs: frame.timeMs,
    deltaMs: frame.deltaMs,
    frameIndex: frame.frameIndex
  };
}

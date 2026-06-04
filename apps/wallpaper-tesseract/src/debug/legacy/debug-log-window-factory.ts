import type { AppRuntimeContext, RegisteredObject } from "../../app-runtime";
import { createRegisteredObject } from "../../app-runtime";
import { DebugLogWindow, type DebugLogWindowOptions } from "./debug-log-window";

export type DebugLogWindowCreateOptions = Omit<DebugLogWindowOptions, "commandSink">;
export type DebugLogWindowFactory = (options: DebugLogWindowOptions) => DebugLogWindow;

export function createDebugLogWindow(
  context: AppRuntimeContext,
  options: DebugLogWindowCreateOptions,
  createWindow: DebugLogWindowFactory = (windowOptions) => new DebugLogWindow(windowOptions)
): RegisteredObject<DebugLogWindow> {
  const object = createWindow({
    ...options,
    commandSink: context.commandSink
  });
  let registration = null as ReturnType<AppRuntimeContext["registerLegacyStatefulGizmoObject"]> | null;
  let untrack = null as ReturnType<AppRuntimeContext["trackRegisteredObject"]> | null;

  try {
    registration = context.registerLegacyStatefulGizmoObject(object);
    const handle = createRegisteredObject(object, registration, () => untrack?.dispose());
    untrack = context.trackRegisteredObject(handle);
    return handle;
  } catch (error) {
    registration?.dispose();
    object.dispose();
    throw error;
  }
}

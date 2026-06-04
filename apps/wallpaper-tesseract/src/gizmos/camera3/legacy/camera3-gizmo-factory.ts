import type { AppRuntimeContext, RegisteredObject } from "../../../app-runtime";
import { createRegisteredObject } from "../../../app-runtime";
import { Camera3Gizmo, type Camera3GizmoOptions } from "../camera3-gizmo";

export type LegacyCamera3GizmoFactory = (options: Camera3GizmoOptions) => Camera3Gizmo;

export function createCamera3Gizmo(
  context: AppRuntimeContext,
  options: Camera3GizmoOptions,
  createGizmo: LegacyCamera3GizmoFactory = (gizmoOptions) => new Camera3Gizmo(gizmoOptions)
): RegisteredObject<Camera3Gizmo> {
  const object = createGizmo(options);
  let registration = null as ReturnType<AppRuntimeContext["registerLegacyGizmoObject"]> | null;
  let untrack = null as ReturnType<AppRuntimeContext["trackRegisteredObject"]> | null;

  try {
    registration = context.registerLegacyGizmoObject(object);
    const handle = createRegisteredObject(object, registration, () => untrack?.dispose());
    untrack = context.trackRegisteredObject(handle);
    return handle;
  } catch (error) {
    registration?.dispose();
    object.dispose();
    throw error;
  }
}

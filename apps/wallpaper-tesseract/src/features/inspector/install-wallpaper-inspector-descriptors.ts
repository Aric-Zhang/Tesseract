import {
  type InspectorComponentDescriptorRegistry,
  type InspectorPropertyEditRequest,
  type InspectorPropertyEditResult,
  type InspectorPropertySummary
} from "editor";
import { runtimeCameraProjectionFovConstraints } from "runtime-core";
import {
  type Camera3MotionComponent,
  camera3MotionComponentType,
  type Tesseract4Component,
  tesseract4ComponentType
} from "wallpaper-runtime";

export function installWallpaperInspectorDescriptors(
  registry: InspectorComponentDescriptorRegistry
): void {
  registry.register({
    componentType: camera3MotionComponentType,
    displayName: "Camera3 Motion",
    readProperties(component) {
      return readCamera3MotionProperties(component as Camera3MotionComponent);
    },
    applyEdit(component, request) {
      return applyCamera3MotionEdit(component as Camera3MotionComponent, request);
    }
  });
  registry.register({
    componentType: tesseract4ComponentType,
    displayName: "Tesseract4",
    readProperties(component) {
      return readTesseract4Properties(component as Tesseract4Component);
    }
  });
}

function readCamera3MotionProperties(component: Camera3MotionComponent): readonly InspectorPropertySummary[] {
  const viewState = component.readViewState();
  const orbit = viewState.cameraState.orbit;
  const projection = viewState.cameraState.projection;
  return [
    {
      id: "projection-mode",
      label: "Projection",
      kind: "enum",
      value: viewState.projectionMode
    },
    {
      id: "distance",
      label: "Distance",
      kind: "number",
      value: formatNumber(component.distance)
    },
    {
      id: "yaw",
      label: "Yaw",
      kind: "number",
      value: orbit ? formatRadians(orbit.yaw) : "n/a"
    },
    {
      id: "pitch",
      label: "Pitch",
      kind: "number",
      value: orbit ? formatRadians(orbit.pitch) : "n/a"
    },
    {
      id: "fov",
      label: "FOV",
      kind: "number",
      value: projection?.fov !== undefined ? formatDegrees(projection.fov) : "n/a",
      edit: projection?.fov !== undefined
        ? {
            control: "number",
            value: projection.fov,
            min: runtimeCameraProjectionFovConstraints.min,
            max: runtimeCameraProjectionFovConstraints.max,
            step: runtimeCameraProjectionFovConstraints.step
          }
        : undefined
    }
  ];
}

function applyCamera3MotionEdit(
  component: Camera3MotionComponent,
  request: InspectorPropertyEditRequest
): InspectorPropertyEditResult {
  if (request.propertyId !== "fov") {
    return { accepted: false, reason: `Camera3 Motion cannot edit property ${request.propertyId}.` };
  }
  try {
    component.submit({
      type: "set-projection-fov",
      source: request.source,
      fov: request.value
    });
    return { accepted: true };
  } catch (error) {
    return {
      accepted: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

function readTesseract4Properties(component: Tesseract4Component): readonly InspectorPropertySummary[] {
  return [
    {
      id: "component-id",
      label: "Component ID",
      kind: "text",
      value: component.id
    },
    {
      id: "component-type",
      label: "Component Type",
      kind: "text",
      value: component.type
    }
  ];
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "n/a";
}

function formatRadians(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(3)} rad` : "n/a";
}

function formatDegrees(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(2)} deg` : "n/a";
}

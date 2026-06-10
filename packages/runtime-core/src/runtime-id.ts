type RuntimeId<Brand extends string> = string & { readonly __runtimeIdBrand: Brand };

export type RuntimeWorldId = RuntimeId<"RuntimeWorldId">;
export type RuntimeCameraId = RuntimeId<"RuntimeCameraId">;
export type RuntimeProjectionId = RuntimeId<"RuntimeProjectionId">;
export type RuntimeFrameSourceId = RuntimeId<"RuntimeFrameSourceId">;
export type RuntimeNodeId = RuntimeWorldId | RuntimeCameraId | RuntimeProjectionId | RuntimeFrameSourceId;

export function runtimeWorldId(value: string): RuntimeWorldId {
  return createRuntimeId(value, "RuntimeWorldId");
}

export function runtimeCameraId(value: string): RuntimeCameraId {
  return createRuntimeId(value, "RuntimeCameraId");
}

export function runtimeProjectionId(value: string): RuntimeProjectionId {
  return createRuntimeId(value, "RuntimeProjectionId");
}

export function runtimeFrameSourceId(value: string): RuntimeFrameSourceId {
  return createRuntimeId(value, "RuntimeFrameSourceId");
}

const forbiddenEditorUiIdentityWords = [
  "viewActorId",
  "frameActorId",
  "window",
  "tab"
] as const;

function createRuntimeId<Brand extends string>(value: string, label: Brand): RuntimeId<Brand> {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty opaque id.`);
  }
  const editorUiIdentityPattern = new RegExp(`\\b(?:${forbiddenEditorUiIdentityWords.join("|")})\\b`, "i");
  if (editorUiIdentityPattern.test(value)) {
    throw new Error(`${label} must not be derived from editor UI identity.`);
  }
  return value as RuntimeId<Brand>;
}

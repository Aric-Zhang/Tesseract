import type { RuntimeObject, RuntimeRegistration } from "./update-frame";

export interface RuntimeObjectRegistry {
  register(object: RuntimeObject): RuntimeRegistration;
  dispose(): void;
}


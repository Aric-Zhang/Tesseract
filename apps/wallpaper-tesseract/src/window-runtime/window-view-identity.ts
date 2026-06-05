import type { WindowViewKey } from "./window-view-key";
import { windowViewKey } from "./window-view-key";

export type WindowViewTypeKey = "scene" | "debug" | "hierarchy" | (string & {});

export type WindowViewInstanceId = string & { readonly __windowViewInstanceIdBrand: "WindowViewInstanceId" };

export type WindowViewMultiplicity = "singleton" | "multi-instance";

export interface WindowViewIdentity {
  /**
   * Current menu and persistence identity. For singleton views this remains the
   * stable value used by Window menu actions and persisted layouts.
   */
  readonly viewKey: WindowViewKey;
  /**
   * Future multi-instance grouping identity. Several view instances may share
   * one type key while keeping distinct view keys or instance ids.
   */
  readonly typeKey: WindowViewTypeKey;
  /**
   * Future stable instance identity. Singleton views intentionally keep this
   * null so current persisted layouts do not grow a second identity field yet.
   */
  readonly instanceId: WindowViewInstanceId | null;
  readonly multiplicity: WindowViewMultiplicity;
}

export function windowViewTypeKey(value: string): WindowViewTypeKey {
  return value as WindowViewTypeKey;
}

export function windowViewInstanceId(value: string): WindowViewInstanceId {
  return value as WindowViewInstanceId;
}

export function createSingletonWindowViewIdentity(
  viewKey: WindowViewKey,
  typeKey: WindowViewTypeKey = windowViewTypeKey(viewKey)
): WindowViewIdentity {
  return {
    viewKey,
    typeKey,
    instanceId: null,
    multiplicity: "singleton"
  };
}

export function createWindowViewKeyFromTypeAndInstance(
  typeKey: WindowViewTypeKey,
  instanceId: WindowViewInstanceId
): WindowViewKey {
  return windowViewKey(`${typeKey}:${instanceId}`);
}

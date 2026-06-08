import type { WindowViewKey } from "./window-view-key";
import { windowViewKey } from "./window-view-key";

export type WindowViewTypeKey = string & {};

export type WindowViewInstanceId = string & { readonly __windowViewInstanceIdBrand: "WindowViewInstanceId" };
export type WindowViewIdentityKey = string & { readonly __windowViewIdentityKeyBrand: "WindowViewIdentityKey" };

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
   * Stable logical instance identity. This id is globally opaque and must not
   * be blindly concatenated with the type key.
   */
  readonly instanceId: WindowViewInstanceId;
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
    instanceId: windowViewInstanceId(`${typeKey}:default`),
    multiplicity: "singleton"
  };
}

export function createWindowViewIdentity(options: {
  readonly viewKey: WindowViewKey;
  readonly typeKey?: WindowViewTypeKey;
  readonly instanceId?: WindowViewInstanceId | null;
  readonly multiplicity?: WindowViewMultiplicity;
}): WindowViewIdentity {
  const typeKey = options.typeKey ?? windowViewTypeKey(options.viewKey);
  const multiplicity = options.multiplicity ?? "singleton";
  return {
    viewKey: options.viewKey,
    typeKey,
    instanceId: options.instanceId ?? multiplicityDefaultInstanceId(options.viewKey, typeKey, multiplicity),
    multiplicity
  };
}

export function createWindowViewIdentityKey(identity: WindowViewIdentity): WindowViewIdentityKey {
  return `instance:${identity.instanceId}` as WindowViewIdentityKey;
}

export function createWindowViewKeyFromTypeAndInstance(
  typeKey: WindowViewTypeKey,
  instanceId: WindowViewInstanceId
): WindowViewKey {
  void typeKey;
  return windowViewKey(instanceId);
}

function multiplicityDefaultInstanceId(
  viewKey: WindowViewKey,
  typeKey: WindowViewTypeKey,
  multiplicity: WindowViewMultiplicity
): WindowViewInstanceId {
  return multiplicity === "multi-instance"
    ? windowViewInstanceId(viewKey)
    : windowViewInstanceId(`${typeKey}:default`);
}

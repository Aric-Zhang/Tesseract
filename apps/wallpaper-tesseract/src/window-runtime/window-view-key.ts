export type WindowViewKey = "scene" | "debug" | "hierarchy" | (string & {});

export function windowViewKey(value: string): WindowViewKey {
  return value as WindowViewKey;
}

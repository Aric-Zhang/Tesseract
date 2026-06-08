export type WindowViewKey = string & {};

export function windowViewKey(value: string): WindowViewKey {
  return value as WindowViewKey;
}

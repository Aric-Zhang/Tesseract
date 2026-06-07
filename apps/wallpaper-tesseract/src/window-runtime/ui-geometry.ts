export interface UiVec2 {
  x: number;
  y: number;
}

export type UiPoint = UiVec2;
export type UiSize = UiVec2;

export function uiVec2(x: number, y: number): UiVec2 {
  return { x, y };
}

export function addUiVec2(value: UiVec2, delta: UiVec2): UiVec2 {
  return { x: value.x + delta.x, y: value.y + delta.y };
}

export function cloneUiVec2(value: UiVec2): UiVec2 {
  return { x: value.x, y: value.y };
}

export function equalsUiVec2(a: UiVec2, b: UiVec2): boolean {
  return a.x === b.x && a.y === b.y;
}

export function assertUiVec2(value: unknown): asserts value is UiVec2 {
  if (
    !value ||
    typeof value !== "object" ||
    !("x" in value) ||
    !("y" in value) ||
    !Number.isFinite((value as UiVec2).x) ||
    !Number.isFinite((value as UiVec2).y)
  ) {
    throw new Error("Expected a finite UiVec2 value.");
  }
}

export interface Vec2 {
  x: number;
  y: number;
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function addVec2(value: Vec2, delta: Vec2): Vec2 {
  return { x: value.x + delta.x, y: value.y + delta.y };
}

export function cloneVec2(value: Vec2): Vec2 {
  return { x: value.x, y: value.y };
}

export function equalsVec2(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

export function assertVec2(value: unknown): asserts value is Vec2 {
  if (
    !value ||
    typeof value !== "object" ||
    !("x" in value) ||
    !("y" in value) ||
    !Number.isFinite((value as Vec2).x) ||
    !Number.isFinite((value as Vec2).y)
  ) {
    throw new Error("Expected a finite Vec2 value.");
  }
}

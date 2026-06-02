import { EPSILON4D } from "four-rotation";

export interface SegmentClip {
  t0: number;
  t1: number;
}

export function clipSegmentNearFar(u0: number, u1: number, safeNear: number, far: number): SegmentClip | null {
  return clipSegmentByURange(u0, u1, safeNear, far);
}

export function clipSegmentByURange(u0: number, u1: number, minU: number, maxU = Infinity): SegmentClip | null {
  if (!Number.isFinite(u0) || !Number.isFinite(u1) || !Number.isFinite(minU) || Number.isNaN(maxU)) {
    return null;
  }
  if (Number.isFinite(maxU) && maxU < minU) {
    return null;
  }

  let t0 = 0;
  let t1 = 1;
  const du = u1 - u0;

  const lower = clipHalfSpace(u0 - minU, u1 - minU, t0, t1);
  if (!lower) return null;
  t0 = lower.t0;
  t1 = lower.t1;

  if (Number.isFinite(maxU)) {
    const upper = clipHalfSpace(maxU - u0, maxU - u1, t0, t1);
    if (!upper) return null;
    t0 = upper.t0;
    t1 = upper.t1;
  }

  if (Math.abs(du) <= EPSILON4D && (u0 < minU || u0 > maxU)) {
    return null;
  }
  return { t0, t1 };
}

function clipHalfSpace(value0: number, value1: number, currentT0: number, currentT1: number): SegmentClip | null {
  if (value0 < 0 && value1 < 0) return null;
  if (value0 >= 0 && value1 >= 0) return { t0: currentT0, t1: currentT1 };

  const t = value0 / (value0 - value1);
  if (value0 < 0) {
    const t0 = Math.max(currentT0, t);
    return t0 <= currentT1 ? { t0, t1: currentT1 } : null;
  }
  const t1 = Math.min(currentT1, t);
  return currentT0 <= t1 ? { t0: currentT0, t1 } : null;
}

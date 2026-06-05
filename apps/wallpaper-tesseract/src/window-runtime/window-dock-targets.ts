export type WindowDockSplitPlacement = "left" | "right" | "top" | "bottom";

export interface WindowDockPoint {
  readonly x: number;
  readonly y: number;
}

export interface WindowDockRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface WindowDockTargetFrame {
  readonly frameId: string;
  readonly stackPriority: number;
  readonly bounds: WindowDockRect;
  readonly tabBounds: WindowDockRect;
  readonly contentBounds: WindowDockRect;
}

export type WindowDockPreview =
  | {
      readonly kind: "merge-tabs";
      readonly targetFrameId: string;
      readonly rect: WindowDockRect;
    }
  | {
      readonly kind: "split";
      readonly targetFrameId: string;
      readonly placement: WindowDockSplitPlacement;
      readonly rect: WindowDockRect;
    }
  | {
      readonly kind: "floating";
      readonly rect: WindowDockRect;
    };

export interface ResolveWindowDockPreviewOptions {
  readonly sourceFrameId?: string;
  readonly floatingSize?: { readonly width: number; readonly height: number };
}

const CONTENT_EDGE_RATIO = 0.26;
const DEFAULT_FLOATING_SIZE = { width: 260, height: 180 };

export function resolveWindowDockPreview(
  point: WindowDockPoint,
  frames: readonly WindowDockTargetFrame[],
  options: ResolveWindowDockPreviewOptions = {}
): WindowDockPreview {
  const candidates = frames
    .filter((frame) => frame.frameId !== options.sourceFrameId)
    .filter((frame) => containsPoint(frame.bounds, point))
    .sort((a, b) => b.stackPriority - a.stackPriority);
  const target = candidates[0];
  if (!target) {
    return createFloatingPreview(point, options.floatingSize);
  }
  if (containsPoint(target.tabBounds, point)) {
    return {
      kind: "merge-tabs",
      targetFrameId: target.frameId,
      rect: target.tabBounds
    };
  }
  if (!containsPoint(target.contentBounds, point)) {
    return createFloatingPreview(point, options.floatingSize);
  }
  const placement = resolveContentPlacement(point, target.contentBounds);
  if (!placement) {
    return createFloatingPreview(point, options.floatingSize);
  }
  return {
    kind: "split",
    targetFrameId: target.frameId,
    placement,
    rect: createSplitPreviewRect(target.contentBounds, placement)
  };
}

export function rectFromDomRect(rect: DOMRectReadOnly): WindowDockRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  };
}

function containsPoint(rect: WindowDockRect, point: WindowDockPoint): boolean {
  return point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom;
}

function resolveContentPlacement(
  point: WindowDockPoint,
  rect: WindowDockRect
): WindowDockSplitPlacement | null {
  const edgeWidth = rect.width * CONTENT_EDGE_RATIO;
  const edgeHeight = rect.height * CONTENT_EDGE_RATIO;
  const distances = [
    { placement: "left" as const, distance: point.x - rect.left, threshold: edgeWidth },
    { placement: "right" as const, distance: rect.right - point.x, threshold: edgeWidth },
    { placement: "top" as const, distance: point.y - rect.top, threshold: edgeHeight },
    { placement: "bottom" as const, distance: rect.bottom - point.y, threshold: edgeHeight }
  ].filter((candidate) => candidate.distance >= 0 && candidate.distance <= candidate.threshold)
    .sort((a, b) => a.distance - b.distance);
  return distances[0]?.placement ?? null;
}

function createSplitPreviewRect(
  rect: WindowDockRect,
  placement: WindowDockSplitPlacement
): WindowDockRect {
  const splitWidth = rect.width * 0.34;
  const splitHeight = rect.height * 0.34;
  if (placement === "left") {
    return createRect(rect.left, rect.top, splitWidth, rect.height);
  }
  if (placement === "right") {
    return createRect(rect.right - splitWidth, rect.top, splitWidth, rect.height);
  }
  if (placement === "top") {
    return createRect(rect.left, rect.top, rect.width, splitHeight);
  }
  return createRect(rect.left, rect.bottom - splitHeight, rect.width, splitHeight);
}

function createFloatingPreview(
  point: WindowDockPoint,
  size: ResolveWindowDockPreviewOptions["floatingSize"] = DEFAULT_FLOATING_SIZE
): WindowDockPreview {
  return {
    kind: "floating",
    rect: createRect(
      point.x - size.width / 2,
      point.y - 18,
      size.width,
      size.height
    )
  };
}

function createRect(left: number, top: number, width: number, height: number): WindowDockRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}

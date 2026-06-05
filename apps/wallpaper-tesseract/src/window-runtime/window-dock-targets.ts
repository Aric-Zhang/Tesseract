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

export interface WindowDockTargetRegion {
  readonly frameId: string;
  readonly targetTabsetId: string;
  readonly stackPriority: number;
  readonly bounds: WindowDockRect;
  readonly tabBounds: WindowDockRect;
  readonly contentBounds: WindowDockRect;
}

// Compatibility alias while the docking code migrates from frame-level naming to
// tabset-region naming.
export type WindowDockTargetFrame = WindowDockTargetRegion;

export type WindowDockPreview =
  | {
      readonly kind: "merge-tabs";
      readonly targetFrameId: string;
      readonly targetTabsetId: string;
      readonly rect: WindowDockRect;
    }
  | {
      readonly kind: "split";
      readonly targetFrameId: string;
      readonly targetTabsetId: string;
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
  regions: readonly WindowDockTargetRegion[],
  options: ResolveWindowDockPreviewOptions = {}
): WindowDockPreview {
  const candidates = regions
    .map((region, sourceOrder) => createDockPreviewCandidate(point, region, sourceOrder, options.sourceFrameId))
    .filter((candidate): candidate is WindowDockPreviewCandidate => candidate !== null)
    .sort(compareDockPreviewCandidates);
  return candidates[0]?.preview ?? createFloatingPreview(point, options.floatingSize);
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

interface WindowDockPreviewCandidate {
  readonly preview: Exclude<WindowDockPreview, { readonly kind: "floating" }>;
  readonly stackPriority: number;
  readonly kindRank: number;
  readonly area: number;
  readonly sourceOrder: number;
}

function createDockPreviewCandidate(
  point: WindowDockPoint,
  region: WindowDockTargetRegion,
  sourceOrder: number,
  sourceFrameId: string | undefined
): WindowDockPreviewCandidate | null {
  if (region.frameId === sourceFrameId) return null;
  if (containsPoint(region.tabBounds, point)) {
    return {
      preview: {
        kind: "merge-tabs",
        targetFrameId: region.frameId,
        targetTabsetId: region.targetTabsetId,
        rect: region.tabBounds
      },
      stackPriority: region.stackPriority,
      kindRank: 1,
      area: rectArea(region.tabBounds),
      sourceOrder
    };
  }
  if (!containsPoint(region.contentBounds, point)) return null;
  const placement = resolveContentPlacement(point, region.contentBounds);
  if (!placement) return null;
  return {
    preview: {
      kind: "split",
      targetFrameId: region.frameId,
      targetTabsetId: region.targetTabsetId,
      placement,
      rect: createSplitPreviewRect(region.contentBounds, placement)
    },
    stackPriority: region.stackPriority,
    kindRank: 0,
    area: rectArea(region.contentBounds),
    sourceOrder
  };
}

function compareDockPreviewCandidates(
  a: WindowDockPreviewCandidate,
  b: WindowDockPreviewCandidate
): number {
  return b.stackPriority - a.stackPriority ||
    b.kindRank - a.kindRank ||
    a.area - b.area ||
    a.sourceOrder - b.sourceOrder;
}

function rectArea(rect: WindowDockRect): number {
  return rect.width * rect.height;
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

import type { ScreenPoint } from "actor-input";

export function isElementExposedAtPoint(element: HTMLElement, point: ScreenPoint): boolean {
  const elementsFromPoint = element.ownerDocument?.elementsFromPoint?.bind(element.ownerDocument);
  if (!elementsFromPoint) return true;
  const topElement = elementsFromPoint(point.x, point.y)[0] ?? null;
  if (!topElement) return true;
  return isSameOrDescendant(element, topElement);
}

function isSameOrDescendant(ancestor: HTMLElement, candidate: Element): boolean {
  let current: Element | null = candidate;
  while (current) {
    if (current === ancestor) return true;
    current = current.parentElement;
  }
  return false;
}

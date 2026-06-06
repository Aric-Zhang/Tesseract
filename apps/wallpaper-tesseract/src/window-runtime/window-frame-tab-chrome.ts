import type { ScreenPoint } from "gizmo-core";
import type { WindowFrameDockTreeTabsetNode } from "./window-frame-dock-tree";
import type { WindowFrameTab } from "./window-frame-port";
import { createWindowTabCloseAction, type WindowTabAction } from "./window-tab-action";

export const WINDOW_FRAME_TAB_PART_ID = "window-tab";
export const WINDOW_FRAME_TAB_ACTION_PART_ID = "window-tab-action";

export interface WindowFrameTabChromeMaps {
  readonly tabsByViewActorId: Map<string, HTMLDivElement>;
  readonly actionsByViewActorId: Map<string, HTMLButtonElement>;
}

export interface RenderWindowFrameTabsetOptions {
  readonly document: Pick<Document, "createElement">;
  readonly tabs: readonly WindowFrameTab[];
  readonly tabset: WindowFrameDockTreeTabsetNode;
  readonly target: HTMLElement;
  readonly maps: WindowFrameTabChromeMaps;
  readonly tabClassName?: string;
  readonly closeClassName?: string;
}

export function renderWindowFrameTabsetTabs(options: RenderWindowFrameTabsetOptions): void {
  const tabClassName = joinClassNames("window-frame-tab", options.tabClassName);
  const closeClassName = joinClassNames("window-frame-tab__close", options.closeClassName);
  for (const tab of options.tabs) {
    if (!options.tabset.tabs.includes(tab.viewActorId)) continue;
    const element = options.document.createElement("div");
    element.className = joinClassNames(
      tabClassName,
      tab.viewActorId === options.tabset.activeViewActorId ? "is-active" : undefined
    );
    element.textContent = tab.title;
    const close = options.document.createElement("button");
    close.className = closeClassName;
    close.type = "button";
    close.tabIndex = -1;
    close.ariaLabel = `Close ${tab.title}`;
    close.textContent = "x";
    element.append(close);
    options.maps.tabsByViewActorId.set(tab.viewActorId, element);
    options.maps.actionsByViewActorId.set(tab.viewActorId, close);
    options.target.append(element);
  }
}

export function findWindowFrameTabAtPoint(
  tabs: readonly WindowFrameTab[],
  elementsByViewActorId: ReadonlyMap<string, HTMLElement>,
  point: ScreenPoint
): WindowFrameTab | null {
  for (const tab of tabs) {
    const element = elementsByViewActorId.get(tab.viewActorId);
    if (element && isPointInsideRect(point, element.getBoundingClientRect())) {
      return tab;
    }
  }
  return null;
}

export function findWindowFrameTabActionAtPoint(
  tabs: readonly WindowFrameTab[],
  actionElementsByViewActorId: ReadonlyMap<string, HTMLElement>,
  point: ScreenPoint
): WindowTabAction | null {
  for (const tab of tabs) {
    const element = actionElementsByViewActorId.get(tab.viewActorId);
    if (element && isPointInsideRect(point, element.getBoundingClientRect())) {
      return createWindowTabCloseAction(tab);
    }
  }
  return null;
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom;
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

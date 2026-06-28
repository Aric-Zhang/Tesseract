import {
  WINDOW_FULLSCREEN_PRESENTATION_LAYER,
  WINDOW_TOP_DOCKED_CHROME_LAYER
} from "ui-framework";

export interface WallpaperAppShell {
  readonly root: HTMLElement;
  readonly menuSlot: HTMLElement;
  readonly toolbarSlot: HTMLElement;
  readonly rootDockSlot: HTMLElement;
  readonly statusSlot: HTMLElement;
  readonly floatingOverlaySlot: HTMLElement;
  dispose(): void;
}

export function createWallpaperAppShell(parent: HTMLElement): WallpaperAppShell {
  const documentRef = parent.ownerDocument ?? document;
  const root = documentRef.createElement("div");
  const menuSlot = documentRef.createElement("div");
  const toolbarSlot = documentRef.createElement("div");
  const rootDockSlot = documentRef.createElement("div");
  const statusSlot = documentRef.createElement("div");
  const floatingOverlaySlot = documentRef.createElement("div");

  root.className = "app-shell";
  menuSlot.className = "app-shell__menu";
  toolbarSlot.className = "app-shell__toolbar";
  rootDockSlot.className = "app-shell__root-dock";
  statusSlot.className = "app-shell__status";
  floatingOverlaySlot.className = "app-shell__floating-overlay";
  root.style.setProperty("--window-top-docked-chrome-layer", String(WINDOW_TOP_DOCKED_CHROME_LAYER));
  root.style.setProperty("--window-fullscreen-presentation-layer", String(WINDOW_FULLSCREEN_PRESENTATION_LAYER));

  toolbarSlot.hidden = true;
  statusSlot.hidden = true;

  root.append(menuSlot, toolbarSlot, rootDockSlot, statusSlot, floatingOverlaySlot);
  parent.replaceChildren(root);

  return {
    root,
    menuSlot,
    toolbarSlot,
    rootDockSlot,
    statusSlot,
    floatingOverlaySlot,
    dispose() {
      root.remove();
    }
  };
}

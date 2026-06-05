import type { WindowContentHost } from "./floating-window-host";
import type { WindowDockRect } from "./window-dock-targets";
import type { WindowViewKey } from "./window-view-key";

export interface WindowFrameTab {
  readonly viewActorId: string;
  readonly viewKey: WindowViewKey;
  readonly title: string;
}

export interface WindowFramePort {
  readonly frameId: string;

  listTabs(): readonly WindowFrameTab[];
  getActiveViewActorId(): string | null;
  addTab(tab: WindowFrameTab, options?: { readonly active?: boolean }): void;
  removeTab(viewActorId: string): void;
  activateTab(viewActorId: string): void;
  hasTab(viewActorId: string): boolean;
  getContentHost(viewActorId: string): WindowContentHost;
  getFloatingBounds(): WindowDockRect;
}

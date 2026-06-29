export interface TreeViewActivation {
  readonly itemActorId: string;
  readonly itemId: string;
  readonly inputKind: "pointer" | "keyboard";
}

export interface TreeViewActivationSink {
  activateTreeItem(activation: TreeViewActivation): void;
}

export interface TreeViewItemDescriptor {
  readonly itemId: string;
  readonly label: string;
  readonly parentItemId?: string | null;
  readonly order?: number;
  readonly selected?: boolean;
  readonly enabled?: boolean;
  readonly muted?: boolean;
}

export type TreeViewItemUpdate = Partial<TreeViewItemDescriptor>;

export interface ListViewItemDescriptor {
  readonly itemId: string;
  readonly text: string;
  readonly order?: number;
  readonly selected?: boolean;
  readonly enabled?: boolean;
  readonly muted?: boolean;
}

export type ListViewItemUpdate = Partial<ListViewItemDescriptor>;

export interface VirtualListItemSnapshot {
  readonly key: string;
  readonly text: string;
  readonly selected?: boolean;
  readonly enabled?: boolean;
  readonly muted?: boolean;
}

export interface VirtualListDataSource {
  readonly revision: number;
  getItemCount(): number;
  getItem(index: number): VirtualListItemSnapshot;
}

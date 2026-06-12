export interface HierarchyObjectItem {
  readonly id: string;
  readonly label: string;
  readonly parentId?: string | null;
  readonly activeSelf?: boolean;
  readonly activeInHierarchy?: boolean;
}

export interface HierarchyObjectSource {
  listObjects(): readonly HierarchyObjectItem[];
}

export function createStaticHierarchyObjectSource(
  items: readonly HierarchyObjectItem[]
): HierarchyObjectSource {
  const snapshot = items.map((item) => ({ ...item }));
  return {
    listObjects() {
      return snapshot.map((item) => ({ ...item }));
    }
  };
}

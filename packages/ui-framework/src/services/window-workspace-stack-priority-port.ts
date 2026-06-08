import type { WindowFramePortRegistryEntry, WindowFramePortRegistryView } from "../ports/window-frame-port-registry";

export interface WindowWorkspaceStackPriorityPort {
  setFrameStackPriority(frameActorId: string, priority: number): void;
}

export function createWindowWorkspaceStackPriorityPort(
  framePorts: WindowFramePortRegistryView
): WindowWorkspaceStackPriorityPort {
  return {
    setFrameStackPriority(frameActorId, priority) {
      const entry = framePorts.list()
        .find((candidate) => candidate.frameActor.id === frameActorId);
      entry?.setStackPriority?.(priority);
    }
  };
}

export function isWindowFrameStackManaged(entry: WindowFramePortRegistryEntry): boolean {
  return typeof entry.setStackPriority === "function";
}

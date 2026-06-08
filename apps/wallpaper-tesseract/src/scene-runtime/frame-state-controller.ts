import type {
  RuntimeObject,
  RuntimeRegistration,
  StateChange,
  StateChangedEvent,
  StateObserver,
  UpdateFrame
} from "../runtime/ports";
import { SceneParameterStore } from "./scene-parameter-store";
import type { ParameterPath, SceneCommandSink, SceneUpdateCommand } from "./scene-update-command";
import type { SceneUpdateSource } from "./scene-update-source";

export interface FrameStateControllerOptions {
  store: SceneParameterStore;
}

export type SceneParameterChange<TValue = unknown> =
  StateChange<ParameterPath, TValue, SceneUpdateSource, SceneUpdateCommand>;

export type SceneStateChangedEvent =
  StateChangedEvent<ParameterPath, SceneUpdateSource, SceneUpdateCommand>;

export type SceneStateObserver = StateObserver<SceneStateChangedEvent>;

interface QueuedCommand {
  command: SceneUpdateCommand;
  order: number;
}

export class FrameStateController implements SceneCommandSink, RuntimeObject {
  readonly id = "frame-state-controller";
  readonly priority = -1000;
  enabled = true;
  private readonly store: SceneParameterStore;
  private readonly observers: SceneStateObserver[] = [];
  private pendingCommands: QueuedCommand[] = [];
  private nextOrder = 0;

  constructor(options: FrameStateControllerOptions) {
    this.store = options.store;
  }

  submit(command: SceneUpdateCommand): void {
    this.store.validateCommand(command);
    this.pendingCommands.push({
      command,
      order: this.nextOrder++
    });
  }

  subscribe(observer: SceneStateObserver): RuntimeRegistration {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
    return {
      dispose: () => {
        const index = this.observers.indexOf(observer);
        if (index >= 0) {
          this.observers.splice(index, 1);
        }
      }
    };
  }

  updateFrame(frame: UpdateFrame): void {
    const commands = this.pendingCommands;
    this.pendingCommands = [];
    if (commands.length === 0) return;

    const changes: SceneParameterChange[] = [];
    for (const [path, group] of groupCommandsByPath(commands)) {
      const change = this.commitPath(path, group);
      if (change) {
        changes.push(change);
      }
    }

    if (changes.length > 0) {
      const event = { frame, changes };
      for (const observer of [...this.observers]) {
        observer.onStateChanged(event);
      }
    }
  }

  dispose(): void {
    this.pendingCommands = [];
    this.observers.length = 0;
  }

  private commitPath(path: ParameterPath, queuedCommands: QueuedCommand[]): SceneParameterChange | null {
    const highestPriority = Math.max(...queuedCommands.map(({ command }) => command.priority ?? 0));
    const selected = queuedCommands
      .filter(({ command }) => (command.priority ?? 0) === highestPriority)
      .sort((a, b) => a.order - b.order);
    const definition = this.store.getDefinition(path);
    let nextValue = this.store.get(path);
    let hasBaseCommand = false;

    for (const queued of selected) {
      const command = queued.command;
      if (command.operation === "set") {
        nextValue = command.value;
        hasBaseCommand = true;
      } else if (command.operation === "reset") {
        nextValue = this.store.getInitialValue(path);
        hasBaseCommand = true;
      }
    }

    if (!hasBaseCommand) {
      nextValue = this.store.get(path);
    }

    for (const queued of selected) {
      const command = queued.command;
      if (command.operation === "add") {
        if (!definition.add) {
          throw new Error(`SceneParameterStore parameter does not support add(): ${path}`);
        }
        nextValue = definition.add(nextValue, command.delta);
      }
    }

    const previousValue = this.store.get(path);
    const changed = this.store.commit(path, nextValue);
    if (!changed) return null;

    return {
      path,
      previousValue,
      nextValue: this.store.get(path),
      sources: selected.map(({ command }) => command.source),
      commands: selected.map(({ command }) => command)
    };
  }
}

function groupCommandsByPath(commands: QueuedCommand[]): Map<ParameterPath, QueuedCommand[]> {
  const groups = new Map<ParameterPath, QueuedCommand[]>();
  for (const command of commands) {
    const group = groups.get(command.command.target);
    if (group) {
      group.push(command);
    } else {
      groups.set(command.command.target, [command]);
    }
  }
  return groups;
}

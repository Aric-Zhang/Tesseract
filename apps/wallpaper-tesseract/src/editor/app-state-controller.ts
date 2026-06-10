import type {
  RuntimeObject,
  RuntimeRegistration,
  StateChange,
  StateChangedEvent,
  StateObserver,
  UpdateFrame
} from "../runtime/ports";
import type { AppStateCommand, AppStateCommandSource } from "./app-state";
import { AppStateParameterStore } from "./app-state-store";

export interface AppFrameStateControllerOptions {
  store: AppStateParameterStore;
}

export type AppStateChange<TValue = unknown> =
  StateChange<string, TValue, AppStateCommandSource, AppStateCommand>;

export type AppStateChangedEvent =
  StateChangedEvent<string, AppStateCommandSource, AppStateCommand>;

export type AppStateObserver = StateObserver<AppStateChangedEvent>;

interface QueuedCommand {
  command: AppStateCommand;
  order: number;
}

export class AppFrameStateController implements RuntimeObject {
  readonly id = "app-frame-state-controller";
  readonly priority = -1000;
  enabled = true;
  readonly #store: AppStateParameterStore;
  readonly #observers: AppStateObserver[] = [];
  #pendingCommands: QueuedCommand[] = [];
  #nextOrder = 0;

  constructor(options: AppFrameStateControllerOptions) {
    this.#store = options.store;
  }

  submit(command: AppStateCommand): void {
    this.#store.validateCommand(command);
    this.#pendingCommands.push({
      command,
      order: this.#nextOrder++
    });
  }

  subscribe(observer: AppStateObserver): RuntimeRegistration {
    if (!this.#observers.includes(observer)) {
      this.#observers.push(observer);
    }
    return {
      dispose: () => {
        const index = this.#observers.indexOf(observer);
        if (index >= 0) {
          this.#observers.splice(index, 1);
        }
      }
    };
  }

  updateFrame(frame: UpdateFrame): void {
    const commands = this.#pendingCommands;
    this.#pendingCommands = [];
    if (commands.length === 0) return;

    const changes: AppStateChange[] = [];
    for (const [path, group] of groupCommandsByPath(commands)) {
      const change = this.#commitPath(path, group);
      if (change) {
        changes.push(change);
      }
    }

    if (changes.length > 0) {
      const event = { frame, changes };
      for (const observer of [...this.#observers]) {
        observer.onStateChanged(event);
      }
    }
  }

  dispose(): void {
    this.#pendingCommands = [];
    this.#observers.length = 0;
  }

  #commitPath(path: string, queuedCommands: QueuedCommand[]): AppStateChange | null {
    const highestPriority = Math.max(...queuedCommands.map(({ command }) => command.priority ?? 0));
    const selected = queuedCommands
      .filter(({ command }) => (command.priority ?? 0) === highestPriority)
      .sort((a, b) => a.order - b.order);
    const definition = this.#store.getDefinition(path);
    let nextValue = this.#store.get(path);
    let hasBaseCommand = false;

    for (const queued of selected) {
      const command = queued.command;
      if (command.operation === "set") {
        nextValue = command.value;
        hasBaseCommand = true;
      } else if (command.operation === "reset") {
        nextValue = this.#store.getInitialValue(path);
        hasBaseCommand = true;
      }
    }

    if (!hasBaseCommand) {
      nextValue = this.#store.get(path);
    }

    for (const queued of selected) {
      const command = queued.command;
      if (command.operation === "add") {
        if (!definition.add) {
          throw new Error(`AppStateParameterStore parameter does not support add(): ${path}`);
        }
        nextValue = definition.add(nextValue, command.delta);
      }
    }

    const previousValue = this.#store.get(path);
    const changed = this.#store.commit(path, nextValue);
    if (!changed) return null;

    return {
      path,
      previousValue,
      nextValue: this.#store.get(path),
      sources: selected.map(({ command }) => command.source),
      commands: selected.map(({ command }) => command)
    };
  }
}

function groupCommandsByPath(commands: QueuedCommand[]): Map<string, QueuedCommand[]> {
  const groups = new Map<string, QueuedCommand[]>();
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

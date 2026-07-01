import type { ActorSystemView } from "actor-system/core";
import type { UiFrame, UiScheduledService } from "ui-framework/actor-ui";
import type { InspectorComponentDescriptorRegistry } from "./inspector-component-descriptor-registry";
import type {
  InspectorPropertyEditRequest,
  InspectorPropertyEditResult,
  InspectorPropertyReadContext
} from "./inspector-component-descriptor";

export interface InspectorEditableComponentTarget {
  readonly component: unknown;
  readonly componentType: string;
}

export interface InspectorPropertyEditTargetSource {
  getEditableComponent(actorId: string, componentId: string): InspectorEditableComponentTarget | null;
}

export interface InspectorPropertyEditControllerOptions {
  readonly descriptorRegistry: InspectorComponentDescriptorRegistry;
  readonly targetSource: InspectorPropertyEditTargetSource;
  readonly id?: string;
}

export interface InspectorPropertyEditCommit {
  readonly actorId: string;
  readonly componentId: string;
  readonly componentType: string;
  readonly propertyId: string;
  readonly value: number;
  readonly timeStamp: number;
  readonly source: string;
}

export interface InspectorPropertyEditApplyRecord {
  readonly request: InspectorPropertyEditRequest;
  readonly result: InspectorPropertyEditResult;
}

export class InspectorPropertyEditController implements UiScheduledService {
  readonly id: string;
  enabled = true;

  readonly #descriptorRegistry: InspectorComponentDescriptorRegistry;
  readonly #targetSource: InspectorPropertyEditTargetSource;
  readonly #pendingByKey = new Map<string, InspectorPropertyEditCommit>();
  #disposed = false;
  #revision = 0;
  #lastApplied: readonly InspectorPropertyEditApplyRecord[] = Object.freeze([]);

  constructor(options: InspectorPropertyEditControllerOptions) {
    this.id = options.id ?? "inspector-property-edit-controller";
    this.#descriptorRegistry = options.descriptorRegistry;
    this.#targetSource = options.targetSource;
  }

  get revision(): number {
    return this.#revision;
  }

  get pendingCount(): number {
    return this.#pendingByKey.size;
  }

  get lastApplied(): readonly InspectorPropertyEditApplyRecord[] {
    return this.#lastApplied;
  }

  commit(commit: InspectorPropertyEditCommit): void {
    if (this.#disposed || !this.enabled) return;
    if (!Number.isFinite(commit.value)) return;
    this.#pendingByKey.set(editKey(commit), { ...commit });
  }

  updateFrame(_frame: UiFrame): void {
    if (this.#disposed || !this.enabled || this.#pendingByKey.size === 0) return;
    const commits = [...this.#pendingByKey.values()];
    this.#pendingByKey.clear();
    const applied = commits.map((commit) => this.applyCommit(commit));
    this.#lastApplied = Object.freeze(applied);
    this.#revision += 1;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    this.#pendingByKey.clear();
    this.#lastApplied = Object.freeze([]);
  }

  private applyCommit(commit: InspectorPropertyEditCommit): InspectorPropertyEditApplyRecord {
    const target = this.#targetSource.getEditableComponent(commit.actorId, commit.componentId);
    const request = createRequest(commit, target?.componentType ?? commit.componentType);
    if (!target || target.componentType !== commit.componentType) {
      return createFailedApplyRecord(request, "Editable component not found.");
    }
    const descriptor = this.#descriptorRegistry.get(target.componentType);
    if (!descriptor?.applyEdit) {
      return createFailedApplyRecord(request, "Inspector descriptor cannot edit this property.");
    }
    const context: InspectorPropertyReadContext = {
      actorId: commit.actorId,
      componentId: commit.componentId,
      componentType: target.componentType
    };
    try {
      return {
        request,
        result: descriptor.applyEdit(target.component, request, context)
      };
    } catch (error) {
      return createFailedApplyRecord(request, error instanceof Error ? error.message : String(error));
    }
  }
}

export function createActorSystemInspectorPropertyEditTargetSource(
  actorSystem: ActorSystemView
): InspectorPropertyEditTargetSource {
  return {
    getEditableComponent(actorId, componentId) {
      const actor = actorSystem.getActor(actorId);
      if (!actor) return null;
      const component = actor.listComponents().find((candidate) => candidate.id === componentId);
      if (!component) return null;
      return {
        component,
        componentType: component.type
      };
    }
  };
}

function createRequest(
  commit: InspectorPropertyEditCommit,
  componentType: string
): InspectorPropertyEditRequest {
  return Object.freeze({
    actorId: commit.actorId,
    componentId: commit.componentId,
    componentType,
    propertyId: commit.propertyId,
    value: commit.value,
    timeStamp: commit.timeStamp,
    source: commit.source
  });
}

function createFailedApplyRecord(
  request: InspectorPropertyEditRequest,
  reason: string
): InspectorPropertyEditApplyRecord {
  return Object.freeze({
    request,
    result: { accepted: false, reason }
  });
}

function editKey(commit: InspectorPropertyEditCommit): string {
  return `${commit.actorId}\u0000${commit.componentId}\u0000${commit.propertyId}`;
}

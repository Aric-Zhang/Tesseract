export interface WorkspaceSequenceCommand {
  readonly workspace: string;
  readonly script: string;
}

export declare const WORKSPACE_ORDER: readonly string[];

export declare const SEQUENCES: Readonly<Record<string, readonly WorkspaceSequenceCommand[]>>;

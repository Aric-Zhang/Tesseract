export type RollbackErrorHandler = (errors: readonly unknown[]) => void;

export class ComponentTransaction {
  private readonly rollbacks: Array<() => void> = [];
  private readonly onRollbackError?: RollbackErrorHandler;
  private committed = false;
  private rolledBack = false;

  constructor(onRollbackError?: RollbackErrorHandler) {
    this.onRollbackError = onRollbackError;
  }

  addRollback(dispose: () => void): void {
    if (this.committed) {
      throw new Error("Cannot add rollback after ComponentTransaction.commit().");
    }
    if (this.rolledBack) {
      throw new Error("Cannot add rollback after ComponentTransaction.rollback().");
    }
    this.rollbacks.push(dispose);
  }

  commit(): void {
    if (this.rolledBack) {
      throw new Error("Cannot commit after ComponentTransaction.rollback().");
    }
    this.committed = true;
    this.rollbacks.length = 0;
  }

  rollback(): void {
    if (this.committed || this.rolledBack) return;
    this.rolledBack = true;
    const errors: unknown[] = [];
    for (let i = this.rollbacks.length - 1; i >= 0; i -= 1) {
      try {
        this.rollbacks[i]();
      } catch (error) {
        errors.push(error);
      }
    }
    this.rollbacks.length = 0;
    if (errors.length > 0) {
      this.onRollbackError?.(errors);
    }
  }
}


export interface RuntimeRegistration {
  dispose(): void;
}

export interface RuntimeDisposable {
  dispose(): void;
}

export function createRuntimeRegistration(dispose: () => void): RuntimeRegistration {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      dispose();
    }
  };
}

export function disposeAllRuntimeRegistrations(registrations: readonly RuntimeRegistration[]): void {
  const errors: unknown[] = [];
  for (const registration of [...registrations].reverse()) {
    try {
      registration.dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, "Runtime registration cleanup failed.");
  }
}

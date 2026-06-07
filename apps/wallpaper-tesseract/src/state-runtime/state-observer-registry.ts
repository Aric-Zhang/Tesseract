export interface StateObserverRegistration {
  dispose(): void;
}

export interface StateObserverRegistry<TObserver> {
  subscribe(observer: TObserver): StateObserverRegistration;
  dispose(): void;
}


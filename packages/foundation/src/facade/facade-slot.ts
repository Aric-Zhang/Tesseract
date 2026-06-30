export interface FacadeProviderRegistration {
  dispose(): void;
}

export interface FacadeSlot<TProvider> {
  install(provider: TProvider): FacadeProviderRegistration;
  current(): TProvider;
  isInstalled(): boolean;
}

const emptyFacadeProvider = Symbol("empty facade provider");

export function createFacadeSlot<TProvider>(name: string): FacadeSlot<TProvider> {
  let currentProvider: TProvider | typeof emptyFacadeProvider = emptyFacadeProvider;

  return {
    install(provider: TProvider): FacadeProviderRegistration {
      if (currentProvider !== emptyFacadeProvider) {
        throw new Error(`Facade provider already installed: ${name}`);
      }

      currentProvider = provider;
      let disposed = false;

      return {
        dispose(): void {
          if (disposed) return;
          disposed = true;
          if (currentProvider === provider) {
            currentProvider = emptyFacadeProvider;
          }
        }
      };
    },

    current(): TProvider {
      if (currentProvider === emptyFacadeProvider) {
        throw new Error(`Facade provider is not installed: ${name}`);
      }
      return currentProvider;
    },

    isInstalled(): boolean {
      return currentProvider !== emptyFacadeProvider;
    }
  };
}

import "./styles";
import { installUiFrameworkFixture } from "./install-ui-framework-fixture";
import { UiFixtureBrowserLayoutStorage } from "./fixture-state";
import { WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY } from "../window-runtime";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const globalFixture = globalThis as typeof globalThis & {
    __uiFrameworkFixture?: ReturnType<typeof installUiFrameworkFixture>;
    __uiFrameworkFixtureGizmoLog?: unknown[];
  };
  globalFixture.__uiFrameworkFixtureGizmoLog = [];
  const fixture = installUiFrameworkFixture({
    parent: app,
    enableActorInput: true,
    layoutStorage: new UiFixtureBrowserLayoutStorage(window.localStorage, {
      mirrorDocument: document,
      resetKeys: new URLSearchParams(window.location.search).has("resetUiFixtureLayout")
        ? [WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY]
        : []
    })
  });
  globalFixture.__uiFrameworkFixture = fixture;
  const dispose = () => {
    window.removeEventListener("beforeunload", dispose);
    fixture.dispose();
    delete globalFixture.__uiFrameworkFixture;
  };
  window.addEventListener("beforeunload", dispose);
}

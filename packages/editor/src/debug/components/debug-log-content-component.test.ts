import { describe, expect, it } from "vitest";
import { DiagnosticHub } from "foundation/diagnostics";
import { ActorSystem } from "actor-system/core";
import { type ScrollViewComponent, type VirtualListViewComponent } from "ui-framework/controls";
import { type UiElementComponent } from "ui-framework/actor-ui";
import { type WindowContentLayoutCommit, type WindowContentLayoutCommitRegistration, type WindowContentRegistrationPort, type WindowRegisteredContent } from "ui-framework/window";
import { DebugLogContentComponent } from "./debug-log-content-component";
import { DebugLogDataSource } from "./debug-log-data-source";

class FakeWindowContentRegistry implements WindowContentRegistrationPort {
  registerContent(request: { readonly contentId: string; readonly element: HTMLElement }): WindowRegisteredContent {
    return {
      contentId: request.contentId,
      element: request.element,
      interactable: true,
      setInteractable() {},
      subscribeLayoutCommit(_callback: (commit: WindowContentLayoutCommit) => void): WindowContentLayoutCommitRegistration {
        return { dispose() {} };
      },
      dispose() {}
    };
  }
}

describe("DebugLogContentComponent", () => {
  it("batches diagnostic source updates into one virtual-list refresh per dirty frame", () => {
    const fixture = createFixture();

    expect(fixture.virtualList.refreshItemsPreservingEndCalls).toBe(1);

    fixture.hub.emit({ level: "log", message: "first" });
    fixture.hub.emit({ level: "log", message: "second" });
    fixture.hub.emit({ level: "log", message: "third" });
    expect(fixture.virtualList.refreshItemsPreservingEndCalls).toBe(1);

    fixture.component.updateFrame({} as never);

    expect(fixture.virtualList.refreshItemsPreservingEndCalls).toBe(2);
    expect(fixture.scrollView.refreshScrollDiagnosticsCalls).toBe(2);
    expect(fixture.source.getItemCount()).toBe(3);

    fixture.component.updateFrame({} as never);

    expect(fixture.virtualList.refreshItemsPreservingEndCalls).toBe(2);
  });

  it("disposes the diagnostic view adapter subscription", () => {
    const fixture = createFixture();
    fixture.component.dispose();
    fixture.hub.emit({ level: "log", message: "ignored" });

    expect(fixture.source.revision).toBe(0);
  });
});

function createFixture(): {
  readonly hub: DiagnosticHub;
  readonly source: DebugLogDataSource;
  readonly component: DebugLogContentComponent;
  readonly scrollView: { refreshScrollDiagnosticsCalls: number; refreshScrollDiagnostics(): void };
  readonly virtualList: { refreshItemsPreservingEndCalls: number; refreshItemsPreservingEnd(): void };
} {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "debug:view" });
  const element = {} as HTMLElement;
  const hub = new DiagnosticHub({ now: () => 0 });
  const source = new DebugLogDataSource(hub);
  const scrollView = {
    refreshScrollDiagnosticsCalls: 0,
    refreshScrollDiagnostics() {
      this.refreshScrollDiagnosticsCalls += 1;
    }
  };
  const virtualList = {
    refreshItemsPreservingEndCalls: 0,
    refreshItemsPreservingEnd() {
      this.refreshItemsPreservingEndCalls += 1;
    }
  };
  const component = new DebugLogContentComponent(
    actor,
    { element } as UiElementComponent,
    scrollView as unknown as ScrollViewComponent,
    virtualList as unknown as VirtualListViewComponent,
    {
      contentId: "content:debug",
      contentRegistration: new FakeWindowContentRegistry(),
      source
    }
  );
  return {
    hub,
    source,
    component,
    scrollView,
    virtualList
  };
}

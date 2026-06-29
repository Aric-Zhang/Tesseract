import { describe, expect, it } from "vitest";
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
  it("batches multiple appends into one virtual-list refresh per dirty frame", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "debug:view" });
    const element = {} as HTMLElement;
    const source = new DebugLogDataSource(10);
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

    expect(virtualList.refreshItemsPreservingEndCalls).toBe(1);
    component.append({ type: "move", message: "first", timeStamp: 1 });
    component.append({ type: "move", message: "second", timeStamp: 2 });
    component.append({ type: "move", message: "third", timeStamp: 3 });
    expect(virtualList.refreshItemsPreservingEndCalls).toBe(1);

    component.updateFrame({} as never);

    expect(virtualList.refreshItemsPreservingEndCalls).toBe(2);
    expect(scrollView.refreshScrollDiagnosticsCalls).toBe(2);
    expect(source.getItemCount()).toBe(3);

    component.updateFrame({} as never);

    expect(virtualList.refreshItemsPreservingEndCalls).toBe(2);
  });
});

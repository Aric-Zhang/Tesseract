import type { ActorInputEndEvent } from "../gizmo-runtime";
import type { WindowTabDragSink } from "./window-dock-preview-component";
import { readWindowTabDragSource } from "ui-framework";
import type { WindowDockCommitIntent, WindowDockCommitResult, WindowFrameIntentSink } from "./window-frame-lifecycle";
import {
  WINDOW_FRAME_TAB_ACTION_PART_ID,
  WINDOW_FRAME_TAB_PART_ID
} from "ui-framework";
import type { WindowTabDragSessionEndResult } from "ui-framework";
import { isWindowTabAction } from "ui-framework";

export interface WindowFrameTabInputEndOptions {
  readonly event: ActorInputEndEvent;
  readonly frameId: string;
  readonly frameIntentSink?: WindowFrameIntentSink;
  readonly tabDragSink?: WindowTabDragSink;
  readonly draggingTab: boolean;
  readonly activateFallback?: (viewActorId: string) => void;
}

export interface WindowFrameTabInputEndResult {
  readonly handled: boolean;
  readonly draggingTab: boolean;
  readonly dockCommit?: {
    readonly preview: WindowTabDragSessionEndResult["preview"];
    readonly intent: WindowDockCommitIntent;
    readonly result: WindowDockCommitResult;
  };
}

export function handleWindowFrameTabInputEnd(
  options: WindowFrameTabInputEndOptions
): WindowFrameTabInputEndResult {
  const { event, frameId, frameIntentSink, tabDragSink } = options;
  if (options.draggingTab && !event.wasClick) {
    const result = tabDragSink?.endTabDrag() ?? null;
    const intent = result ? createDockCommitIntent(result) : null;
    const unavailableCommitResult: WindowDockCommitResult = {
      committed: false,
      reason: "dock commit sink unavailable"
    };
    const commitResult = intent
      ? frameIntentSink?.requestCommitDock?.(intent) ?? unavailableCommitResult
      : null;
    if (result && intent && commitResult) {
      return {
        handled: true,
        draggingTab: false,
        dockCommit: {
          preview: result.preview,
          intent,
          result: commitResult
        }
      };
    }
    return { handled: true, draggingTab: false };
  }

  if (event.hit.partId === WINDOW_FRAME_TAB_ACTION_PART_ID) {
    if (event.wasClick && frameIntentSink?.requestCloseView && isWindowTabAction(event.hit.data)) {
      frameIntentSink.requestCloseView(event.hit.data.viewActorId, "tab-action", {
        ownerFrameId: frameId,
        identity: event.hit.data.identity,
        viewKey: event.hit.data.viewKey
      });
    }
    return { handled: true, draggingTab: options.draggingTab };
  }

  if (event.hit.partId !== WINDOW_FRAME_TAB_PART_ID) {
    return { handled: false, draggingTab: options.draggingTab };
  }

  if (event.wasClick) {
    const source = readWindowTabDragSource(frameId, event.hit);
    if (source) {
      if (frameIntentSink?.requestActivateFrameTab) {
        frameIntentSink.requestActivateFrameTab(frameId, source.viewActorId, "tab-click");
      } else {
        options.activateFallback?.(source.viewActorId);
      }
    }
    if (options.draggingTab) {
      tabDragSink?.endTabDrag();
    }
    return { handled: true, draggingTab: false };
  }

  if (!options.draggingTab) {
    return { handled: true, draggingTab: false };
  }

  return { handled: true, draggingTab: false };
}

export function createDockCommitIntent(result: WindowTabDragSessionEndResult): WindowDockCommitIntent | null {
  if (result.preview.kind === "merge-tabs") {
    if (result.preview.operation === "no-op") return null;
    return {
      kind: "merge-tabs",
      operation: result.preview.operation,
      source: result.source,
      targetFrameId: result.preview.targetFrameId,
      targetTabsetId: result.preview.targetTabsetId,
      reason: "dock-drop"
    };
  }
  if (result.preview.kind === "split") {
    return {
      kind: "split-tab",
      operation: result.preview.operation,
      source: result.source,
      targetFrameId: result.preview.targetFrameId,
      targetTabsetId: result.preview.targetTabsetId,
      placement: result.preview.placement,
      reason: "dock-drop"
    };
  }
  return {
    kind: "float-tab",
    operation: result.preview.operation,
    source: result.source,
    bounds: result.preview.rect,
    reason: "dock-drop"
  };
}

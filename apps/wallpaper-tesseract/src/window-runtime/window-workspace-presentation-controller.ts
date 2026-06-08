import type { UiScheduledService } from "./ui-scheduler";
import type {
  WindowViewFullscreenReason,
  WindowViewFullscreenSession,
  WindowViewPresentationCommandPort
} from "./window-frame-lifecycle";
import type { WindowFramePortRegistryView } from "./window-frame-port-registry";

export const WINDOW_WORKSPACE_PRESENTATION_CONTROLLER_ID =
  "window-workspace-presentation-controller";

export interface WindowWorkspacePresentationControllerOptions {
  readonly framePorts: WindowFramePortRegistryView;
  readonly presentation: WindowViewPresentationCommandPort;
}

export interface WindowWorkspacePresentationSession {
  readonly id: string;
  readonly kind: "view-run-fullscreen";
  readonly viewActorId: string;
  readonly viewKey: string;
  readonly fullscreenFrameId: string;
  readonly suppressedFrameIds: readonly string[];
}

export type WindowWorkspacePresentationResult =
  | {
      readonly entered: true;
      readonly session: WindowWorkspacePresentationSession;
    }
  | {
      readonly entered: false;
      readonly reason: string;
    };

export class WindowWorkspacePresentationController implements UiScheduledService {
  readonly id = WINDOW_WORKSPACE_PRESENTATION_CONTROLLER_ID;
  readonly priority = -940;
  enabled = true;

  readonly #framePorts: WindowFramePortRegistryView;
  readonly #presentation: WindowViewPresentationCommandPort;
  #activeSession: WindowWorkspacePresentationSession | null = null;

  constructor(options: WindowWorkspacePresentationControllerOptions) {
    this.#framePorts = options.framePorts;
    this.#presentation = options.presentation;
  }

  enterRunFullscreenForView(
    viewActorId: string,
    reason: WindowViewFullscreenReason
  ): WindowWorkspacePresentationResult {
    if (!this.enabled) {
      return {
        entered: false,
        reason: "presentation controller is disabled"
      };
    }
    const existingSession = this.#activeSession;
    if (existingSession?.viewActorId === viewActorId) {
      this.applySuppression(existingSession.fullscreenFrameId);
      return {
        entered: true,
        session: existingSession
      };
    }
    if (existingSession) {
      this.exitRunFullscreen(reason);
    }

    this.#presentation.enterViewWorkspaceFullscreen(viewActorId, reason);
    const fullscreenSession = this.#presentation.getViewFullscreenSession(viewActorId);
    if (!fullscreenSession) {
      return {
        entered: false,
        reason: "view did not enter fullscreen"
      };
    }
    const activeSession = this.toWorkspaceSession(fullscreenSession);
    this.#activeSession = {
      ...activeSession,
      suppressedFrameIds: this.applySuppression(activeSession.fullscreenFrameId)
    };
    return {
      entered: true,
      session: this.#activeSession
    };
  }

  exitRunFullscreen(reason: WindowViewFullscreenReason): void {
    const session = this.#activeSession;
    if (!session) return;
    try {
      this.#presentation.exitViewFullscreen(session.viewActorId, reason);
    } finally {
      this.clearSuppression();
      this.#activeSession = null;
    }
  }

  getActiveSession(): WindowWorkspacePresentationSession | null {
    return this.#activeSession;
  }

  updateFrame(): void {
    const session = this.#activeSession;
    if (!this.enabled || !session) return;
    this.#activeSession = {
      ...session,
      suppressedFrameIds: this.applySuppression(session.fullscreenFrameId)
    };
  }

  dispose(): void {
    this.enabled = false;
    this.clearSuppression();
    this.#activeSession = null;
  }

  private applySuppression(fullscreenFrameId: string): readonly string[] {
    const suppressedFrameIds: string[] = [];
    for (const entry of this.#framePorts.list()) {
      const shouldSuppress = entry.framePort.frameId !== fullscreenFrameId;
      entry.framePort.setPresentationSuppressed("workspace-run", shouldSuppress);
      if (shouldSuppress) {
        suppressedFrameIds.push(entry.framePort.frameId);
      }
    }
    return suppressedFrameIds;
  }

  private clearSuppression(): void {
    for (const entry of this.#framePorts.list()) {
      entry.framePort.setPresentationSuppressed("workspace-run", false);
    }
  }

  private toWorkspaceSession(session: WindowViewFullscreenSession): WindowWorkspacePresentationSession {
    return {
      id: `workspace-run:${session.viewActorId}`,
      kind: "view-run-fullscreen",
      viewActorId: session.viewActorId,
      viewKey: session.viewKey,
      fullscreenFrameId: session.fullscreenFrameId,
      suppressedFrameIds: []
    };
  }
}

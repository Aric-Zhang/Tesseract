import {
  RuntimeMutableFrameSource,
  type RuntimeFrameSourceId,
  type RuntimeFrameSourceSnapshot
} from "runtime-core";

export interface RuntimeThreeFramePayload {
  readonly rendered: boolean;
  readonly width?: number;
  readonly height?: number;
}

export class RuntimeThreeFrameSource {
  readonly source: RuntimeMutableFrameSource<RuntimeThreeFramePayload>;

  constructor(sourceId: RuntimeFrameSourceId, label = "Runtime Three Frame Source") {
    this.source = new RuntimeMutableFrameSource<RuntimeThreeFramePayload>({
      id: sourceId,
      label
    });
  }

  publishRendered(size: { readonly width?: number; readonly height?: number } = {}): RuntimeFrameSourceSnapshot<RuntimeThreeFramePayload> {
    return this.source.publish({
      status: "ready",
      payload: {
        rendered: true,
        ...size
      }
    });
  }

  publishFailed(error: Error): RuntimeFrameSourceSnapshot<RuntimeThreeFramePayload> {
    return this.source.publish({
      status: "failed",
      error: {
        message: error.message,
        code: "runtime-three-render"
      }
    });
  }
}


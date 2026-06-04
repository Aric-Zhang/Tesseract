import { describe, expect, it } from "vitest";
import { sceneParameterPaths, vec2, type SceneUpdateCommand } from "../../scene-runtime";
import { DebugLogWindow } from "./debug-log-window";
import type { DebugWindowState } from "../debug-window-parameters";

function createSubject(state: DebugWindowState = {
  position: vec2(10, 20),
  size: vec2(300, 200),
  visible: true
}) {
  const commands: SceneUpdateCommand[] = [];
  const subject = Object.create(DebugLogWindow.prototype) as DebugLogWindow;
  Object.defineProperty(subject, "id", {
    value: "debug-log-window"
  });
  Object.defineProperty(subject, "element", {
    value: {
      hidden: false,
      style: {}
    }
  });
  const privateSubject = subject as unknown as {
    commandSink: { submit(command: SceneUpdateCommand): void };
  };
  privateSubject.commandSink = {
    submit: (command) => commands.push(command)
  };
  Object.defineProperty(subject, "state", {
    value: state
  });
  return { subject, commands };
}

describe("legacy DebugLogWindow command boundary", () => {
  it("submits an absolute position from the drag start while dragging the titlebar", () => {
    const { subject, commands } = createSubject();

    subject.onGizmoMove({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "titlebar", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 10,
      point: { x: 20, y: 30 },
      startPoint: { x: 10, y: 20 },
      buttons: 1,
      delta: { dx: 4, dy: -3 },
      totalDelta: { dx: 4, dy: -3 },
      isDragging: true
    });

    expect(commands).toEqual([
      {
        source: { id: "debug-log-window", kind: "gizmo" },
        target: sceneParameterPaths.debugWindow.position,
        operation: "set",
        value: vec2(14, 17),
        timeStamp: 10
      }
    ]);
  });

  it("does not submit drag commands before the drag threshold is crossed", () => {
    const { subject, commands } = createSubject();

    subject.onGizmoMove({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "titlebar", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 10,
      point: { x: 20, y: 30 },
      startPoint: { x: 10, y: 20 },
      buttons: 1,
      delta: { dx: 4, dy: -3 },
      totalDelta: { dx: 4, dy: -3 },
      isDragging: false
    });

    expect(commands).toHaveLength(0);
  });

  it("submits a visibility update when the close button is clicked", () => {
    const { subject, commands } = createSubject();

    subject.onGizmoEnd({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "close", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 12,
      point: { x: 20, y: 30 },
      startPoint: { x: 20, y: 30 },
      buttons: 0,
      totalDelta: { dx: 0, dy: 0 },
      wasClick: true
    });

    expect(commands).toEqual([
      {
        source: { id: "debug-log-window", kind: "gizmo" },
        target: sceneParameterPaths.debugWindow.visible,
        operation: "set",
        value: false,
        timeStamp: 12
      }
    ]);
  });

  it("submits an absolute size from the drag start while dragging the bottom-right resize handle", () => {
    const { subject, commands } = createSubject();

    subject.onGizmoMove({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "resize-bottom-right", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 14,
      point: { x: 40, y: 50 },
      startPoint: { x: 20, y: 30 },
      buttons: 1,
      delta: { dx: 20, dy: 10 },
      totalDelta: { dx: 20, dy: 10 },
      isDragging: true
    });

    expect(commands).toEqual([
      {
        source: { id: "debug-log-window", kind: "gizmo" },
        target: sceneParameterPaths.debugWindow.size,
        operation: "set",
        value: vec2(320, 210),
        timeStamp: 14
      }
    ]);
  });

  it("submits position and size while dragging the left resize handle", () => {
    const { subject, commands } = createSubject({
      position: vec2(10, 20),
      size: vec2(360, 200),
      visible: true
    });

    subject.onGizmoMove({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "resize-left", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 16,
      point: { x: -40, y: 50 },
      startPoint: { x: 0, y: 50 },
      buttons: 1,
      delta: { dx: -40, dy: 0 },
      totalDelta: { dx: -40, dy: 0 },
      isDragging: true
    });

    expect(commands).toEqual([
      {
        source: { id: "debug-log-window", kind: "gizmo" },
        target: sceneParameterPaths.debugWindow.position,
        operation: "set",
        value: vec2(-30, 20),
        timeStamp: 16
      },
      {
        source: { id: "debug-log-window", kind: "gizmo" },
        target: sceneParameterPaths.debugWindow.size,
        operation: "set",
        value: vec2(400, 200),
        timeStamp: 16
      }
    ]);
  });

  it("keeps the opposite edge anchored when left resize hits the minimum width", () => {
    const { subject, commands } = createSubject({
      position: vec2(10, 20),
      size: vec2(360, 200),
      visible: true
    });

    subject.onGizmoMove({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "resize-left", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 18,
      point: { x: 1000, y: 50 },
      startPoint: { x: 0, y: 50 },
      buttons: 1,
      delta: { dx: 1000, dy: 0 },
      totalDelta: { dx: 1000, dy: 0 },
      isDragging: true
    });

    expect(commands).toEqual([
      {
        source: { id: "debug-log-window", kind: "gizmo" },
        target: sceneParameterPaths.debugWindow.position,
        operation: "set",
        value: vec2(70, 20),
        timeStamp: 18
      },
      {
        source: { id: "debug-log-window", kind: "gizmo" },
        target: sceneParameterPaths.debugWindow.size,
        operation: "set",
        value: vec2(300, 200),
        timeStamp: 18
      }
    ]);
  });

  it("submits position and size while dragging the top-left resize handle", () => {
    const { subject, commands } = createSubject({
      position: vec2(10, 20),
      size: vec2(360, 200),
      visible: true
    });

    subject.onGizmoMove({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "resize-top-left", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 20,
      point: { x: -30, y: -24 },
      startPoint: { x: 0, y: 0 },
      buttons: 1,
      delta: { dx: -30, dy: -24 },
      totalDelta: { dx: -30, dy: -24 },
      isDragging: true
    });

    expect(commands).toEqual([
      {
        source: { id: "debug-log-window", kind: "gizmo" },
        target: sceneParameterPaths.debugWindow.position,
        operation: "set",
        value: vec2(-20, -4),
        timeStamp: 20
      },
      {
        source: { id: "debug-log-window", kind: "gizmo" },
        target: sceneParameterPaths.debugWindow.size,
        operation: "set",
        value: vec2(390, 224),
        timeStamp: 20
      }
    ]);
  });

  it("uses totalDelta from the drag start instead of accumulating current DOM state", () => {
    const { subject, commands } = createSubject();
    subject.onGizmoStart({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "titlebar", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 0,
      point: { x: 0, y: 0 },
      startPoint: { x: 0, y: 0 },
      buttons: 1
    });

    subject.onGizmoMove({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "titlebar", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 10,
      point: { x: 30, y: 0 },
      startPoint: { x: 0, y: 0 },
      buttons: 1,
      delta: { dx: 10, dy: 0 },
      totalDelta: { dx: 30, dy: 0 },
      isDragging: true
    });
    subject.onSceneStateChanged({
      frame: { timeMs: 10, deltaMs: 10, frameIndex: 1 },
      changes: [{
        path: sceneParameterPaths.debugWindow.position,
        previousValue: vec2(10, 20),
        nextValue: vec2(40, 20),
        sources: [{ id: "debug-log-window", kind: "gizmo" }],
        commands: []
      }]
    });
    subject.onGizmoMove({
      gizmo: subject,
      hit: { gizmoId: subject.id, partId: "titlebar", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 20,
      point: { x: 50, y: 0 },
      startPoint: { x: 0, y: 0 },
      buttons: 1,
      delta: { dx: 20, dy: 0 },
      totalDelta: { dx: 50, dy: 0 },
      isDragging: true
    });

    expect(commands.at(-1)).toMatchObject({
      target: sceneParameterPaths.debugWindow.position,
      operation: "set",
      value: vec2(60, 20)
    });
  });
});

import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-system/core";
import {
  uiElementComponentType,
  uiLayoutHostComponentType,
  uiLayoutItemComponentType
} from "ui-framework/actor-ui";
import {
  toggleButtonComponentType,
  toolbarComponentType,
  type ToggleButtonActivation,
  type ToggleButtonComponent
} from "ui-framework/controls";
import { createActorSystemInspectorActorDisplaySource } from "./inspector-actor-display-source";
import {
  inspectorContentComponentType,
  type InspectorContentComponent,
  type InspectorLockStateSink
} from "./inspector-content-component";
import {
  inspectorLockedIcon,
  inspectorUnlockedIcon
} from "./inspector-lock-icons";
import {
  inspectorRootContentComponentType,
  type InspectorRootContentComponent,
  type InspectorRootContentComponentOptions
} from "./inspector-root-content-component";
import type { InspectorSelectionSnapshotSource } from "./inspector-selection-source";

export interface InspectorViewActorOptions {
  readonly actorId: string;
  readonly actorName: string;
  readonly parentActor: Actor;
  readonly document?: Pick<Document, "createElement">;
  readonly contentId: string;
  readonly contentRegistration: InspectorRootContentComponentOptions["contentRegistration"];
  readonly selectionSource: InspectorSelectionSnapshotSource;
  readonly initialLocked?: boolean;
  readonly initialInspectedActorId?: string | null;
}

export interface RegisteredInspectorViewActor extends RegisteredActor<InspectorRootContentComponent> {
  readonly inspectorContent: InspectorContentComponent;
  readonly lockToggle: ToggleButtonComponent;
  disposeRuntimeTracking?(): void;
}

export function createInspectorViewActor(
  context: ActorCreationContext,
  options: InspectorViewActorOptions
): RegisteredInspectorViewActor {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName,
    parent: options.parentActor
  });
  try {
    context.componentRegistry.addComponent(actor, uiElementComponentType, {
      className: "inspector-window__content",
      document: options.document
    });
    context.componentRegistry.addComponent(actor, uiLayoutHostComponentType);
    const component = context.componentRegistry.addComponent(actor, inspectorRootContentComponentType, {
      id: "inspector-root-content",
      contentId: options.contentId,
      contentRegistration: options.contentRegistration
    });

    const toolbarActor = context.actorSystem.createActor({
      id: `${options.actorId}:toolbar`,
      name: "Inspector Toolbar",
      parent: actor
    });
    context.componentRegistry.addComponent(toolbarActor, uiElementComponentType, {
      className: "inspector-window__toolbar",
      document: options.document
    });
    context.componentRegistry.addComponent(toolbarActor, uiLayoutItemComponentType, {
      slot: "top",
      stretch: "horizontal"
    });
    context.componentRegistry.addComponent(toolbarActor, toolbarComponentType);

    const bodyActor = context.actorSystem.createActor({
      id: `${options.actorId}:body`,
      name: "Inspector Body",
      parent: actor
    });
    context.componentRegistry.addComponent(bodyActor, uiElementComponentType, {
      className: "inspector-window__body",
      document: options.document
    });
    context.componentRegistry.addComponent(bodyActor, uiLayoutItemComponentType, {
      slot: "fill",
      stretch: "both"
    });

    let lockToggle: ToggleButtonComponent | null = null;
    const inspectorContent = context.componentRegistry.addComponent(bodyActor, inspectorContentComponentType, {
      id: "inspector-content",
      actorDisplaySource: createActorSystemInspectorActorDisplaySource(context.actorSystem),
      selectionSource: options.selectionSource,
      lockStateSink: {
        inspectorLockStateChanged(locked) {
          syncLockToggle(lockToggle, locked);
        }
      } satisfies InspectorLockStateSink,
      initialLocked: options.initialLocked,
      initialInspectedActorId: options.initialInspectedActorId
    });

    const lockButtonActor = context.actorSystem.createActor({
      id: `${options.actorId}:toolbar:lock`,
      name: "Inspector Lock Toggle",
      parent: toolbarActor
    });
    context.componentRegistry.addComponent(lockButtonActor, uiElementComponentType, {
      tagName: "button",
      document: options.document
    });
    lockToggle = context.componentRegistry.addComponent(lockButtonActor, toggleButtonComponentType, {
      id: "inspector-lock-toggle",
      descriptor: createLockToggleDescriptor(inspectorContent.locked),
      icons: {
        pressed: inspectorLockedIcon,
        unpressed: inspectorUnlockedIcon
      },
      initialPressed: inspectorContent.locked,
      activationSink: {
        toggleButton(activation: ToggleButtonActivation) {
          inspectorContent.setLocked(activation.requestedPressed);
          syncLockToggle(lockToggle, inspectorContent.locked);
        }
      }
    });
    syncLockToggle(lockToggle, inspectorContent.locked);

    let untrack: ReturnType<ActorCreationContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredInspectorViewActor = {
      actor: baseHandle.actor,
      component: baseHandle.component,
      inspectorContent,
      lockToggle,
      dispose: () => baseHandle.dispose(),
      disposeRuntimeTracking: () => {
        untrack?.dispose();
        untrack = null;
      }
    };
    untrack = context.trackRegisteredActor(handle);
    return handle;
  } catch (error) {
    if (context.actorSystem.hasActor(actor)) {
      context.actorSystem.destroyActor(actor);
    }
    throw error;
  }
}

function syncLockToggle(toggle: ToggleButtonComponent | null, locked: boolean): void {
  if (!toggle) return;
  toggle.setPressed(locked);
  toggle.setDescriptor(createLockToggleDescriptor(locked), {
    pressed: inspectorLockedIcon,
    unpressed: inspectorUnlockedIcon
  });
}

function createLockToggleDescriptor(locked: boolean) {
  return {
    id: "inspector-lock-toggle",
    accessibleLabel: locked ? "Unlock Inspector" : "Lock Inspector",
    title: locked ? "Unlock Inspector" : "Lock Inspector",
    variant: "toolbar" as const,
    icon: locked ? inspectorLockedIcon : inspectorUnlockedIcon
  };
}

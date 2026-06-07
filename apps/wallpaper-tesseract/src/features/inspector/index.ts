export {
  INSPECTOR_VIEW_TYPE,
  createInspectorWindowWorkspaceFloatingFramePolicies,
  installInspectorFeature
} from "./install-inspector-feature";
export type { InstallInspectorFeatureOptions } from "./install-inspector-feature";
export {
  InspectorContentComponent,
  inspectorContentComponentType
} from "./inspector-content-component";
export type {
  InspectorContentComponentOptions,
  InspectorContentComponentServices
} from "./inspector-content-component";
export { inspectorContentComponentDefinition } from "./inspector-content-definition";
export { createInspectorViewActor } from "./inspector-view-actor-factory";
export type {
  InspectorViewActorOptions,
  RegisteredInspectorViewActor
} from "./inspector-view-actor-factory";
export { installInspectorComponentDefinitions } from "./install-component-definitions";

export {
  INSPECTOR_VIEW_TYPE,
  installInspectorWorkspacePolicy,
  installInspectorFeature
} from "./install-inspector-feature";
export type {
  InstalledInspectorWorkspacePolicy,
  InstallInspectorFeatureOptions
} from "./install-inspector-feature";
export {
  InspectorContentComponent,
  inspectorContentComponentType
} from "./inspector-content-component";
export type {
  InspectorContentComponentOptions
} from "./inspector-content-component";
export { inspectorContentComponentDefinition } from "./inspector-content-definition";
export { createInspectorViewActor } from "./inspector-view-actor-factory";
export type {
  InspectorViewActorOptions,
  RegisteredInspectorViewActor
} from "./inspector-view-actor-factory";
export { installInspectorComponentDefinitions } from "./install-component-definitions";

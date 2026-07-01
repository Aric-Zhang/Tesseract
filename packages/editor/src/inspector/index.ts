export {
  INSPECTOR_VIEW_TYPE,
  installInspectorWorkspacePolicy,
  installInspectorFeature
} from "./install-inspector-feature";
export type {
  InstalledInspectorWorkspacePolicy,
  InstallInspectorFeatureOptions
} from "./install-inspector-feature";
export type {
  InspectorActorDetails,
  InspectorActorDetailsSource,
  InspectorComponentSummary
} from "./inspector-actor-details-source";
export type {
  InspectorComponentDescriptor,
  InspectorPropertyEditRequest,
  InspectorPropertyEditResult,
  InspectorPropertyEditSummary,
  InspectorPropertyKind,
  InspectorPropertyReadContext,
  InspectorPropertySummary
} from "./inspector-component-descriptor";
export {
  InspectorComponentDescriptorRegistry,
  createInspectorComponentDescriptorRegistry
} from "./inspector-component-descriptor-registry";
export type {
  InspectorSelectionSnapshotSource
} from "./inspector-selection-source";
export {
  createActorSystemInspectorPropertyEditTargetSource,
  InspectorPropertyEditController
} from "./inspector-property-edit-controller";
export type {
  InspectorEditableComponentTarget,
  InspectorPropertyEditApplyRecord,
  InspectorPropertyEditCommit,
  InspectorPropertyEditControllerOptions,
  InspectorPropertyEditTargetSource
} from "./inspector-property-edit-controller";

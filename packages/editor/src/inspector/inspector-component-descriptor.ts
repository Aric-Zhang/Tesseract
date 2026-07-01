export type InspectorPropertyKind = "text" | "number" | "boolean" | "enum" | "error";

export type InspectorPropertyEditControl = "number";

export interface InspectorPropertyEditSummary {
  readonly control: InspectorPropertyEditControl;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled?: boolean;
}

export interface InspectorPropertySummary {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly kind: InspectorPropertyKind;
  readonly edit?: InspectorPropertyEditSummary;
}

export interface InspectorPropertyReadContext {
  readonly actorId: string;
  readonly componentId: string;
  readonly componentType: string;
}

export interface InspectorPropertyEditRequest {
  readonly actorId: string;
  readonly componentId: string;
  readonly componentType: string;
  readonly propertyId: string;
  readonly value: number;
  readonly timeStamp: number;
  readonly source: string;
}

export type InspectorPropertyEditResult =
  | {
      readonly accepted: true;
    }
  | {
      readonly accepted: false;
      readonly reason: string;
    };

export interface InspectorComponentDescriptor<TComponent = unknown> {
  readonly componentType: string;
  readonly displayName?: string;
  readProperties(
    component: TComponent,
    context: InspectorPropertyReadContext
  ): readonly InspectorPropertySummary[];
  applyEdit?(
    component: TComponent,
    request: InspectorPropertyEditRequest,
    context: InspectorPropertyReadContext
  ): InspectorPropertyEditResult;
}

export function cloneInspectorPropertySummary(
  property: InspectorPropertySummary
): InspectorPropertySummary {
  return Object.freeze({
    id: property.id,
    label: property.label,
    value: property.value,
    kind: property.kind,
    edit: property.edit ? cloneInspectorPropertyEditSummary(property.edit) : undefined
  });
}

export function cloneInspectorPropertyEditSummary(
  edit: InspectorPropertyEditSummary
): InspectorPropertyEditSummary {
  return Object.freeze({
    control: edit.control,
    value: edit.value,
    min: edit.min,
    max: edit.max,
    step: edit.step,
    disabled: edit.disabled
  });
}

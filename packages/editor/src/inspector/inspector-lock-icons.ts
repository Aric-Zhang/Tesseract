import type { UiButtonIconDescriptor } from "ui-framework/controls";

export const inspectorUnlockedIcon: UiButtonIconDescriptor = {
  kind: "svg-path",
  viewBox: "0 0 16 16",
  path: "M5 7V5.5C5 3.57 6.57 2 8.5 2S12 3.57 12 5.5H10.75C10.75 4.26 9.74 3.25 8.5 3.25S6.25 4.26 6.25 5.5V7H13V14H3V7H5ZM4.25 8.25V12.75H11.75V8.25H4.25Z"
};

export const inspectorLockedIcon: UiButtonIconDescriptor = {
  kind: "svg-path",
  viewBox: "0 0 16 16",
  path: "M5 7V5.5C5 3.57 6.57 2 8.5 2S12 3.57 12 5.5V7H13V14H3V7H5ZM6.25 7H10.75V5.5C10.75 4.26 9.74 3.25 8.5 3.25S6.25 4.26 6.25 5.5V7ZM4.25 8.25V12.75H11.75V8.25H4.25Z"
};

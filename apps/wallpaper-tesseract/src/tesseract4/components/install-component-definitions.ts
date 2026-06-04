import type { ComponentRegistry } from "../../actor-runtime";
import { installComponentDefinition } from "../../component-definitions";
import { tesseract4ComponentDefinition } from "./tesseract4-definition";

export function installTesseract4ComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, tesseract4ComponentDefinition);
}

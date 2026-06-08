import { installComponentDefinition, type ComponentRegistry } from "../../actor-runtime";
import { tesseract4ComponentDefinition } from "./tesseract4-definition";

export function installTesseract4ComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, tesseract4ComponentDefinition);
}

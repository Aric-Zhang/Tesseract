import type { ComponentDefinition } from "../../actor-runtime";
import { frameUpdateAttachment } from "../../update-runtime";
import {
  Tesseract4Component,
  tesseract4ComponentType,
  type Tesseract4ComponentOptions
} from "./tesseract4-component";

export const tesseract4ComponentDefinition:
  ComponentDefinition<Tesseract4Component, Tesseract4ComponentOptions> = {
    type: tesseract4ComponentType,
    attachments: [frameUpdateAttachment],
    createId(_actor, options) {
      return options?.id ?? "tesseract4";
    },
    create(actor, _context, options = {}) {
      return new Tesseract4Component(actor, options);
    }
  };

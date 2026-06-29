import { describe, expect, it } from "vitest";

const sourceFiles = import.meta.glob("./**/*.ts", {
  eager: true,
  query: "?raw",
  import: "default"
}) as Record<string, string>;

describe("actor-system/core boundaries", () => {
  it("does not import input, gizmo, app, scene, window, DOM, Three, or runtime facts", () => {
    const productionFiles = Object.entries(sourceFiles)
      .filter(([file]) => !file.endsWith(".test.ts"));
    const forbiddenImports = productionFiles
      .flatMap(([file, source]) => (
        [...source.matchAll(/from\s+["']([^"']+)["']/g)]
          .map((match) => ({ file, specifier: match[1] ?? "" }))
      ))
      .filter(({ specifier }) => (
        specifier === "three" ||
        specifier === "actor-system" ||
        specifier === "actor-system/input" ||
        specifier === "actor-system/gizmo" ||
        specifier.startsWith("../input") ||
        specifier.startsWith("../gizmo") ||
        specifier.includes("scene-runtime") ||
        specifier.includes("window-runtime") ||
        specifier.includes("app-runtime") ||
        specifier.includes("runtime/ports")
      ))
      .map(({ file, specifier }) => `${file}: ${specifier}`);
    const forbiddenDomSymbols = productionFiles
      .filter(([, source]) => /\b(?:HTMLElement|Document|Window|MouseEvent)\b/.test(source))
      .map(([file]) => file)
      .sort();

    expect(forbiddenImports).toEqual([]);
    expect(forbiddenDomSymbols).toEqual([]);
  });
});

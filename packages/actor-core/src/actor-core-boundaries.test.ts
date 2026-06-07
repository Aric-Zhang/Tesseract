import { describe, expect, it } from "vitest";

const sourceFiles = import.meta.glob("./**/*.ts", {
  eager: true,
  query: "?raw",
  import: "default"
}) as Record<string, string>;

describe("actor-core package boundaries", () => {
  it("does not import app, scene, window, DOM, Three, or gizmo runtime facts", () => {
    const productionFiles = Object.entries(sourceFiles)
      .filter(([file]) => !file.endsWith(".test.ts"));
    const forbiddenImports = productionFiles
      .flatMap(([file, source]) => (
        [...source.matchAll(/from\s+["']([^"']+)["']/g)]
          .map((match) => ({ file, specifier: match[1] ?? "" }))
      ))
      .filter(({ specifier }) => (
        specifier === "three" ||
        specifier === "gizmo-core" ||
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

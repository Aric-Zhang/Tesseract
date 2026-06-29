import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export interface StaticModuleImport {
  readonly specifier: string;
  readonly kind: "import" | "export";
  readonly typeOnly: boolean;
  readonly sideEffectOnly: boolean;
}

export interface ModuleEdge extends StaticModuleImport {
  readonly fromFile: string;
  readonly resolvedFile: string | null;
}

export interface DynamicModuleImport {
  readonly fromFile: string;
  readonly specifier: string | null;
}

export interface SourceZoneDefinition {
  readonly id: string;
  readonly description: string;
  readonly debt?: boolean;
  includes(file: string): boolean;
}

export interface SourceZoneEntry {
  readonly file: string;
  readonly zones: readonly SourceZoneDefinition[];
}

export interface SourceZoneMap {
  readonly entries: readonly SourceZoneEntry[];
  readonly unclassified: readonly string[];
  readonly ambiguousCandidateFiles: readonly string[];
  readonly debtEntries: readonly SourceZoneEntry[];
}

export interface ZoneDependencyRule {
  readonly sourceZone: string;
  readonly forbiddenTargetZones: readonly string[];
}

export interface ZoneDependencyViolation {
  readonly fromFile: string;
  readonly sourceZone: string;
  readonly toFile: string;
  readonly targetZone: string;
  readonly specifier: string;
}

const rawSourceFiles = import.meta.glob("../**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>;

export const sourceFiles = collectSourceFiles();
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

export function collectSourceFiles(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(rawSourceFiles)
      .map(([path, source]) => [normalizeSourcePath(path), source])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function collectWorkspaceSourceFiles(relativeRoot: string): Record<string, string> {
  const absoluteRoot = join(repositoryRoot, relativeRoot);
  const collected: Record<string, string> = {};
  collectSourceFilesFromDirectory(absoluteRoot, collected);
  return Object.fromEntries(
    Object.entries(collected)
      .map(([absolutePath, source]) => [
        relative(repositoryRoot, absolutePath).replaceAll("\\", "/"),
        source
      ])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function normalizeSourcePath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith("../")) {
    return `./${normalized.slice(3)}`;
  }
  if (normalized.startsWith("./")) {
    return `./test-support/${normalized.slice(2)}`;
  }
  return `./${normalized}`;
}

export function findForbiddenMethodCalls(
  methodNames: readonly string[],
  allowedFiles: ReadonlySet<string>,
  files: Record<string, string> = sourceFiles
): string[] {
  const violations: string[] = [];
  for (const [file, source] of Object.entries(files)) {
    if (file === "./architecture-boundaries.test.ts" || allowedFiles.has(file)) continue;
    for (const methodName of methodNames) {
      const pattern = new RegExp(`\\.${methodName}\\s*\\(`);
      if (pattern.test(source)) {
        violations.push(`${file}: ${methodName}`);
      }
    }
  }
  return violations.sort();
}

export function findForbiddenSourceMatches(
  pattern: RegExp,
  allowedFiles: ReadonlySet<string> = new Set(),
  files: Record<string, string> = sourceFiles
): string[] {
  const violations: string[] = [];
  for (const [file, source] of Object.entries(files)) {
    if (file === "./architecture-boundaries.test.ts" || allowedFiles.has(file)) continue;
    if (pattern.test(source)) {
      violations.push(file);
    }
  }
  return violations.sort();
}

export function readSourceFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath.replace(/^\.\//, "")}`, import.meta.url), "utf8");
}

export function parseStaticImports(source: string): StaticModuleImport[] {
  return [
    ...parseImportDeclarations(source),
    ...parseExportFromDeclarations(source)
  ].sort((left, right) => (
    left.specifier.localeCompare(right.specifier) ||
    left.kind.localeCompare(right.kind) ||
    Number(left.typeOnly) - Number(right.typeOnly)
  ));
}

export function parseStaticExportFrom(source: string): StaticModuleImport[] {
  return parseExportFromDeclarations(source);
}

export function barePackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0] ?? specifier;
}

export function listModuleEdges(files: Record<string, string> = sourceFiles): ModuleEdge[] {
  const paths = new Set(Object.keys(files));
  const edges: ModuleEdge[] = [];
  for (const [fromFile, source] of Object.entries(files)) {
    for (const moduleImport of parseStaticImports(source)) {
      edges.push({
        ...moduleImport,
        fromFile,
        resolvedFile: resolveImportSpecifier(fromFile, moduleImport.specifier, paths)
      });
    }
  }
  return edges.sort((left, right) => (
    left.fromFile.localeCompare(right.fromFile) ||
    left.specifier.localeCompare(right.specifier)
  ));
}

export function listDynamicImports(files: Record<string, string> = sourceFiles): DynamicModuleImport[] {
  const imports: DynamicModuleImport[] = [];
  for (const [fromFile, source] of Object.entries(files)) {
    for (const moduleImport of parseDynamicImports(source)) {
      imports.push({ ...moduleImport, fromFile });
    }
  }
  return imports.sort((left, right) => (
    left.fromFile.localeCompare(right.fromFile) ||
    (left.specifier ?? "").localeCompare(right.specifier ?? "")
  ));
}

export function evaluateZoneDependencyMatrix(
  files: Record<string, string>,
  zones: readonly SourceZoneDefinition[],
  rules: readonly ZoneDependencyRule[]
): ZoneDependencyViolation[] {
  const zoneMap = createSourceZoneMap(files, zones);
  const zonesByFile = new Map(zoneMap.entries.map((entry) => [entry.file, entry.zones]));
  const rulesBySourceZone = new Map(rules.map((rule) => [rule.sourceZone, new Set(rule.forbiddenTargetZones)]));
  const violations: ZoneDependencyViolation[] = [];

  for (const edge of listModuleEdges(files)) {
    if (edge.resolvedFile === null) continue;
    const sourceZones = zonesByFile.get(edge.fromFile) ?? [];
    const targetZones = zonesByFile.get(edge.resolvedFile) ?? [];
    for (const sourceZone of sourceZones) {
      if (sourceZone.debt === true) continue;
      const forbiddenTargetZones = rulesBySourceZone.get(sourceZone.id);
      if (!forbiddenTargetZones) continue;
      const forbiddenTarget = targetZones.find((targetZone) => forbiddenTargetZones.has(targetZone.id));
      if (!forbiddenTarget) continue;
      violations.push({
        fromFile: edge.fromFile,
        sourceZone: sourceZone.id,
        toFile: edge.resolvedFile,
        targetZone: forbiddenTarget.id,
        specifier: edge.specifier
      });
    }
  }

  return violations.sort((left, right) => (
    left.fromFile.localeCompare(right.fromFile) ||
    left.sourceZone.localeCompare(right.sourceZone) ||
    left.toFile.localeCompare(right.toFile) ||
    left.targetZone.localeCompare(right.targetZone)
  ));
}

export function resolveImportSpecifier(
  fromFile: string,
  specifier: string,
  availableFiles: ReadonlySet<string> = new Set(Object.keys(sourceFiles))
): string | null {
  if (!specifier.startsWith(".")) return null;

  const fromParts = fromFile.replace(/^\.\//, "").split("/");
  fromParts.pop();
  const candidateParts = [...fromParts, ...specifier.split("/")];
  const normalizedParts: string[] = [];
  for (const part of candidateParts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      normalizedParts.pop();
      continue;
    }
    normalizedParts.push(part);
  }

  const basePath = `./${normalizedParts.join("/")}`;
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}/index.ts`,
    basePath.replace(/^\.\//, ""),
    `${basePath}.ts`.replace(/^\.\//, ""),
    `${basePath}/index.ts`.replace(/^\.\//, "")
  ];
  return candidates.find((candidate) => availableFiles.has(candidate)) ?? null;
}

export function findForbiddenImports(
  predicate: (edge: ModuleEdge) => boolean,
  files: Record<string, string> = sourceFiles
): string[] {
  return listModuleEdges(files)
    .filter(predicate)
    .map((edge) => `${edge.fromFile}: ${edge.specifier}`)
    .sort();
}

export function findForbiddenSymbols(
  predicate: (file: string, source: string) => boolean,
  files: Record<string, string> = sourceFiles
): string[] {
  return Object.entries(files)
    .filter(([file]) => file !== "./architecture-boundaries.test.ts")
    .filter(([file, source]) => predicate(file, source))
    .map(([file]) => file)
    .sort();
}

export function listProductionSourceFiles(files: Record<string, string> = sourceFiles): string[] {
  return Object.keys(files)
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !file.endsWith(".test.ts"))
    .filter((file) => file !== "./architecture-boundaries.test.ts")
    .filter((file) => !file.startsWith("./test-support/"))
    .sort();
}

export function createSourceZoneMap(
  files: Record<string, string>,
  zones: readonly SourceZoneDefinition[]
): SourceZoneMap {
  const entries = listProductionSourceFiles(files)
    .map((file) => ({
      file,
      zones: zones.filter((zone) => zone.includes(file))
    }));
  const unclassified = entries
    .filter((entry) => entry.zones.length === 0)
    .map((entry) => entry.file)
    .sort();
  const ambiguousCandidateFiles = entries
    .filter((entry) => entry.zones.filter((zone) => zone.debt !== true).length > 1)
    .map((entry) => entry.file)
    .sort();
  const debtEntries = entries
    .filter((entry) => entry.zones.some((zone) => zone.debt === true))
    .sort((left, right) => left.file.localeCompare(right.file));

  return {
    entries,
    unclassified,
    ambiguousCandidateFiles,
    debtEntries
  };
}

export function definePathZone(
  id: string,
  description: string,
  patterns: readonly RegExp[],
  options: { readonly debt?: boolean } = {}
): SourceZoneDefinition {
  return {
    id,
    description,
    debt: options.debt,
    includes(file: string): boolean {
      return patterns.some((pattern) => pattern.test(file));
    }
  };
}

function parseImportDeclarations(source: string): StaticModuleImport[] {
  const imports: StaticModuleImport[] = [];
  const declarationPattern = /import\s+(type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(declarationPattern)) {
    const declaration = match[0];
    const specifier = match[2];
    imports.push({
      specifier,
      kind: "import",
      typeOnly: Boolean(match[1]) || /^import\s*{\s*type\b/.test(declaration),
      sideEffectOnly: !/\bfrom\b/.test(declaration)
    });
  }
  return imports;
}

function parseDynamicImports(source: string): Array<Omit<DynamicModuleImport, "fromFile">> {
  const imports: Array<Omit<DynamicModuleImport, "fromFile">> = [];
  const dynamicImportPattern = /\bimport\s*\(\s*(?:(["'])([^"']+)\1|[^)]*)\s*\)/g;
  for (const match of source.matchAll(dynamicImportPattern)) {
    imports.push({
      specifier: match[2] ?? null
    });
  }
  return imports;
}

function collectSourceFilesFromDirectory(directory: string, collected: Record<string, string>): void {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      collectSourceFilesFromDirectory(absolutePath, collected);
      continue;
    }
    if (!entry.endsWith(".ts") || entry.endsWith(".d.ts")) continue;
    collected[absolutePath] = readFileSync(absolutePath, "utf8");
  }
}

function parseExportFromDeclarations(source: string): StaticModuleImport[] {
  const exports: StaticModuleImport[] = [];
  const declarationPattern = /export\s+(type\s+)?(?:\*|{[^}]*})\s+from\s+["']([^"']+)["']/g;
  for (const match of source.matchAll(declarationPattern)) {
    exports.push({
      specifier: match[2],
      kind: "export",
      typeOnly: Boolean(match[1]),
      sideEffectOnly: false
    });
  }
  return exports;
}

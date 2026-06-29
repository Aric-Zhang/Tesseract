import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  barePackageName,
  collectWorkspaceSourceFiles,
  listModuleEdges,
  type ModuleEdge
} from "./architecture-boundaries";

export type WorkspacePackageZone = "actor" | "ui" | "runtime" | "editor" | "app" | "math";

export interface WorkspacePackageDescriptor {
  readonly name: string;
  readonly directory: string;
  readonly sourceRoot: string;
  readonly manifestPath: string;
  readonly zone: WorkspacePackageZone;
}

export interface WorkspacePackageManifest {
  readonly name: string;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
}

export interface WorkspacePackageGraphNode {
  readonly name: string;
  readonly dependencies: readonly string[];
}

export interface PackageDependencyRule {
  readonly sourcePackage: string;
  readonly forbiddenPackages: readonly string[];
}

export interface PackageDependencyViolation {
  readonly sourcePackage: string;
  readonly fromFile: string;
  readonly targetPackage: string;
  readonly specifier: string;
}

export interface SubmoduleZoneDefinition {
  readonly id: string;
  includes(file: string): boolean;
}

export interface SubmoduleDependencyRule {
  readonly sourceZone: string;
  readonly forbiddenTargetZones?: readonly string[];
  readonly forbiddenRootPackages?: readonly string[];
}

export interface SubmoduleDependencyViolation {
  readonly fromFile: string;
  readonly sourceZone: string;
  readonly target: string;
  readonly specifier: string;
}

export const workspacePackageDescriptors = [
  descriptor("actor-system", "packages/actor-system", "actor"),
  descriptor("ui-framework", "packages/ui-framework", "ui"),
  descriptor("runtime-core", "packages/runtime-core", "runtime"),
  descriptor("runtime-three", "packages/runtime-three", "runtime"),
  descriptor("wallpaper-runtime", "packages/wallpaper-runtime", "runtime"),
  descriptor("editor", "packages/editor", "editor"),
  descriptor("four-rotation", "packages/four-rotation", "math"),
  descriptor("four-camera", "packages/four-camera", "math"),
  descriptor("four-camera-three", "packages/four-camera-three", "math"),
  descriptor("wallpaper-tesseract", "apps/wallpaper-tesseract", "app")
] as const satisfies readonly WorkspacePackageDescriptor[];

export const currentPackageDependencyRules = [
  rule("actor-system", [
    "ui-framework",
    "runtime-core",
    "runtime-three",
    "wallpaper-runtime",
    "editor",
    "wallpaper-tesseract",
    "four-rotation",
    "four-camera",
    "four-camera-three"
  ]),
  rule("ui-framework", [
    "runtime-core",
    "runtime-three",
    "wallpaper-runtime",
    "editor",
    "wallpaper-tesseract"
  ]),
  rule("runtime-core", [
    "actor-system",
    "ui-framework",
    "runtime-three",
    "wallpaper-runtime",
    "editor",
    "wallpaper-tesseract"
  ]),
  rule("runtime-three", [
    "actor-system",
    "ui-framework",
    "wallpaper-runtime",
    "editor",
    "wallpaper-tesseract"
  ]),
  rule("wallpaper-runtime", [
    "ui-framework",
    "editor",
    "wallpaper-tesseract"
  ]),
  rule("editor", [
    "runtime-three",
    "wallpaper-runtime",
    "wallpaper-tesseract"
  ]),
  rule("four-rotation", [
    "actor-system",
    "ui-framework",
    "runtime-core",
    "runtime-three",
    "wallpaper-runtime",
    "editor",
    "wallpaper-tesseract"
  ]),
  rule("four-camera", [
    "actor-system",
    "ui-framework",
    "runtime-core",
    "runtime-three",
    "wallpaper-runtime",
    "editor",
    "wallpaper-tesseract"
  ]),
  rule("four-camera-three", [
    "actor-system",
    "ui-framework",
    "runtime-core",
    "runtime-three",
    "wallpaper-runtime",
    "editor",
    "wallpaper-tesseract"
  ])
] as const satisfies readonly PackageDependencyRule[];

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

export function isProductionSourceFile(file: string): boolean {
  return file.endsWith(".ts") &&
    !file.endsWith(".test.ts") &&
    !file.includes("/src/test-support/") &&
    !file.includes("/dist/") &&
    !file.endsWith(".d.ts");
}

export function readWorkspacePackageManifest(
  descriptor: WorkspacePackageDescriptor
): WorkspacePackageManifest {
  return JSON.parse(readFileSync(join(repositoryRoot, descriptor.manifestPath), "utf8")) as WorkspacePackageManifest;
}

export function listWorkspaceManifestDirectories(): string[] {
  return [
    ...listPackageDirectories("packages"),
    ...listPackageDirectories("apps")
  ].sort();
}

export function collectProductionWorkspaceSources(
  descriptors: readonly WorkspacePackageDescriptor[] = workspacePackageDescriptors
): Record<string, string> {
  const entries = descriptors.flatMap((descriptor) => (
    Object.entries(collectWorkspaceSourceFiles(descriptor.sourceRoot))
      .filter(([file]) => isProductionSourceFile(file))
  ));
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

export function listProductionWorkspaceEdges(
  descriptors: readonly WorkspacePackageDescriptor[] = workspacePackageDescriptors
): ModuleEdge[] {
  return listModuleEdges(collectProductionWorkspaceSources(descriptors));
}

export function createWorkspacePackageGraph(
  descriptors: readonly WorkspacePackageDescriptor[] = workspacePackageDescriptors,
  manifests: ReadonlyMap<string, WorkspacePackageManifest> = readManifestMap(descriptors)
): WorkspacePackageGraphNode[] {
  const packageNames = new Set(descriptors.map((descriptor) => descriptor.name));
  return descriptors
    .map((descriptor) => {
      const manifest = manifests.get(descriptor.name) ?? readWorkspacePackageManifest(descriptor);
      return {
        name: descriptor.name,
        dependencies: Object.keys({
          ...manifest.dependencies,
          ...manifest.peerDependencies
        })
          .filter((dependency) => packageNames.has(dependency))
          .sort()
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function findPackageDependencyCycles(
  graph: readonly WorkspacePackageGraphNode[]
): string[] {
  const dependenciesByPackage = new Map(graph.map((node) => [node.name, [...node.dependencies].sort()]));
  const cycles = new Set<string>();

  for (const node of [...dependenciesByPackage.keys()].sort()) {
    visitPackage(node, [], dependenciesByPackage, cycles);
  }

  return [...cycles].sort();
}

export function findUndeclaredWorkspaceImports(
  descriptors: readonly WorkspacePackageDescriptor[] = workspacePackageDescriptors,
  edges: readonly ModuleEdge[] = listProductionWorkspaceEdges(descriptors),
  manifests: ReadonlyMap<string, WorkspacePackageManifest> = readManifestMap(descriptors)
): string[] {
  const packageNames = new Set(descriptors.map((descriptor) => descriptor.name));
  return edges
    .map((edge) => {
      const owner = findDescriptorForFile(edge.fromFile, descriptors);
      if (!owner) return null;
      const importedPackage = barePackageName(edge.specifier);
      if (!packageNames.has(importedPackage) || importedPackage === owner.name) return null;
      const declared = manifestDependencySet(manifests.get(owner.name) ?? readWorkspacePackageManifest(owner));
      return declared.has(importedPackage)
        ? null
        : `${owner.name}: ${edge.fromFile} imports undeclared ${importedPackage}`;
    })
    .filter((entry): entry is string => entry !== null)
    .sort();
}

export function evaluatePackageDependencyRules(
  descriptors: readonly WorkspacePackageDescriptor[] = workspacePackageDescriptors,
  rules: readonly PackageDependencyRule[] = currentPackageDependencyRules,
  edges: readonly ModuleEdge[] = listProductionWorkspaceEdges(descriptors)
): PackageDependencyViolation[] {
  const rulesByPackage = new Map(rules.map((entry) => [entry.sourcePackage, new Set(entry.forbiddenPackages)]));
  const packageNames = new Set(descriptors.map((descriptor) => descriptor.name));
  const violations: PackageDependencyViolation[] = [];

  for (const edge of edges) {
    const sourcePackage = findDescriptorForFile(edge.fromFile, descriptors)?.name;
    if (!sourcePackage) continue;
    const forbiddenPackages = rulesByPackage.get(sourcePackage);
    if (!forbiddenPackages) continue;
    const targetPackage = resolveTargetPackage(edge, descriptors, packageNames);
    if (!targetPackage || !forbiddenPackages.has(targetPackage)) continue;
    violations.push({
      sourcePackage,
      fromFile: edge.fromFile,
      targetPackage,
      specifier: edge.specifier
    });
  }

  return violations.sort((left, right) => (
    left.sourcePackage.localeCompare(right.sourcePackage) ||
    left.fromFile.localeCompare(right.fromFile) ||
    left.targetPackage.localeCompare(right.targetPackage) ||
    left.specifier.localeCompare(right.specifier)
  ));
}

export function evaluateSubmoduleDependencyRules(
  files: Record<string, string>,
  zones: readonly SubmoduleZoneDefinition[],
  rules: readonly SubmoduleDependencyRule[]
): SubmoduleDependencyViolation[] {
  const edges = listModuleEdges(files);
  const rulesByZone = new Map(rules.map((entry) => [entry.sourceZone, entry]));
  const violations: SubmoduleDependencyViolation[] = [];

  for (const edge of edges) {
    const sourceZone = zones.find((zone) => zone.includes(edge.fromFile));
    if (!sourceZone) continue;
    const rule = rulesByZone.get(sourceZone.id);
    if (!rule) continue;

    const targetZone = resolveSubmoduleTargetZone(edge, zones);
    if (targetZone && rule.forbiddenTargetZones?.includes(targetZone.id)) {
      violations.push({
        fromFile: edge.fromFile,
        sourceZone: sourceZone.id,
        target: targetZone.id,
        specifier: edge.specifier
      });
      continue;
    }

    const importedPackage = barePackageName(edge.specifier);
    if (rule.forbiddenRootPackages?.includes(importedPackage) && edge.specifier === importedPackage) {
      violations.push({
        fromFile: edge.fromFile,
        sourceZone: sourceZone.id,
        target: importedPackage,
        specifier: edge.specifier
      });
    }
  }

  return violations.sort((left, right) => (
    left.fromFile.localeCompare(right.fromFile) ||
    left.sourceZone.localeCompare(right.sourceZone) ||
    left.target.localeCompare(right.target) ||
    left.specifier.localeCompare(right.specifier)
  ));
}

function resolveSubmoduleTargetZone(
  edge: ModuleEdge,
  zones: readonly SubmoduleZoneDefinition[]
): SubmoduleZoneDefinition | null {
  if (edge.resolvedFile !== null) {
    return zones.find((zone) => zone.includes(edge.resolvedFile!)) ?? null;
  }
  return zones.find((zone) => (
    edge.specifier === zone.id || edge.specifier.startsWith(`${zone.id}/`)
  )) ?? null;
}

export function defineSubmoduleZone(id: string, prefix: string): SubmoduleZoneDefinition {
  return {
    id,
    includes(file: string): boolean {
      return file.startsWith(prefix);
    }
  };
}

export function findDescriptorForFile(
  file: string,
  descriptors: readonly WorkspacePackageDescriptor[] = workspacePackageDescriptors
): WorkspacePackageDescriptor | null {
  return descriptors.find((descriptor) => (
    file === descriptor.directory ||
    file.startsWith(`${descriptor.directory}/`)
  )) ?? null;
}

function descriptor(
  name: string,
  directory: string,
  zone: WorkspacePackageZone
): WorkspacePackageDescriptor {
  return {
    name,
    directory,
    sourceRoot: `${directory}/src`,
    manifestPath: `${directory}/package.json`,
    zone
  };
}

function rule(
  sourcePackage: string,
  forbiddenPackages: readonly string[]
): PackageDependencyRule {
  return { sourcePackage, forbiddenPackages };
}

function readManifestMap(
  descriptors: readonly WorkspacePackageDescriptor[]
): Map<string, WorkspacePackageManifest> {
  return new Map(descriptors.map((descriptor) => [
    descriptor.name,
    readWorkspacePackageManifest(descriptor)
  ]));
}

function manifestDependencySet(manifest: WorkspacePackageManifest): Set<string> {
  return new Set(Object.keys({
    ...manifest.dependencies,
    ...manifest.peerDependencies
  }));
}

function resolveTargetPackage(
  edge: ModuleEdge,
  descriptors: readonly WorkspacePackageDescriptor[],
  packageNames: ReadonlySet<string>
): string | null {
  const importedPackage = barePackageName(edge.specifier);
  if (packageNames.has(importedPackage)) return importedPackage;
  if (edge.resolvedFile === null) return null;
  return findDescriptorForFile(edge.resolvedFile, descriptors)?.name ?? null;
}

function visitPackage(
  node: string,
  path: readonly string[],
  dependenciesByPackage: ReadonlyMap<string, readonly string[]>,
  cycles: Set<string>
): void {
  const existingIndex = path.indexOf(node);
  if (existingIndex >= 0) {
    const cycle = [...path.slice(existingIndex), node];
    cycles.add(canonicalCycle(cycle));
    return;
  }

  const dependencies = dependenciesByPackage.get(node) ?? [];
  for (const dependency of dependencies) {
    if (!dependenciesByPackage.has(dependency)) continue;
    visitPackage(dependency, [...path, node], dependenciesByPackage, cycles);
  }
}

function canonicalCycle(cycle: readonly string[]): string {
  const nodes = cycle.slice(0, -1);
  const rotations = nodes.map((_, index) => {
    const rotated = [...nodes.slice(index), ...nodes.slice(0, index)];
    return [...rotated, rotated[0]].join(" -> ");
  });
  return rotations.sort()[0] ?? cycle.join(" -> ");
}

function listPackageDirectories(workspaceRoot: "packages" | "apps"): string[] {
  const absoluteRoot = join(repositoryRoot, workspaceRoot);
  return readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => relative(repositoryRoot, join(absoluteRoot, entry.name)).replaceAll("\\", "/"));
}

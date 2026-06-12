import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateProjectPrismSmokeEvidence,
  type ProjectPrismSmokeEvidence
} from "./project-prism-smoke-contract";

describe("Project Prism smoke evidence file", () => {
  it("validates PROJECT_PRISM_SMOKE_EVIDENCE when provided", () => {
    const evidencePath = process.env.PROJECT_PRISM_SMOKE_EVIDENCE;
    if (!evidencePath) {
      return;
    }
    const resolvedPath = resolveEvidencePath(evidencePath);
    expect(resolvedPath, `smoke evidence file not found: ${evidencePath}`).not.toBeNull();

    const raw = readFileSync(resolvedPath!, "utf8");
    const evidence = JSON.parse(raw) as ProjectPrismSmokeEvidence;

    expect(validateProjectPrismSmokeEvidence(evidence)).toEqual([]);
  });
});

function resolveEvidencePath(evidencePath: string): string | null {
  const candidates = isAbsolute(evidencePath)
    ? [evidencePath]
    : [
        resolve(process.cwd(), evidencePath),
        resolve(process.cwd(), "..", "..", evidencePath)
      ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

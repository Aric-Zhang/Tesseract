import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const server = await createServer({
  appType: "custom",
  configFile: resolve(root, "apps/wallpaper-tesseract/vite.config.ts"),
  server: { middlewareMode: true }
});

try {
  const boundaries = await server.ssrLoadModule(
    resolve(root, "apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts")
  );
  const report = await server.ssrLoadModule(
    resolve(root, "apps/wallpaper-tesseract/src/test-support/project-prism-boundary-report.ts")
  );
  const summary = report.createProjectPrismBoundarySummary(boundaries.sourceFiles);
  mkdirSync(resolve(root, "temp"), { recursive: true });
  writeFileSync(
    resolve(root, "temp/project-prism-phase-0b-boundary-summary.json"),
    report.serializeProjectPrismBoundarySummary(summary)
  );
  writeFileSync(
    resolve(root, "temp/project-prism-phase-0-boundary-report.md"),
    report.renderProjectPrismBoundarySummaryMarkdown(summary)
  );
  console.log("Generated Project Prism Phase 0 boundary report.");
} finally {
  await server.close();
}

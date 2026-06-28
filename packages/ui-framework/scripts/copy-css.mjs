import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = [
  ["src/ui/ui-framework-controls.css", "dist/ui/ui-framework-controls.css"]
];

for (const [source, target] of files) {
  const resolvedTarget = resolve(target);
  mkdirSync(dirname(resolvedTarget), { recursive: true });
  copyFileSync(resolve(source), resolvedTarget);
}

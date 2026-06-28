import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const files = [
  ["src/ui/ui-framework-controls.css", "dist/ui/ui-framework-controls.css"]
];

const { generateUiThemeCss } = await import(
  pathToFileURL(resolve("dist/ui/theme/ui-theme-css.js")).href
);
mkdirSync(resolve("dist/ui"), { recursive: true });
writeFileSync(resolve("dist/ui/theme.css"), generateUiThemeCss());

for (const [source, target] of files) {
  const resolvedTarget = resolve(target);
  mkdirSync(dirname(resolvedTarget), { recursive: true });
  copyFileSync(resolve(source), resolvedTarget);
}

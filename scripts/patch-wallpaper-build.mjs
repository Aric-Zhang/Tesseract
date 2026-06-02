import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const htmlPath = join(root, "apps", "wallpaper-tesseract", "dist", "index.html");
const html = await readFile(htmlPath, "utf8");

await writeFile(
  htmlPath,
  html
    .replace(/\s+type="module"/g, "")
    .replace(/\s+crossorigin/g, "")
    .replace(/<script src=/g, "<script defer src="),
  "utf8"
);

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "apps", "wallpaper-tesseract", "dist");

const html = await readFile(join(dist, "index.html"), "utf8");
await writeFile(
  join(root, "index.html"),
  html
    .replace(/\s+type="module"/g, "")
    .replace(/\s+crossorigin/g, "")
    .replace(/<script src=/g, "<script defer src="),
  "utf8"
);
await rm(join(root, "assets"), { recursive: true, force: true });
await mkdir(join(root, "assets"), { recursive: true });
await cp(join(dist, "assets"), join(root, "assets"), { recursive: true });

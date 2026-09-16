/**
 * Copies the Syncfusion PDF Viewer standalone library (pdfium.js + pdfium.wasm)
 * from node_modules into public/ej2-pdfviewer-lib so the client-side PDF Viewer
 * can resolve its WASM resources from a version-matched local `resourceUrl`
 * (the default CDN resourceUrl targets a mismatched package version).
 *
 * Runs via the `postinstall` and `predev` npm scripts; safe to re-run.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const src = resolve(
  appRoot,
  "node_modules/@syncfusion/ej2-pdfviewer/dist/ej2-pdfviewer-lib"
);
const dest = resolve(appRoot, "public/ej2-pdfviewer-lib");

if (!existsSync(src)) {
  console.warn(
    `[copy-pdfviewer-lib] source not found: ${src} — skipping (run npm install first).`
  );
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-pdfviewer-lib] copied ${src} -> ${dest}`);

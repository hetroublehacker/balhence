import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const vendor = path.join(root, "vendor/threeui");
const hashes = {
  "src/shaders/typography-vortex/TypographyVortexCanvas.tsx": "cf347075dcc6254aeeb3b7f373c02ae90566923b04f1fcd223093fb1b6a587b1",
  "src/shaders/typography-vortex/typographyVortexRenderer.ts": "b82c8321564f841334c109910bff3a7f629d9f2f7750c91d537b65912a17baff",
  "src/shaders/threeui.css": "efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf",
  "src/shaders/fonts/fragment-mono.woff2": "4f4dc27f4a770c0d02fde800daa836c8adc0d1e423b28da74baaf0d1cc3ab96c",
};
for (const [file, expected] of Object.entries(hashes)) {
  const bytes = await readFile(path.join(vendor, file));
  if (createHash("sha256").update(bytes).digest("hex") !== expected) {
    throw new Error(`ThreeUI source integrity mismatch: ${file}`);
  }
  if (file.endsWith(".woff2") && bytes.length !== 15176) throw new Error("Incorrect font size");
}

const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/animation/mount.ts"],
  outfile: "type-field.js",
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  target: ["es2020"],
  charset: "ascii",
  legalComments: "eof",
  banner: { js: "/*! Balhence native canvas adapter. Includes ThreeUI renderer (MIT); see /vendor/threeui/LICENSE.txt. */" },
});
if (result.outputFiles.some(output => output.contents.length > 16000)) {
  throw new Error("Animation exceeded its 16 KB startup budget; inspect bundled dependencies");
}
for (const output of result.outputFiles) {
  if (process.argv.includes("--check")) {
    const current = await readFile(output.path);
    if (!current.equals(output.contents)) throw new Error("Stale animation bundle; run npm run build:animation");
  } else {
    await writeFile(output.path, output.contents);
  }
}
console.log("Verified all four ThreeUI hashes; animation bundle " + (process.argv.includes("--check") ? "matches source." : "built."));

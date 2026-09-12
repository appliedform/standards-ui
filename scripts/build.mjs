// Builds every pack: type declarations with tsc, an ESM bundle with esbuild.
import { execSync } from "node:child_process";
import { readdirSync, existsSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPackageAlignment } from "./support-manifest.mjs";

// fileURLToPath, not .pathname: the repo path contains a space, which
// .pathname leaves percent-encoded and readdir cannot resolve.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
assertPackageAlignment();
const packagesDir = join(root, "packages");
// A package counts as buildable only once it has an entry point — scaffolded
// packs whose moves are not written yet are skipped rather than failing the run.
const packs = readdirSync(packagesDir).filter((p) =>
  existsSync(join(packagesDir, p, "src/index.ts"))
);

for (const p of packs) {
  const dir = join(packagesDir, p);
  process.stdout.write(`  ${p.padEnd(12)}`);
  rmSync(join(dir, "dist"), { recursive: true, force: true });
  execSync(`npx tsc -p "${join(dir, "tsconfig.json")}"`, { stdio: "inherit" });
  execSync(
    `npx esbuild "${join(dir, "src/index.ts")}" --bundle --format=esm --platform=browser ` +
      `--external:react --external:react/jsx-runtime --external:@standards/core ` +
      `--outfile="${join(dir, "dist/index.js")}" --log-level=error`,
    { stdio: "inherit" }
  );
  const stylesDir = join(dir, "src/styles");
  if (existsSync(stylesDir)) {
    mkdirSync(join(dir, "dist/styles"), { recursive: true });
    for (const file of readdirSync(stylesDir)) {
      if (file.endsWith(".css")) copyFileSync(join(stylesDir, file), join(dir, "dist/styles", file));
    }
  }
  const fontsDir = join(dir, "src/fonts");
  if (existsSync(fontsDir)) {
    const files = readdirSync(fontsDir);
    if (!files.some((file) => file.endsWith(".woff2")) || !files.some((file) => file.startsWith("OFL-"))) {
      throw new Error(`${p}: font bundle must contain WOFF2 files and OFL licence texts`);
    }
    mkdirSync(join(dir, "dist/fonts"), { recursive: true });
    for (const file of files) copyFileSync(join(fontsDir, file), join(dir, "dist/fonts", file));
  }
  console.log("built");
}
console.log(`\n${packs.length} package(s) built`);

// Builds every pack: type declarations with tsc, an ESM bundle with esbuild.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { readdirSync, existsSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPackageAlignment } from "./support-manifest.mjs";
import { assertOutputDirectories, publishOutputs } from "./build-output.mjs";

// fileURLToPath, not .pathname: the repo path contains a space, which
// .pathname leaves percent-encoded and readdir cannot resolve.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
// Resolve installed tools, never ask npx to download or execute a fallback.
const tsc = require.resolve("typescript/bin/tsc");
assertPackageAlignment();
const packagesDir = join(root, "packages");
// A package counts as buildable only once it has an entry point — scaffolded
// packs whose moves are not written yet are skipped rather than failing the run.
const packs = readdirSync(packagesDir).filter((p) =>
  existsSync(join(packagesDir, p, "src/index.ts"))
).sort((a, b) => a === "core" ? -1 : b === "core" ? 1 : a.localeCompare(b));

assertOutputDirectories(packagesDir, packs);
const lock = join(root, ".standards-build.lock");
try { mkdirSync(lock); }
catch (error) {
  if (error.code === "EEXIST") throw new Error("Another build or an interrupted build owns .standards-build.lock; inspect it before retrying");
  throw error;
}
let stage;
let preserveStage = false;
try {
  writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  stage = mkdtempSync(join(root, ".standards-build-"));
  for (const p of packs) {
    const dir = join(packagesDir, p);
    const output = join(stage, p);
    const config = join(stage, `${p}.json`);
    process.stdout.write(`  ${p.padEnd(12)}`);
    writeFileSync(config, JSON.stringify({
      extends: join(dir, "tsconfig.json"),
      compilerOptions: { outDir: output, paths: { "@standards/core": [join(stage, "core/index.d.ts")] } },
    }));
    // A checkout path is data even when it contains quotes or shell syntax.
    execFileSync(process.execPath, [tsc, "-p", config], { stdio: "inherit", cwd: root });
    buildSync({
      absWorkingDir: root, entryPoints: [join(dir, "src/index.ts")], bundle: true,
      format: "esm", platform: "browser", external: ["react", "react/jsx-runtime", "@standards/core"],
      outfile: join(output, "index.js"), logLevel: "error",
    });
    const stylesDir = join(dir, "src/styles");
    if (existsSync(stylesDir)) {
      mkdirSync(join(output, "styles"), { recursive: true });
      for (const file of readdirSync(stylesDir)) {
        if (file.endsWith(".css")) copyFileSync(join(stylesDir, file), join(output, "styles", file));
      }
    }
    const fontsDir = join(dir, "src/fonts");
    if (existsSync(fontsDir)) {
      const files = readdirSync(fontsDir);
      if (!files.some((file) => file.endsWith(".woff2")) || !files.some((file) => file.startsWith("OFL-"))) {
        throw new Error(`${p}: font bundle must contain WOFF2 files and OFL licence texts`);
      }
      mkdirSync(join(output, "fonts"), { recursive: true });
      for (const file of files) copyFileSync(join(fontsDir, file), join(output, "fonts", file));
    }
    console.log("built");
  }
  publishOutputs(packagesDir, packs, stage);
  console.log(`\n${packs.length} package(s) built`);
} catch (error) {
  preserveStage = error.preserveStage === true;
  throw error;
} finally {
  if (stage && !preserveStage) rmSync(stage, { recursive: true, force: true });
  // On interrupted recovery retain the lock as well as all backup material.
  if (!preserveStage) rmSync(lock, { recursive: true });
}

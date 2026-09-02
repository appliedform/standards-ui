// Builds every pack: type declarations with tsc, an ESM bundle with esbuild.
import { execSync } from "node:child_process";
import { readdirSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname: the repo path contains a space, which
// .pathname leaves percent-encoded and readdir cannot resolve.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");
// A package counts as buildable only once it has an entry point — scaffolded
// packs whose moves are not written yet are skipped rather than failing the run.
const packs = readdirSync(packagesDir).filter((p) =>
  existsSync(join(packagesDir, p, "src/index.ts"))
);

for (const p of packs) {
  const dir = join(packagesDir, p);
  process.stdout.write(`  ${p.padEnd(12)}`);
  execSync(`npx tsc -p "${join(dir, "tsconfig.json")}"`, { stdio: "inherit" });
  execSync(
    `npx esbuild "${join(dir, "src/index.ts")}" --bundle --format=esm --platform=browser ` +
      `--external:react --external:react/jsx-runtime --external:@standards/core ` +
      `--outfile="${join(dir, "dist/index.js")}" --log-level=error`,
    { stdio: "inherit" }
  );
  const css = join(dir, "src/styles/tokens.css");
  if (existsSync(css)) {
    mkdirSync(join(dir, "dist/styles"), { recursive: true });
    copyFileSync(css, join(dir, "dist/styles/tokens.css"));
  }
  console.log("built");
}
console.log(`\n${packs.length} package(s) built`);

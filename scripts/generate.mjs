// Generates each pack's src/meta.ts from its vendored archetypes.json.
//
// meta.ts has always said "generated, do not edit by hand". Until now nothing
// generated it: it was hand-written and verified after the fact by audit.mjs,
// which is a weaker guarantee than it sounds, because the audit only ran when
// somebody remembered to run it. This makes the claim true.
//
//   node scripts/generate.mjs           write meta.ts for every pack
//   node scripts/generate.mjs --check   fail if any meta.ts is out of date
import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const packagesDir = join(root, "packages");

const packs = readdirSync(packagesDir).filter(
  (p) => p !== "core" && existsSync(join(packagesDir, p, "archetypes.json"))
);

const stale = [];
for (const pack of packs) {
  const dir = join(packagesDir, pack);
  const arch = JSON.parse(readFileSync(join(dir, "archetypes.json"), "utf8"));
  const entries = arch.moves
    .map((m) => {
      const meta = { job: m.job, move: m.move, when: m.when, why: m.why };
      return `  ${JSON.stringify(m.move)}: ${JSON.stringify(meta, null, 2)
        .split("\n")
        .map((l, i) => (i === 0 ? l : "  " + l))
        .join("\n")},`;
    })
    .join("\n");

  const out =
    `import type { MoveMeta } from "@standards/core";\n\n` +
    `/** Generated from ${pack}/archetypes.json by scripts/generate.mjs. Do not edit by hand. */\n` +
    `export const META: Record<string, MoveMeta> = {\n${entries}\n};\n`;

  const path = join(dir, "src/meta.ts");
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (current === out) {
    console.log(`  ${pack.padEnd(12)} up to date`);
    continue;
  }
  if (check) {
    stale.push(pack);
    console.log(`  ${pack.padEnd(12)} STALE`);
  } else {
    writeFileSync(path, out);
    console.log(`  ${pack.padEnd(12)} written (${arch.moves.length} moves)`);
  }
}

if (stale.length) {
  console.error(
    `\nmeta.ts is out of date for: ${stale.join(", ")}\n` +
      `Run "npm run generate" and commit the result. Never edit meta.ts by hand.`
  );
  process.exit(1);
}

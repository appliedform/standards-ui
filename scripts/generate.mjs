// Generates each pack's src/meta.ts from its vendored archetypes.json.
//
// meta.ts has always said "generated, do not edit by hand". Until now nothing
// generated it: it was hand-written and verified after the fact by audit.mjs,
// which is a weaker guarantee than it sounds, because the audit only ran when
// somebody remembered to run it. This makes the claim true.
//
// It also generates src/tokens.generated.ts from the vendored tokens.json, so a
// pack's Root can put its own custom properties in scope. Shipping tokens.css
// and trusting the consumer to import it is not good enough: nothing in the JS
// entry references that file, so a consumer who misses it gets every component
// rendering unstyled, silently.
//
//   node scripts/generate.mjs           write meta.ts and tokens.generated.ts
//   node scripts/generate.mjs --check   fail if either is out of date
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
  const tokens = JSON.parse(readFileSync(join(dir, "tokens.json"), "utf8"));
  const entries = arch.moves
    .map((m) => {
      const meta = { job: m.job, move: m.move, when: m.when, why: m.why };
      return `  ${JSON.stringify(m.move)}: ${JSON.stringify(meta, null, 2)
        .split("\n")
        .map((l, i) => (i === 0 ? l : "  " + l))
        .join("\n")},`;
    })
    .join("\n");

  const metaOut =
    `import type { MoveMeta } from "@standards/core";\n\n` +
    `/** Generated from ${pack}/archetypes.json by scripts/generate.mjs. Do not edit by hand. */\n` +
    `export const META: Record<string, MoveMeta> = {\n${entries}\n};\n`;

  // The pack's own custom properties, as a string the Root injects. This is what
  // makes the tokens unmissable: nothing in the JS entry referenced tokens.css,
  // so a consumer who never imported it got every component silently unstyled.
  const decls = [
    ...Object.entries(tokens.colour).map(([k, v]) => `  --${k}: ${v.value};`),
    ...Object.entries(tokens.type).map(([k, v]) => `  --font-${k}: ${v};`),
    ...Object.entries(tokens.system_values)
      .filter(([, v]) => typeof v === "string" && !String(v).startsWith("var("))
      .map(([k, v]) => `  --${k}: ${v};`),
  ].join("\n");
  const tokensOut =
    `/** Generated from ${pack}/tokens.json by scripts/generate.mjs. Do not edit by hand. */\n` +
    "export const TOKENS = `\n" + decls + "\n`;\n\n" +
    `/** Token values in JS, for consumers that need them outside CSS. */\n` +
    `export const VALUES = ${JSON.stringify(
      Object.fromEntries(Object.entries(tokens.colour).map(([k, v]) => [k, v.value])),
      null,
      2
    )} as const;\n`;

  for (const [rel, out, label] of [
    ["src/meta.ts", metaOut, `${arch.moves.length} moves`],
    ["src/tokens.generated.ts", tokensOut, `${Object.keys(tokens.colour).length} colours`],
  ]) {
    const path = join(dir, rel);
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (current === out) {
      console.log(`  ${pack.padEnd(12)} ${rel.padEnd(26)} up to date`);
      continue;
    }
    if (check) {
      stale.push(`${pack}/${rel}`);
      console.log(`  ${pack.padEnd(12)} ${rel.padEnd(26)} STALE`);
    } else {
      writeFileSync(path, out);
      console.log(`  ${pack.padEnd(12)} ${rel.padEnd(26)} written (${label})`);
    }
  }
}

if (stale.length) {
  console.error(
    `\nGenerated source is out of date: ${stale.join(", ")}\n` +
      `Run "npm run generate" and commit the result. Never edit generated files by hand.`
  );
  process.exit(1);
}

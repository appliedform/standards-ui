// Conformance audit. Two halves:
//   1. Contract — every move a pack declares in archetypes.json is exported as a
//      component whose metadata matches it exactly, and every job is covered.
//   2. Materials — the source obeys the pack's own token and spacing rules.
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Each package vendors its own archetypes.json and tokens.json, so the audit
// is self-contained and never reaches outside this repository.
const contractFor = (pack) => join(root, "packages", pack);
const JOBS = ["E", "S", "N", "C", "T", "W"];
const fails = [], warns = [];

const packs = readdirSync(join(root, "packages")).filter(
  (p) => p !== "core" && existsSync(join(root, "packages", p, "dist/index.js"))
);

for (const pack of packs) {
  const dir = join(root, "packages", pack);
  const arch = JSON.parse(readFileSync(join(contractFor(pack), "archetypes.json"), "utf8"));
  const mod = await import(join(dir, "dist/index.js"));

  const exported = new Map();
  for (const [name, v] of Object.entries(mod)) {
    if (v && typeof v === "function" && v.meta) exported.set(v.meta.move, v.meta);
  }

  // 1a. every declared move is implemented, with matching metadata
  for (const m of arch.moves) {
    const got = exported.get(m.move);
    if (!got) { fails.push(`${pack}: move "${m.move}" declared but not exported`); continue; }
    for (const k of ["job", "when", "why"]) {
      if (got[k] !== m[k]) fails.push(`${pack}/${m.move}: ${k} differs from archetypes.json`);
    }
  }
  // 1b. nothing exported that the pack does not declare
  for (const name of exported.keys()) {
    if (!arch.moves.some((m) => m.move === name)) fails.push(`${pack}: exports undeclared move "${name}"`);
  }
  // 1c. the six-job spine is covered
  const covered = new Set([...exported.values()].map((m) => m.job));
  for (const j of JOBS) if (!covered.has(j)) warns.push(`${pack}: no move answers job ${j}`);

  // 2. materials, checked against the pack's own tokens.json
  const tokens = JSON.parse(readFileSync(join(contractFor(pack), "tokens.json"), "utf8"));
  const allowed = new Set(Object.values(tokens.colour).map((c) => c.value.toUpperCase()));
  allowed.add("#FFFFFF");
  // Spacing is legal if it is a multiple of the pack's base unit, or one of the
  // pack's own declared system values. Some packs deliberately sit off the grid,
  // and those values are the system rather than a slip — so the contract, not a
  // fixed ladder, defines what is allowed.
  const unit = parseInt(tokens.system_values.unit || "8");
  const named = new Set(
    Object.values(tokens.system_values)
      .map((v) => parseInt(String(v)))
      .filter((n) => !Number.isNaN(n))
  );
  const legal = (n) => n === 0 || n % unit === 0 || named.has(n);
  const srcFiles = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) srcFiles.push(p);
    }
  })(join(dir, "src"));

  for (const f of srcFiles) {
    const s = readFileSync(f, "utf8");
    const short = f.slice(dir.length + 1);
    for (const hex of new Set(s.match(/#[0-9A-Fa-f]{6}/g) || [])) {
      if (!allowed.has(hex.toUpperCase())) fails.push(`${pack}/${short}: colour ${hex} outside the contract`);
    }
    for (const prop of ["borderRadius", "boxShadow", "textShadow"]) {
      if (s.includes(prop)) fails.push(`${pack}/${short}: ${prop} — ornament is not permitted`);
    }
    for (const m of s.match(/(?:padding|margin|gap)\w*:\s*"?[^,;\n]*/g) || []) {
      for (const px of m.match(/\b(\d+)px/g) || []) {
        const n = parseInt(px);
        if (!legal(n)) fails.push(`${pack}/${short}: spacing ${px} off the scale`);
      }
    }
  }
  console.log(`  ${pack.padEnd(12)} ${exported.size}/${arch.moves.length} moves, ${srcFiles.length} source files`);
}

console.log();
if (fails.length) { console.log(`FAIL (${fails.length}):`); fails.forEach((f) => console.log("  " + f)); }
else console.log("FAIL (0): every pack conforms to its own contract");
if (warns.length) { console.log(`\nREVIEW (${warns.length}):`); warns.forEach((w) => console.log("  " + w)); }
process.exit(fails.length ? 1 : 0);

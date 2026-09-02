// Are the vendored contracts still the ones upstream publishes?
//
// Each package vendors archetypes.json and tokens.json so the audit is
// self-contained. That is a good trade, and it carries exactly one obligation:
// something has to notice when the vendored copy goes stale. Without this, a
// stale copy makes the audit worse than useless — it returns a green tick
// meaning "conforms to a contract we no longer have".
//
//   node scripts/freshness.mjs
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = "https://raw.githubusercontent.com";

// Where each pack's contract is published. Instrument is in the public
// repository; the rest of the catalogue is private, so it is checked only when
// a token with access is present.
const UPSTREAM = {
  instrument: { repo: "appliedform/standards", path: "packs/instrument" },
  broadsheet: { repo: "appliedform/standards-packs", path: "packs/broadsheet", private: true },
  raw: { repo: "appliedform/standards-packs", path: "packs/raw", private: true },
  agitprop: { repo: "appliedform/standards-packs", path: "packs/agitprop", private: true },
  contra: { repo: "appliedform/standards-packs", path: "packs/contra", private: true },
  cornice: { repo: "appliedform/standards-packs", path: "packs/cornice", private: true },
};

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const fails = [], skipped = [];

async function upstream(entry, file) {
  const url = `${RAW}/${entry.repo}/main/${entry.path}/${file}`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const packs = readdirSync(join(root, "packages")).filter(
  (p) => p !== "core" && existsSync(join(root, "packages", p, "archetypes.json"))
);

for (const pack of packs) {
  const entry = UPSTREAM[pack];
  if (!entry) {
    fails.push(`${pack}: no upstream recorded in scripts/freshness.mjs`);
    continue;
  }
  if (entry.private && !token) {
    skipped.push(pack);
    console.log(`  ${pack.padEnd(12)} skipped (private upstream, no token)`);
    continue;
  }
  let clean = true;
  for (const file of ["archetypes.json", "tokens.json"]) {
    const local = join(root, "packages", pack, file);
    if (!existsSync(local)) continue;
    let remote;
    try {
      remote = await upstream(entry, file);
    } catch (e) {
      fails.push(`${pack}/${file}: could not fetch upstream (${e.message})`);
      clean = false;
      continue;
    }
    // Compare parsed JSON, so formatting differences are not reported as drift.
    if (JSON.stringify(JSON.parse(remote)) !== JSON.stringify(JSON.parse(readFileSync(local, "utf8")))) {
      fails.push(`${pack}/${file}: vendored copy differs from ${entry.repo}`);
      clean = false;
    }
  }
  if (clean) console.log(`  ${pack.padEnd(12)} current`);
}

if (skipped.length)
  console.log(`\n${skipped.length} pack(s) skipped. Set GITHUB_TOKEN to check private upstreams.`);

if (fails.length) {
  console.error("\n" + fails.map((f) => `  x ${f}`).join("\n"));
  console.error("\nRe-vendor the contract from upstream, then run: npm run generate");
  process.exit(1);
}
console.log("\nVendored contracts are current.");

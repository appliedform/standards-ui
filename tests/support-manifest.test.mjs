import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  assertPackageAlignment,
  loadSupportManifest,
  parseSupportManifest,
  supportForPlan,
  supportManifestSha256,
} from "../scripts/support-manifest.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

test("canonical support manifest binds six exact UI surfaces and package versions", async () => {
  const bytes = await readFile(path.join(ROOT, "support-manifest.json"));
  const manifest = assertPackageAlignment(loadSupportManifest());
  assert.equal(supportManifestSha256(), createHash("sha256").update(bytes).digest("hex"));
  assert.equal(manifest.schemaVersion, "0.2.0");
  assert.deepEqual(manifest.packages, {
    core: { name: "@standards/core", version: "0.2.0" },
    instrument: { name: "@standards/instrument", version: "2.0.0" },
  });
  assert.deepEqual(manifest.supported.map(({ job, move, contentKind, binding }) =>
    [job, move, contentKind, binding.component, binding.factPrefix]), [
    ["E", "Datum", "datum", "Datum", "datum"],
    ["S", "Matrix", "matrix", "Matrix", "matrix"],
    ["N", "Band statement", "bandStatement", "BandStatement", "bandStatement"],
    ["C", "Series", "series", "Series", "series"],
    ["T", "Schedule", "schedule", "Schedule", "schedule"],
    ["W", "Running index", "runningIndex", "RunningIndex", "runningIndex"],
  ]);
  for (const entry of manifest.supported) {
    assert.equal(supportForPlan({ job: entry.job, move: entry.move,
      content: { kind: entry.contentKind }, artifact: { format: "html" } }, manifest), entry);
  }
});

test("support manifest parsing fails closed on drift and undeclared surfaces", async () => {
  const source = await readFile(path.join(ROOT, "support-manifest.json"), "utf8");
  const extra = JSON.parse(source);
  extra.unknown = true;
  assert.throws(() => parseSupportManifest(JSON.stringify(extra)), /fields differ/);
  const missing = JSON.parse(source);
  missing.supported.pop();
  assert.throws(() => parseSupportManifest(JSON.stringify(missing)), /exactly six/);
  const version = JSON.parse(source);
  version.packages.instrument.version = "2.0.1";
  assert.throws(() => parseSupportManifest(JSON.stringify(version)), /package versions/);
  const relationship = JSON.parse(source);
  relationship.supported[0].requiredRelationships = ["datum.invented"];
  assert.throws(() => parseSupportManifest(JSON.stringify(relationship)), /six implemented UI surfaces/);
  const manifest = parseSupportManifest(source);
  assert.throws(() => supportForPlan({ job: "E", move: "Schedule",
    content: { kind: "schedule" }, artifact: { format: "html" } }, manifest), /outside/);
});

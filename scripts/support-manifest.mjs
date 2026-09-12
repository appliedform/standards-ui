import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SUPPORT_MANIFEST_PATH = join(root, "support-manifest.json");
const EXPECTED_SUPPORTED = [
  ["E", "Evidence", "Datum", "datum", "Datum", "datum", ["datum.label-value"]],
  ["S", "Structure", "Matrix", "matrix", "Matrix", "matrix",
    ["matrix.column-headers", "matrix.row-headers", "matrix.grid"]],
  ["N", "Narrative", "Band statement", "bandStatement", "BandStatement", "bandStatement",
    ["bandStatement.statement"]],
  ["C", "Change", "Series", "series", "Series", "series",
    ["series.period-order", "series.value-association"]],
  ["T", "Transaction", "Schedule", "schedule", "Schedule", "schedule",
    ["schedule.named-table", "schedule.column-headers", "schedule.row-headers", "schedule.numeric-order", "schedule.footer"]],
  ["W", "Wayfinding", "Running index", "runningIndex", "RunningIndex", "runningIndex",
    ["runningIndex.section-order", "runningIndex.current-section"]],
];

function exactKeys(value, required, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...required].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name} fields differ: expected ${expected.join(", ")}; received ${actual.join(", ")}`);
  }
}

function text(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be nonblank text`);
  return value;
}

function stringList(value, name, minimum = 1, maximum = 30) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum
      || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${name} must contain ${minimum} to ${maximum} nonblank strings`);
  }
}

export function parseSupportManifest(source) {
  const manifest = JSON.parse(source);
  exactKeys(manifest, ["schemaVersion", "workflow", "mcp", "system", "packages", "renderer",
    "supported", "testedClients", "clientTestingStatus", "runtimeRequirements", "unsupportedSurfaces"], "support manifest");
  if (manifest.schemaVersion !== "0.2.0") throw new Error("unsupported support manifest schemaVersion");

  exactKeys(manifest.workflow, ["version", "formats", "maxRepairTurns"], "workflow support");
  if (manifest.workflow.version !== manifest.schemaVersion
      || JSON.stringify(manifest.workflow.formats) !== JSON.stringify(["html"])
      || manifest.workflow.maxRepairTurns !== 2) throw new Error("workflow support is incompatible");

  exactKeys(manifest.mcp, ["version", "protocolVersion"], "MCP support");
  if (manifest.mcp.version !== manifest.workflow.version || manifest.mcp.protocolVersion !== "2025-06-18") {
    throw new Error("MCP support is incompatible");
  }

  exactKeys(manifest.system, ["slug", "contentVersion", "contentSchemaVersion"], "system support");
  if (manifest.system.slug !== "instrument" || manifest.system.contentVersion !== "1.0.0"
      || manifest.system.contentSchemaVersion !== "v0.4") throw new Error("system support is incompatible");

  exactKeys(manifest.packages, ["core", "instrument"], "package support");
  for (const key of ["core", "instrument"]) exactKeys(manifest.packages[key], ["name", "version"], `${key} package support`);
  if (manifest.packages.core.name !== "@standards/core" || manifest.packages.instrument.name !== "@standards/instrument") {
    throw new Error("support manifest has unexpected package names");
  }
  if (manifest.packages.core.version !== "0.2.0" || manifest.packages.instrument.version !== "2.0.0") {
    throw new Error("support manifest has incompatible package versions");
  }

  exactKeys(manifest.renderer, ["name", "version", "evidenceVersion"], "renderer support");
  if (manifest.renderer.name !== "standards-ui-workflow-render"
      || manifest.renderer.version !== manifest.workflow.version
      || manifest.renderer.evidenceVersion !== manifest.workflow.version) {
    throw new Error("renderer support is incompatible");
  }

  if (!Array.isArray(manifest.supported) || manifest.supported.length !== 6) {
    throw new Error("support manifest must declare exactly six supported surfaces");
  }
  const seen = { jobs: new Set(), moves: new Set(), kinds: new Set(), components: new Set(), prefixes: new Set() };
  for (const [index, entry] of manifest.supported.entries()) {
    exactKeys(entry, ["job", "jobName", "move", "format", "contentKind", "binding", "requiredRelationships"], `supported[${index}]`);
    exactKeys(entry.binding, ["package", "packageVersion", "component", "factPrefix"], `supported[${index}].binding`);
    for (const [label, value] of [["job", entry.job], ["jobName", entry.jobName], ["move", entry.move],
      ["contentKind", entry.contentKind], ["component", entry.binding.component], ["factPrefix", entry.binding.factPrefix]]) {
      text(value, `supported[${index}].${label}`);
    }
    if (entry.format !== "html" || entry.binding.package !== manifest.packages.instrument.name
        || entry.binding.packageVersion !== manifest.packages.instrument.version
        || entry.binding.factPrefix !== entry.contentKind) throw new Error(`supported[${index}] has an incompatible binding`);
    stringList(entry.requiredRelationships, `supported[${index}].requiredRelationships`, 1, 10);
    for (const relationship of entry.requiredRelationships) {
      if (!/^[a-zA-Z0-9.-]+$/.test(relationship)) throw new Error(`supported[${index}] has an invalid relationship id`);
    }
    for (const [key, value] of [["jobs", entry.job], ["moves", entry.move], ["kinds", entry.contentKind],
      ["components", entry.binding.component], ["prefixes", entry.binding.factPrefix]]) {
      if (seen[key].has(value)) throw new Error(`support manifest repeats ${key.slice(0, -1)} ${value}`);
      seen[key].add(value);
    }
  }
  if (seen.jobs.size !== 6) throw new Error("support manifest must cover six distinct jobs");
  const supportedShape = manifest.supported.map((entry) => [entry.job, entry.jobName, entry.move,
    entry.contentKind, entry.binding.component, entry.binding.factPrefix, entry.requiredRelationships]);
  if (JSON.stringify(supportedShape) !== JSON.stringify(EXPECTED_SUPPORTED)) {
    throw new Error("support manifest differs from the six implemented UI surfaces");
  }

  if (!Array.isArray(manifest.testedClients) || manifest.testedClients.length > 20) {
    throw new Error("testedClients must be a bounded array");
  }
  for (const [index, client] of manifest.testedClients.entries()) {
    exactKeys(client, ["name", "version", "transport", "receipt"], `testedClients[${index}]`);
    text(client.name, "client name"); text(client.version, "client version"); text(client.receipt, "client receipt");
    if (client.transport !== "stdio") throw new Error("only tested stdio clients are supported");
  }
  text(manifest.clientTestingStatus, "clientTestingStatus");
  exactKeys(manifest.runtimeRequirements, ["python", "node", "browser", "network"], "runtime requirements");
  for (const [key, value] of Object.entries(manifest.runtimeRequirements)) text(value, `runtimeRequirements.${key}`);
  stringList(manifest.unsupportedSurfaces, "unsupportedSurfaces");
  return manifest;
}

export function loadSupportManifest() {
  return parseSupportManifest(readFileSync(SUPPORT_MANIFEST_PATH, "utf8"));
}

export function supportManifestSha256() {
  return createHash("sha256").update(readFileSync(SUPPORT_MANIFEST_PATH)).digest("hex");
}

export function assertPackageAlignment(manifest = loadSupportManifest()) {
  for (const key of ["core", "instrument"]) {
    const local = JSON.parse(readFileSync(join(root, "packages", key, "package.json"), "utf8"));
    const expected = manifest.packages[key];
    if (local.name !== expected.name || local.version !== expected.version) {
      throw new Error(`${key} package ${local.name}@${local.version} differs from support manifest ${expected.name}@${expected.version}`);
    }
  }
  return manifest;
}

export function supportForPlan(plan, manifest = loadSupportManifest()) {
  const match = manifest.supported.find((entry) => entry.job === plan?.job && entry.move === plan?.move
    && entry.contentKind === plan?.content?.kind && entry.format === plan?.artifact?.format);
  if (!match) throw new Error("plan is outside the canonical support manifest");
  return match;
}

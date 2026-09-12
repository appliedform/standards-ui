#!/usr/bin/env node
/** Render and inspect the first supported agent workflow without executing artifact code. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir, readdir, readlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import {
  BandStatement,
  Datum,
  InstrumentRoot,
  Matrix,
  RunningIndex,
  Schedule,
  Series,
} from "../packages/instrument/dist/index.js";
import {
  assertPackageAlignment,
  loadSupportManifest,
  supportForPlan,
  supportManifestSha256,
} from "./support-manifest.mjs";

const SUPPORT_MANIFEST = assertPackageAlignment(loadSupportManifest());
const SUPPORT_MANIFEST_SHA256 = supportManifestSha256();
const VERSION = SUPPORT_MANIFEST.renderer.version;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = fileURLToPath(import.meta.url);
const FONT_ASSET_PATHS = [
  "packages/instrument/dist/fonts/PublicSans-400.woff2",
  "packages/instrument/dist/fonts/PublicSans-600.woff2",
  "packages/instrument/dist/fonts/PublicSans-800.woff2",
  "packages/instrument/dist/fonts/DMMono-400.woff2",
  "packages/instrument/dist/fonts/DMMono-500.woff2",
  "packages/instrument/dist/fonts/OFL-Public-Sans.txt",
  "packages/instrument/dist/fonts/OFL-DM-Mono.txt",
];
const RUNTIME_PATHS = ["packages/core/dist", "node_modules/react", "node_modules/react-dom",
  "node_modules/scheduler", "node_modules/playwright", "node_modules/playwright-core"];
const COMPONENTS = { BandStatement, Datum, Matrix, RunningIndex, Schedule, Series };

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--identity") return { identity: true };
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!new Set(["--plan", "--out", "--html"]).has(key) || !value) {
      throw new Error("usage: node scripts/workflow-render.mjs --plan PLAN.json --out DIRECTORY [--html ARTIFACT.html]");
    }
    result[key.slice(2)] = value;
  }
  if (!result.plan || !result.out) throw new Error("--plan and --out are required");
  return result;
}

function nonblank(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be nonblank text`);
  return value;
}

function exactKeys(value, required, optional, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  const allowed = new Set([...required, ...optional]);
  for (const key of required) if (!(key in value)) throw new Error(`${name} is missing ${key}`);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${name} has unsupported field ${key}`);
}

function hashMap(value, name, minimum = 1, maximum = 32) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  const entries = Object.entries(value);
  if (entries.length < minimum || entries.length > maximum
      || entries.some(([key, digest]) => !/^(?![./])(?:[a-zA-Z0-9@._+-]+\/)*[a-zA-Z0-9@._+-]+$/.test(key)
        || key.split("/").includes("..")
        || typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest))) {
    throw new Error(`${name} must contain bounded relative paths and SHA-256 values`);
  }
}

function expectedFacts(plan) {
  exactKeys(plan, ["schemaVersion", "system", "job", "move", "content", "artifact", "context", "selection",
    "binding", "renderer", "facts", "requiredRelationships", "rules", "maxRepairTurns", "source", "limitations"], [], "plan");
  const manifest = assertPackageAlignment(SUPPORT_MANIFEST);
  if (plan?.schemaVersion !== VERSION || plan?.system !== manifest.system.slug) {
    throw new Error(`renderer supports ${manifest.system.slug} workflow ${VERSION} plans only`);
  }
  const support = supportForPlan(plan, manifest);

  exactKeys(plan.content, ["kind", "data"], [], "content");
  exactKeys(plan.artifact, ["format", "title", "viewports"], [], "artifact");
  if (plan.artifact.format !== "html" || !Array.isArray(plan.artifact.viewports)
      || plan.artifact.viewports.length < 1 || plan.artifact.viewports.length > 3) {
    throw new Error("plan must declare one to three HTML viewports");
  }
  nonblank(plan.artifact.title, "title");
  const sizes = new Set();
  for (const viewport of plan.artifact.viewports) {
    exactKeys(viewport, ["width", "height"], [], "viewport");
    if (!Number.isInteger(viewport.width) || !Number.isInteger(viewport.height)
        || viewport.width < 320 || viewport.width > 1920 || viewport.height < 320 || viewport.height > 2160) {
      throw new Error("viewport is outside the supported bounds");
    }
    const key = `${viewport.width}x${viewport.height}`;
    if (sizes.has(key)) throw new Error("viewports must be unique");
    sizes.add(key);
  }
  exactKeys(plan.context, ["build", "reason"], [], "context");
  if (!["full", "compact"].includes(plan.context.build)) throw new Error("unsupported instruction build");
  nonblank(plan.context.reason, "context reason");
  exactKeys(plan.selection, ["reason", "trigger", "alternatives"], [], "selection");
  if (!Array.isArray(plan.selection.alternatives) || plan.selection.alternatives.length !== 0) {
    throw new Error("plan must have no unresolved move alternatives");
  }
  nonblank(plan.selection.reason, "selection reason");
  nonblank(plan.selection.trigger, "selection trigger");

  exactKeys(plan.binding, ["package", "packageVersion", "component", "props"], [], "binding");
  if (plan.binding.package !== support.binding.package
      || plan.binding.packageVersion !== support.binding.packageVersion
      || plan.binding.component !== support.binding.component) throw new Error("unsupported implementation binding");
  const props = plan.binding.props;
  if (!props || typeof props !== "object" || Array.isArray(props)
      || props.factPrefix !== support.binding.factPrefix) throw new Error("binding has an invalid fact prefix");

  const expected = new Map([["title", nonblank(plan.artifact.title, "title")]]);
  const add = (id, value, name = id) => expected.set(id, nonblank(value, name));
  const list = (value, name, minimum, maximum) => {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
      throw new Error(`${name} must contain ${minimum} to ${maximum} items`);
    }
    return value;
  };
  const optionalList = (value, name, maximum) => value === undefined ? [] : list(value, name, 1, maximum);
  const finite = (value, name) => {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
    return value;
  };
  const uniqueText = (values, name) => {
    const normalized = values.map((value) => nonblank(value, name).normalize("NFC").replace(/\s+/g, " "));
    if (new Set(normalized).size !== normalized.length) throw new Error(`${name} must be unique after text normalization`);
  };

  if (support.contentKind === "datum") {
    exactKeys(props, ["label", "value", "factPrefix"], ["unit", "supporting", "note"], "Datum props");
    add("datum.label", props.label); add("datum.value", props.value);
    if (props.unit !== undefined) add("datum.unit", props.unit);
    const supporting = optionalList(props.supporting, "Datum supporting figures", 4);
    uniqueText(supporting.map((item) => item.term), "Datum supporting terms");
    supporting.forEach((item, index) => {
      exactKeys(item, ["term", "value"], [], `Datum supporting ${index}`);
      add(`datum.supporting.${index}.term`, item.term); add(`datum.supporting.${index}.value`, item.value);
    });
    if (props.note !== undefined) add("datum.note", props.note);
  } else if (support.contentKind === "matrix") {
    exactKeys(props, ["label", "columns", "rows", "factPrefix"], ["emphasis", "note"], "Matrix props");
    add("matrix.label", props.label);
    const columns = list(props.columns, "Matrix columns", 2, 8);
    const rows = list(props.rows, "Matrix rows", 1, 24);
    uniqueText(columns, "Matrix column labels");
    columns.forEach((value, index) => add(`matrix.columns.${index}`, value));
    rows.forEach((row, rowIndex) => {
      exactKeys(row, ["label", "values"], [], `Matrix row ${rowIndex}`);
      add(`matrix.rows.${rowIndex}.label`, row.label);
      const values = list(row.values, `Matrix row ${rowIndex} values`, 2, 8);
      if (values.length !== props.columns.length) throw new Error(`Matrix row ${rowIndex} does not match the column count`);
      values.forEach((value, columnIndex) => add(`matrix.rows.${rowIndex}.values.${columnIndex}`, value));
    });
    uniqueText(rows.map((row) => row.label), "Matrix row labels");
    if (props.emphasis !== undefined) {
      if (!Array.isArray(props.emphasis) || props.emphasis.length !== 2
          || !props.emphasis.every(Number.isInteger)
          || props.emphasis[0] < 0 || props.emphasis[0] >= props.rows.length
          || props.emphasis[1] < 0 || props.emphasis[1] >= props.columns.length) {
        throw new Error("Matrix emphasis must identify an existing cell");
      }
    }
    if (props.note !== undefined) add("matrix.note", props.note);
  } else if (support.contentKind === "bandStatement") {
    exactKeys(props, ["statement", "factPrefix"], ["label", "figures", "note", "bleed"], "BandStatement props");
    if (props.label !== undefined) add("bandStatement.label", props.label);
    add("bandStatement.statement", props.statement);
    const figures = optionalList(props.figures, "BandStatement figures", 4);
    uniqueText(figures.map((item) => item.term), "BandStatement figure terms");
    figures.forEach((item, index) => {
      exactKeys(item, ["term", "value"], [], `BandStatement figure ${index}`);
      add(`bandStatement.figures.${index}.term`, item.term); add(`bandStatement.figures.${index}.value`, item.value);
    });
    if (props.note !== undefined) add("bandStatement.note", props.note);
    if (props.bleed !== undefined && (!Number.isInteger(props.bleed) || props.bleed < 0 || props.bleed > 96)) {
      throw new Error("BandStatement bleed must be an integer from 0 to 96");
    }
  } else if (support.contentKind === "series") {
    exactKeys(props, ["label", "periods", "factPrefix"], ["emphasiseLast", "summary", "height", "note"], "Series props");
    add("series.label", props.label);
    const periods = list(props.periods, "Series periods", 2, 24);
    add("series.zero", "0");
    periods.forEach((period, index) => {
      exactKeys(period, ["period", "value", "display"], [], `Series period ${index}`);
      add(`series.periods.${index}.period`, period.period);
      finite(period.value, `Series period ${index} value`);
      add(`series.periods.${index}.display`, period.display);
    });
    uniqueText(periods.map((period) => period.period), "Series periods");
    if (props.emphasiseLast !== undefined && typeof props.emphasiseLast !== "boolean") throw new Error("Series emphasiseLast must be boolean");
    const summary = optionalList(props.summary, "Series summary", 4);
    uniqueText(summary.map((item) => item.term), "Series summary terms");
    summary.forEach((item, index) => {
      exactKeys(item, ["term", "value"], [], `Series summary ${index}`);
      add(`series.summary.${index}.term`, item.term); add(`series.summary.${index}.value`, item.value);
    });
    if (props.height !== undefined && (!Number.isInteger(props.height) || props.height < 96 || props.height > 4096)) {
      throw new Error("Series height must be an integer from 96 to 4096");
    }
    if (props.note !== undefined) add("series.note", props.note);
    if (props.emphasiseLast !== false) add("series.current", "Current");
  } else if (support.contentKind === "schedule") {
    exactKeys(props, ["label", "lines", "factPrefix"], ["columns", "total", "note"], "Schedule props");
    add("schedule.label", props.label);
    const columns = { ref: "REF", description: "DESCRIPTION", duration: "DURATION", amount: "AMOUNT", ...(props.columns ?? {}) };
    exactKeys(columns, ["ref", "description", "duration", "amount"], [], "Schedule columns");
    for (const name of ["ref", "description", "duration", "amount"]) add(`schedule.columns.${name}`, columns[name]);
    const references = new Set();
    list(props.lines, "Schedule lines", 1, 24).forEach((line, index) => {
      exactKeys(line, ["ref", "description", "duration", "amount"], ["standard"], `Schedule line ${index}`);
      const ref = nonblank(line.ref, `Schedule line ${index} ref`).normalize("NFC").replace(/\s+/g, " ");
      if (references.has(ref)) throw new Error("Schedule line references must be unique");
      references.add(ref);
      for (const name of ["ref", "description", "standard", "duration", "amount"]) {
        if (line[name] !== undefined) add(`schedule.lines.${index}.${name}`, line[name]);
      }
    });
    if (props.total !== undefined) {
      exactKeys(props.total, ["label", "duration", "amount"], [], "Schedule total");
      for (const name of ["label", "duration", "amount"]) add(`schedule.total.${name}`, props.total[name]);
    }
    if (props.note !== undefined) add("schedule.note", props.note);
  } else if (support.contentKind === "runningIndex") {
    exactKeys(props, ["document", "folio", "sections", "factPrefix"], ["current", "note"], "RunningIndex props");
    add("runningIndex.document", props.document); add("runningIndex.folio", props.folio);
    const sections = list(props.sections, "RunningIndex sections", 1, 24);
    uniqueText(sections, "RunningIndex sections");
    sections.forEach((value, index) => {
      add(`runningIndex.numbers.${index}`, String(index + 1));
      add(`runningIndex.sections.${index}`, value);
    });
    if (props.current !== undefined && (!Number.isInteger(props.current) || props.current < 1 || props.current > props.sections.length)) {
      throw new Error("RunningIndex current must identify an existing section");
    }
    if (props.note !== undefined) add("runningIndex.note", props.note);
  } else {
    throw new Error("support manifest has no renderer validator for the content kind");
  }

  const supplied = new Map();
  if (!Array.isArray(plan.facts) || plan.facts.length < 1 || plan.facts.length > 300) throw new Error("facts must be a bounded array");
  for (const fact of plan.facts) {
    exactKeys(fact, ["id", "text"], [], "fact");
    const id = nonblank(fact.id, "fact id");
    if (!/^[a-zA-Z0-9.]+$/.test(id) || supplied.has(id)) throw new Error("plan has an invalid or duplicate fact id");
    supplied.set(id, nonblank(fact.text, "fact text"));
  }
  if (canonical(plan.facts) !== canonical([...expected].map(([id, text]) => ({ id, text })))) {
    throw new Error(`plan facts differ from the bound ${support.binding.component} props`);
  }
  if (canonical(plan.content.data) !== canonical(Object.fromEntries(Object.entries(props).filter(([key]) => key !== "factPrefix")))) {
    throw new Error("plan content differs from its bound component props");
  }
  if (canonical(plan.requiredRelationships) !== canonical(support.requiredRelationships)) {
    throw new Error("plan relationship inventory differs from the support manifest");
  }
  if (plan.maxRepairTurns !== manifest.workflow.maxRepairTurns || !Array.isArray(plan.rules)
      || plan.rules.length < 1 || plan.rules.length > 32 || plan.rules.some((rule) => typeof rule !== "string" || !rule.trim())
      || !Array.isArray(plan.limitations) || plan.limitations.length < 1 || plan.limitations.length > 20
      || plan.limitations.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("plan rule, limitation or repair bounds are invalid");
  }
  exactKeys(plan.source, ["systemVersion", "schemaVersion", "supportManifestSha256", "files", "implementation"], [], "source");
  if (plan.source.systemVersion !== manifest.system.contentVersion
      || plan.source.schemaVersion !== manifest.system.contentSchemaVersion
      || plan.source.supportManifestSha256 !== SUPPORT_MANIFEST_SHA256) throw new Error("plan source identity differs from support manifest");
  hashMap(plan.source.files, "source files", 1, 32);
  hashMap(plan.source.implementation, "source implementation", 1, 40);

  exactKeys(plan.renderer, ["name", "version", "supportManifestSha256", "sourceSha256", "packageVersion",
    "packageEntrySha256", "tokensSha256", "fontAssetsSha256", "runtimeModulesSha256", "lockfileSha256",
    "browserLauncherSha256", "browserPayloadSha256", "nodeExecutableSha256", "browserRevision", "browser",
    "platform", "nodeVersion"], [], "renderer");
  if (plan.renderer.name !== manifest.renderer.name || plan.renderer.version !== manifest.renderer.version
      || plan.renderer.supportManifestSha256 !== SUPPORT_MANIFEST_SHA256
      || plan.renderer.packageVersion !== support.binding.packageVersion
      || ["sourceSha256", "packageEntrySha256", "tokensSha256", "fontAssetsSha256", "runtimeModulesSha256",
        "lockfileSha256", "browserLauncherSha256", "browserPayloadSha256", "nodeExecutableSha256"]
        .some((key) => !/^[0-9a-f]{64}$/.test(plan.renderer[key]))) {
    throw new Error("renderer identity is invalid or incompatible with this host");
  }
  for (const key of ["browserRevision", "browser", "platform", "nodeVersion"]) nonblank(plan.renderer[key], `renderer ${key}`);
  if (!/^v(?:22|24)\.[0-9]+\.[0-9]+/.test(plan.renderer.nodeVersion)) throw new Error("renderer requires Node 22 or 24 LTS");
  return expected;
}
async function readBounded(path, maximum, name) {
  const bytes = await readFile(path);
  if (bytes.length > maximum) throw new Error(`${name} exceeds ${maximum} bytes`);
  return bytes;
}

async function hashFile(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

function browserPayloadRoot(executable) {
  let current = resolve(executable);
  while (dirname(current) !== current) {
    if (current.endsWith(".app")) return current;
    current = dirname(current);
  }
  return dirname(resolve(executable));
}

async function hashTree(directory) {
  const digest = createHash("sha256");
  let entriesHashed = 0;
  const visit = async (absolute, relative) => {
    const entries = await readdir(absolute, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const childAbsolute = join(absolute, entry.name);
      if (entry.isDirectory()) {
        digest.update(`directory\0${childRelative}\0`, "utf8");
        entriesHashed += 1;
        await visit(childAbsolute, childRelative);
      } else if (entry.isFile()) {
        digest.update(`file\0${childRelative}\0`, "utf8");
        for await (const chunk of createReadStream(childAbsolute)) digest.update(chunk);
        digest.update(Buffer.from([0]));
        entriesHashed += 1;
      } else if (entry.isSymbolicLink()) {
        digest.update(`symlink\0${childRelative}\0${await readlink(childAbsolute)}\0`, "utf8");
        entriesHashed += 1;
      } else {
        throw new Error(`unsupported browser payload entry: ${childRelative}`);
      }
    }
  };
  await visit(directory, "");
  if (entriesHashed === 0) throw new Error("browser payload is empty");
  return digest.digest("hex");
}

async function rendererIdentity(browserVersion = null) {
  if (!/^v(?:22|24)\.[0-9]+\.[0-9]+/.test(process.version)) {
    throw new Error(`renderer requires Node 22 or 24 LTS; received ${process.version}`);
  }
  let launched = null;
  if (browserVersion === null) {
    launched = await chromium.launch({ headless: true, chromiumSandbox: true });
    browserVersion = launched.version();
  }
  try {
    const packageMetadata = JSON.parse(await readFile(join(root, "packages/instrument/package.json"), "utf8"));
    const fontDigest = createHash("sha256");
    for (const path of FONT_ASSET_PATHS) {
      fontDigest.update(path, "utf8");
      fontDigest.update(Buffer.from([0]));
      fontDigest.update(await readFile(join(root, path)));
      fontDigest.update(Buffer.from([0]));
    }
    const runtimeDigest = createHash("sha256");
    const visit = async (relative) => {
      const entries = await readdir(join(root, relative), { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const child = `${relative}/${entry.name}`;
        if (entry.isDirectory()) await visit(child);
        else if (entry.isFile()) {
          runtimeDigest.update(child, "utf8");
          runtimeDigest.update(Buffer.from([0]));
          runtimeDigest.update(await readFile(join(root, child)));
          runtimeDigest.update(Buffer.from([0]));
        } else {
          throw new Error(`unsupported runtime dependency entry: ${child}`);
        }
      }
    };
    for (const relative of RUNTIME_PATHS) await visit(relative);
    const browsers = JSON.parse(await readFile(join(root, "node_modules/playwright-core/browsers.json"), "utf8"));
    const browserRevision = browsers.browsers?.find((item) => item.name === "chromium")?.revision;
    nonblank(browserRevision, "Playwright Chromium revision");
    const browserExecutable = chromium.executablePath();
    return { name: SUPPORT_MANIFEST.renderer.name, version: VERSION,
      supportManifestSha256: SUPPORT_MANIFEST_SHA256,
      sourceSha256: sha256(await readFile(scriptPath)), packageVersion: packageMetadata.version,
      packageEntrySha256: sha256(await readFile(join(root, "packages/instrument/dist/index.js"))),
      tokensSha256: sha256(await readFile(join(root, "packages/instrument/dist/styles/tokens.css"))),
      fontAssetsSha256: fontDigest.digest("hex"), runtimeModulesSha256: runtimeDigest.digest("hex"),
      lockfileSha256: sha256(await readFile(join(root, "package-lock.json"))),
      browserLauncherSha256: await hashFile(browserExecutable),
      browserPayloadSha256: await hashTree(browserPayloadRoot(browserExecutable)),
      nodeExecutableSha256: await hashFile(process.execPath), browserRevision, browser: browserVersion,
      platform: `${process.platform}-${process.arch}`, nodeVersion: process.version };
  } finally {
    if (launched) await launched.close();
  }
}

async function embeddedFonts() {
  const fonts = [
    ["Public Sans", 400, "packages/instrument/dist/fonts/PublicSans-400.woff2"],
    ["Public Sans", 600, "packages/instrument/dist/fonts/PublicSans-600.woff2"],
    ["Public Sans", 800, "packages/instrument/dist/fonts/PublicSans-800.woff2"],
    ["DM Mono", 400, "packages/instrument/dist/fonts/DMMono-400.woff2"],
    ["DM Mono", 500, "packages/instrument/dist/fonts/DMMono-500.woff2"],
  ];
  const css = (await Promise.all(fonts.map(async ([family, weight, path]) => {
    const bytes = await readFile(join(root, path));
    if (bytes.subarray(0, 4).toString() !== "wOF2") throw new Error(`invalid bundled WOFF2 font: ${path}`);
    return `@font-face{font-family:${JSON.stringify(family)};font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2")}`;
  }))).join("\n");
  const licenses = await Promise.all([
    ["public-sans", "packages/instrument/dist/fonts/OFL-Public-Sans.txt"],
    ["dm-mono", "packages/instrument/dist/fonts/OFL-DM-Mono.txt"],
  ].map(async ([family, path]) => ({ family,
    base64: (await readFile(join(root, path))).toString("base64") })));
  return { css, licenses };
}

async function renderPlan(plan) {
  expectedFacts(plan);
  const support = supportForPlan(plan, SUPPORT_MANIFEST);
  const Component = COMPONENTS[support.binding.component];
  if (!Component) throw new Error("support manifest names an unavailable renderer component");
  const tokens = await readFile(join(root, "packages/instrument/dist/styles/tokens.css"), "utf8");
  const fonts = await embeddedFonts();
  const props = plan.binding.props;
  const body = renderToStaticMarkup(
    React.createElement(InstrumentRoot, null,
      React.createElement("header", { className: "instrument-band" },
        React.createElement("h1", { className: "instrument-band-title", "data-std-fact": "title" },
          plan.artifact.title)),
      React.createElement("main", { className: "instrument-shell" },
        React.createElement(Component, props))))
  ;
  const licenseMetadata = fonts.licenses.map(({ family, base64 }) =>
    `<meta name="standards-font-license:${family}" data-encoding="base64" content="${base64}">`).join("\n");
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${licenseMetadata}
<title>${escapeHtml(plan.artifact.title)}</title><style>${fonts.css}\n${tokens}
*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-width:320px;background:#fff}
body{min-height:100vh}[data-standards-pack="instrument"]{min-height:100vh}.instrument-band{display:flex;align-items:center;width:100%;height:32px;padding:0 16px;background:var(--ink)}
.instrument-band-title{min-width:0;margin:0;color:#fff;font-size:13px;font-weight:600;line-height:1.1;overflow-wrap:normal;word-break:normal}.instrument-shell{width:100%;max-width:1120px;margin:0 auto;padding:48px 32px 64px}
@media(max-width:639px){.instrument-shell{padding:32px 16px 48px}}
</style></head><body>${body}</body></html>`;
  return page;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function inspectArtifact(plan, html, outDir) {
  expectedFacts(plan);
  if (typeof html !== "string" || Buffer.byteLength(html, "utf8") > 2_000_000) {
    throw new Error("artifact must be a UTF-8 string of at most 2000000 bytes");
  }
  const planSha256 = sha256(Buffer.from(canonical(plan), "utf8"));
  const artifactSha256 = sha256(Buffer.from(html, "utf8"));
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  try {
    const identity = await rendererIdentity(browser.version());
    if (canonical(identity) !== canonical(plan.renderer)) {
      throw new Error("installed renderer identity differs from the plan; regenerate the brief identity and plan");
    }
    const evidence = { schemaVersion: VERSION, planSha256, artifactSha256,
      renderer: identity, viewports: [] };
    for (const viewport of plan.artifact.viewports) {
      const context = await browser.newContext({ viewport, javaScriptEnabled: false, serviceWorkers: "block" });
      const pageErrors = [];
      const blockedRequests = [];
      let pageErrorOverflow = false;
      let blockedRequestOverflow = false;
      const recordPageError = (message) => {
        if (pageErrors.length < 100) pageErrors.push(String(message).slice(0, 2000));
        else pageErrorOverflow = true;
      };
      const page = await context.newPage();
      page.on("pageerror", recordPageError);
      page.on("console", (message) => { if (message.type() === "error") recordPageError(message.text()); });
      await page.route("**/*", async (route) => {
        if (blockedRequests.length < 100) blockedRequests.push(route.request().url().slice(0, 2000));
        else blockedRequestOverflow = true;
        await route.abort("blockedbyclient");
      });
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      if (pageErrorOverflow || blockedRequestOverflow) {
        throw new Error("artifact exceeds the 100 browser-error or blocked-request inspection limit");
      }
      const inspection = { move: plan.move, contentKind: plan.content.kind,
        props: plan.binding.props, requiredRelationships: plan.requiredRelationships };
      const observed = await page.evaluate((input) => {
        const nodeCount = document.querySelectorAll("*").length;
        const markerCount = document.querySelectorAll("[data-std-fact]").length;
        if (nodeCount > 20_000) throw new Error("artifact exceeds the 20000 element inspection limit");
        if (markerCount > 300) throw new Error("artifact exceeds the 300 fact-marker inspection limit");
        const bodyTextLength = [...document.body.innerText.trim()].length;
        if (bodyTextLength > 1_000_000) throw new Error("artifact exceeds the 1000000 character rendered-text limit");
        const hitTestStyle = document.createElement("style");
        hitTestStyle.textContent = "*,*::before,*::after{pointer-events:auto!important;animation:none!important;transition:none!important}";
        document.head.append(hitTestStyle);
        const roundedBounds = (rect) => Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, Math.round(rect[key] * 1000) / 1000]));
        const transparent = (value) => value === "transparent" || /^rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(value);
        const rgba = (value) => {
          if (value === "transparent") return [0, 0, 0, 0];
          const match = value.match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
          return match ? [Number(match[1]), Number(match[2]), Number(match[3]),
            match[4] === undefined ? 1 : Number(match[4])] : null;
        };
        const composite = (front, back) => {
          const alpha = front[3] + back[3] * (1 - front[3]);
          if (alpha === 0) return [0, 0, 0, 0];
          return [0, 1, 2].map((index) => (front[index] * front[3]
            + back[index] * back[3] * (1 - front[3])) / alpha).concat(alpha);
        };
        const luminance = (color) => {
          const values = color.slice(0, 3).map((value) => {
            const channel = value / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
        };
        const contrastRatio = (element) => {
          const ancestors = [];
          for (let parent = element; parent; parent = parent.parentElement) ancestors.push(parent);
          let background = [255, 255, 255, 1];
          for (const parent of ancestors.reverse()) {
            const parsed = rgba(getComputedStyle(parent).backgroundColor);
            if (!parsed) return 0;
            background = composite(parsed, background);
          }
          const style = getComputedStyle(element);
          // Chromium resolves the default WebKit fill to currentColor. When a
          // page overrides it, this is the colour that actually paints glyphs.
          const text = rgba(style.webkitTextFillColor) ?? rgba(style.color);
          if (!text) return 0;
          const effectiveText = composite(text, background);
          const light = Math.max(luminance(effectiveText), luminance(background));
          const dark = Math.min(luminance(effectiveText), luminance(background));
          return (light + 0.05) / (dark + 0.05);
        };
        const shown = (element) => {
          const style = getComputedStyle(element);
          const strokeWidth = Number.parseFloat(style.webkitTextStrokeWidth);
          const unsupportedTextPaint = style.textShadow !== "none"
            || (Number.isFinite(strokeWidth) && strokeWidth > 0)
            || (style.webkitTextSecurity && style.webkitTextSecurity !== "none");
          const range = document.createRange();
          range.selectNodeContents(element);
          const rect = range.getBoundingClientRect();
          for (let parent = element; parent; parent = parent.parentElement) {
            if (parent.hidden || parent.getAttribute("aria-hidden") === "true") return false;
            const parentStyle = getComputedStyle(parent);
            if (parentStyle.display === "none" || parentStyle.visibility === "hidden"
                || parentStyle.visibility === "collapse" || Number(parentStyle.opacity) <= 0
                || parentStyle.filter !== "none" || parentStyle.backdropFilter !== "none"
                || parentStyle.maskImage !== "none" || parentStyle.mixBlendMode !== "normal") return false;
          }
          return style.display !== "none"
            && style.visibility !== "hidden" && style.visibility !== "collapse" && Number(style.opacity) > 0
            && !unsupportedTextPaint
            && parseFloat(style.fontSize) > 0 && style.clipPath === "none" && !transparent(style.color)
            && !transparent(style.webkitTextFillColor)
            && contrastRatio(element) >= 4.5
            && rect.width > 0 && rect.height > 0
            && rect.right > 0 && rect.left < document.documentElement.clientWidth
            && rect.bottom > 0 && rect.top < document.documentElement.scrollHeight;
        };
        const clipped = (element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const rect = range.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return true;
          if (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1
              || rect.top < -1 || rect.bottom > document.documentElement.scrollHeight + 1) return true;
          for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            const clipX = ["hidden", "clip", "scroll", "auto"].includes(style.overflowX);
            const clipY = ["hidden", "clip", "scroll", "auto"].includes(style.overflowY);
            const bounds = parent.getBoundingClientRect();
            if (clipX && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) return true;
            if (clipY && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) return true;
          }
          return false;
        };
        const occluded = (element) => {
          const startX = window.scrollX;
          const startY = window.scrollY;
          element.scrollIntoView({ block: "center", inline: "nearest" });
          const range = document.createRange();
          range.selectNodeContents(element);
          const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
          const obscured = rects.length === 0 || rects.some((rect) => {
            const insetX = Math.min(2, rect.width / 4);
            const insetY = Math.min(2, rect.height / 4);
            const points = [[rect.left + rect.width / 2, rect.top + rect.height / 2],
              [rect.left + insetX, rect.top + insetY], [rect.right - insetX, rect.top + insetY],
              [rect.left + insetX, rect.bottom - insetY], [rect.right - insetX, rect.bottom - insetY]]
              .filter(([x, y]) => x >= 0 && x < document.documentElement.clientWidth
                && y >= 0 && y < document.documentElement.clientHeight);
            return points.length === 0 || points.some(([x, y]) => {
              const top = document.elementFromPoint(x, y);
              return !top || (top !== element && !element.contains(top));
            });
          });
          window.scrollTo(startX, startY);
          return obscured;
        };
        const facts = [...document.querySelectorAll("[data-std-fact]")].map((element) => {
          const identifier = element.getAttribute("data-std-fact");
          const text = element.textContent || "";
          if (!identifier || identifier.length > 120 || !/^[a-zA-Z0-9.]+$/.test(identifier)) {
            throw new Error("artifact has an invalid fact-marker identifier");
          }
          if ([...text].length > 3000) throw new Error("fact text exceeds the 3000 character evidence limit");
          const range = document.createRange();
          range.selectNodeContents(element);
          const lineTops = new Set([...range.getClientRects()]
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => Math.round(rect.top * 10) / 10));
          const covered = occluded(element);
          const contrast = Math.round(contrastRatio(element) * 1000) / 1000;
          return { id: identifier, text,
            visible: shown(element) && !covered, clipped: clipped(element), occluded: covered,
            contrastRatio: contrast, lineCount: lineTops.size,
            bounds: roundedBounds(range.getBoundingClientRect()) };
        });
        const overflowCandidates = [...document.body.querySelectorAll("*")].filter((element) => {
          if (!shown(element)) return false;
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1
            || (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
              && element.scrollWidth > element.clientWidth + 1);
        });
        if (overflowCandidates.length > 200) throw new Error("artifact exceeds the 200 overflowing-element inspection limit");
        const overflowingElements = overflowCandidates.map((element) => ({ tag: element.tagName.toLowerCase(),
          factId: element.getAttribute("data-std-fact") || "", bounds: roundedBounds(element.getBoundingClientRect()) }));
        const unmarkedText = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const text = (walker.currentNode.textContent || "").replace(/\s+/g, " ").trim();
          const parent = walker.currentNode.parentElement;
          if ([...text].length > 3000) throw new Error("unmarked text exceeds the 3000 character evidence limit");
          if (text && parent && !parent.closest("[data-std-fact]")
              && shown(parent) && !clipped(parent) && !occluded(parent)) unmarkedText.push(text);
          if (unmarkedText.length > 200) throw new Error("artifact exceeds the 200 unmarked-text inspection limit");
        }
        const titleMarkers = [...document.querySelectorAll('[data-std-fact="title"]')];
        const invariantTitle = titleMarkers.length === 1 ? titleMarkers[0] : null;
        const fullViewport = (bounds) => bounds.width > 0 && bounds.height > 0
          && Math.abs(bounds.x) <= 1
          && Math.abs(bounds.width - document.documentElement.clientWidth) <= 1;
        const visuallyPresent = (element) => {
          for (let candidate = element; candidate; candidate = candidate.parentElement) {
            const style = getComputedStyle(candidate);
            if (style.display === "none" || style.visibility === "hidden"
                || style.visibility === "collapse" || Number(style.opacity) <= 0) return false;
          }
          return true;
        };
        const invariantBandCandidates = [...document.body.querySelectorAll("*")]
          .filter((candidate) => {
            const bounds = candidate.getBoundingClientRect();
            return visuallyPresent(candidate) && fullViewport(bounds)
              && Math.abs(bounds.height - 32) <= 1
              && getComputedStyle(candidate).backgroundColor === "rgb(17, 17, 17)";
          });
        const invariantCandidateSet = new Set(invariantBandCandidates);
        let invariantBandElement = null;
        let diagnosticBandElement = null;
        for (let candidate = invariantTitle; candidate && candidate !== document.body;
          candidate = candidate.parentElement) {
          const bounds = candidate.getBoundingClientRect();
          const backgroundColor = getComputedStyle(candidate).backgroundColor;
          if (visuallyPresent(candidate) && fullViewport(bounds) && !transparent(backgroundColor)) {
            diagnosticBandElement ??= candidate;
            if (invariantCandidateSet.has(candidate)) {
              invariantBandElement = candidate;
              break;
            }
          }
        }
        invariantBandElement ??= diagnosticBandElement;
        const invariantBandStyle = invariantBandElement ? getComputedStyle(invariantBandElement) : null;
        const cssPixels = (value) => Math.round(Number.parseFloat(value) * 1000) / 1000;
        const invariantBand = {
          count: invariantBandCandidates.length,
          containsTitle: Boolean(invariantBandElement && invariantTitle
            && invariantBandElement.contains(invariantTitle)),
          bounds: invariantBandElement ? roundedBounds(invariantBandElement.getBoundingClientRect()) : null,
          backgroundColor: invariantBandStyle ? invariantBandStyle.backgroundColor : null,
          titleColor: invariantTitle ? getComputedStyle(invariantTitle).color : null,
          borderWidths: invariantBandStyle ? {
            top: cssPixels(invariantBandStyle.borderTopWidth),
            right: cssPixels(invariantBandStyle.borderRightWidth),
            bottom: cssPixels(invariantBandStyle.borderBottomWidth),
            left: cssPixels(invariantBandStyle.borderLeftWidth),
          } : null,
        };
        const visibleHeadings = [...document.querySelectorAll("h1")]
          .filter((heading) => shown(heading) && !occluded(heading));
        const factNodes = (identifier) => [...document.querySelectorAll(`[data-std-fact="${identifier}"]`)];
        const oneFact = (identifier) => {
          const matches = factNodes(identifier);
          return matches.length === 1 ? matches[0] : null;
        };
        const usable = (element) => Boolean(element && shown(element) && !clipped(element) && !occluded(element));
        const follows = (before, after) => Boolean(before && after
          && (before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING));
        const expectedText = (element, text) => Boolean(element && element.textContent === text);
        const relationshipResults = {};

        if (input.contentKind === "datum") {
          const label = oneFact("datum.label");
          const value = oneFact("datum.value");
          relationshipResults["datum.label-value"] = usable(label) && usable(value)
            && label.closest("section") === value.closest("section") && follows(label, value);
        } else if (input.contentKind === "matrix") {
          const tables = [...document.querySelectorAll("table")].filter(shown);
          const table = tables.length === 1 ? tables[0] : null;
          const headers = table ? [...table.querySelectorAll(":scope > thead th[scope=col]")] : [];
          const rows = table ? [...table.querySelectorAll(":scope > tbody > tr")] : [];
          relationshipResults["matrix.column-headers"] = headers.length === input.props.columns.length
            && headers.every((header, index) => usable(header)
              && header.getAttribute("data-std-fact") === `matrix.columns.${index}`
              && expectedText(header, input.props.columns[index]));
          relationshipResults["matrix.row-headers"] = rows.length === input.props.rows.length
            && rows.every((row, index) => {
              const header = row.querySelector(":scope > th:first-child");
              return header?.scope === "row" && usable(header)
                && header.getAttribute("data-std-fact") === `matrix.rows.${index}.label`
                && expectedText(header, input.props.rows[index].label);
            });
          relationshipResults["matrix.grid"] = rows.length === input.props.rows.length
            && rows.every((row, rowIndex) => {
              const cells = [...row.children];
              return cells.length === input.props.columns.length + 1
                && cells[0].tagName === "TH"
                && cells.slice(1).every((cell, columnIndex) => cell.tagName === "TD" && usable(cell)
                  && cell.getAttribute("data-std-fact") === `matrix.rows.${rowIndex}.values.${columnIndex}`
                  && expectedText(cell, input.props.rows[rowIndex].values[columnIndex]));
            });
        } else if (input.contentKind === "bandStatement") {
          const statement = oneFact("bandStatement.statement");
          let darkBand = null;
          for (let candidate = statement?.parentElement; candidate; candidate = candidate.parentElement) {
            if (getComputedStyle(candidate).backgroundColor === "rgb(17, 17, 17)") {
              darkBand = candidate;
              break;
            }
          }
          relationshipResults["bandStatement.statement"] = usable(statement)
            && expectedText(statement, input.props.statement) && Boolean(darkBand?.contains(statement));
        } else if (input.contentKind === "series") {
          const lists = [...document.querySelectorAll("ol")].filter(shown);
          const list = lists.find((candidate) => candidate.querySelector('[data-std-fact^="series.periods."]'));
          const items = list ? [...list.querySelectorAll(":scope > li")] : [];
          relationshipResults["series.period-order"] = items.length === input.props.periods.length
            && items.every((item, index) => {
              const period = oneFact(`series.periods.${index}.period`);
              return usable(period) && item.contains(period)
                && expectedText(period, input.props.periods[index].period)
                && (index === 0 || follows(oneFact(`series.periods.${index - 1}.period`), period));
            });
          relationshipResults["series.value-association"] = items.length === input.props.periods.length
            && items.every((item, index) => {
              const period = oneFact(`series.periods.${index}.period`);
              const display = oneFact(`series.periods.${index}.display`);
              return usable(period) && usable(display) && item.contains(period) && item.contains(display)
                && expectedText(display, input.props.periods[index].display) && follows(period, display);
            });
        } else if (input.contentKind === "schedule") {
          const scheduleColumns = { ref: "REF", description: "DESCRIPTION",
            duration: "DURATION", amount: "AMOUNT", ...(input.props.columns ?? {}) };
          const tables = [...document.querySelectorAll("table")].filter(shown);
          const table = tables.length === 1 ? tables[0] : null;
          const caption = table?.querySelector(":scope > caption");
          const headers = table ? [...table.querySelectorAll(":scope > thead > tr:first-child > th")] : [];
          const rows = table ? [...table.querySelectorAll(":scope > tbody > tr")] : [];
          const footers = table ? [...table.querySelectorAll(":scope > tfoot")] : [];
          const footerRows = footers.length === 1
            ? [...footers[0].children].filter((child) => child.tagName === "TR") : [];
          const footerCells = footerRows.length === 1 ? [...footerRows[0].children] : [];
          const noSpan = (cell) => cell.colSpan === 1 && cell.rowSpan === 1;
          const durationBeforeAmount = (duration, amount) => {
            if (!duration || !amount) return false;
            const durationBounds = duration.getBoundingClientRect();
            const amountBounds = amount.getBoundingClientRect();
            const verticalOverlap = Math.min(durationBounds.bottom, amountBounds.bottom)
              - Math.max(durationBounds.top, amountBounds.top);
            return durationBounds.width > 0 && durationBounds.height > 0
              && amountBounds.width > 0 && amountBounds.height > 0
              && durationBounds.left < amountBounds.left && verticalOverlap > 0;
          };
          const columnNames = ["ref", "description", "duration", "amount"];
          relationshipResults["schedule.named-table"] = Boolean(table && usable(caption)
            && caption.getAttribute("data-std-fact") === "schedule.label"
            && expectedText(caption, input.props.label));
          relationshipResults["schedule.column-headers"] = headers.length === 4
            && headers.every((header, index) => header.scope === "col" && noSpan(header) && usable(header)
              && header.getAttribute("data-std-fact") === `schedule.columns.${columnNames[index]}`
              && expectedText(header, scheduleColumns[columnNames[index]]));
          relationshipResults["schedule.row-headers"] = rows.length === input.props.lines.length
            && rows.every((row, index) => {
              const header = row.querySelector(":scope > th:first-child");
              return header?.scope === "row" && usable(header)
                && header.getAttribute("data-std-fact") === `schedule.lines.${index}.ref`
                && expectedText(header, input.props.lines[index].ref);
            });
          relationshipResults["schedule.numeric-order"] = rows.length > 0
            && rows.every((row) => durationBeforeAmount(row.children[2], row.children[3]))
            && (input.props.total === undefined || (footerCells.length === 3
              && durationBeforeAmount(footerCells[1], footerCells[2])));
          relationshipResults["schedule.footer"] = input.props.total === undefined
            ? footers.length === 0
            : footers.length === 1 && footerCells.length === 3 && footerCells[0].tagName === "TH"
              && footerCells[0].scope === "row" && footerCells[0].colSpan === 2 && footerCells[0].rowSpan === 1
              && footerCells.slice(1).every((cell) => cell.tagName === "TD" && noSpan(cell));
        } else if (input.contentKind === "runningIndex") {
          const navs = [...document.querySelectorAll("nav")].filter(shown);
          const nav = navs.find((candidate) => candidate.querySelector('[data-std-fact^="runningIndex.sections."]'));
          const items = nav ? [...nav.querySelectorAll(":scope > ol > li")] : [];
          relationshipResults["runningIndex.section-order"] = items.length === input.props.sections.length
            && items.every((item, index) => {
              const number = oneFact(`runningIndex.numbers.${index}`);
              const section = oneFact(`runningIndex.sections.${index}`);
              return usable(number) && usable(section) && item.contains(number) && item.contains(section)
                && expectedText(number, String(index + 1)) && follows(number, section)
                && expectedText(section, input.props.sections[index])
                && (index === 0 || follows(oneFact(`runningIndex.sections.${index - 1}`), section));
            });
          const current = input.props.current;
          const selected = items.filter((item) => item.getAttribute("aria-current") === "step");
          relationshipResults["runningIndex.current-section"] = current === undefined
            ? items.length === input.props.sections.length && selected.length === 0
            : items.length === input.props.sections.length && selected.length === 1
              && items[current - 1]?.getAttribute("aria-current") === "step"
              && items.every((item, index) => index === current - 1
                || item.getAttribute("aria-current") === null);
        }
        const semanticChecks = { move: input.move,
          oneVisibleH1: visibleHeadings.length === 1 && Boolean(visibleHeadings[0].textContent.trim()),
          relationships: input.requiredRelationships.map((id) => ({ id, passed: relationshipResults[id] === true })) };
        hitTestStyle.remove();
        return {
          document: { clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight,
            scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
          bodyTextLength, overflowingElements, facts, unmarkedText, invariantBand,
          semanticChecks,
        };
      }, inspection);
      const factOrder = new Map(plan.facts.map((fact, index) => [fact.id, index]));
      observed.facts.sort((left, right) => (factOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
        - (factOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER));
      const screenshotFile = `${plan.content.kind}-${viewport.width}x${viewport.height}.png`;
      const screenshotPath = join(outDir, screenshotFile);
      const fullPage = observed.document.scrollHeight <= 20_000
        && observed.document.scrollHeight * observed.document.scrollWidth <= 40_000_000;
      if (!fullPage) recordPageError("document exceeds the bounded full-page screenshot area");
      if (pageErrorOverflow || blockedRequestOverflow) {
        throw new Error("artifact exceeds the 100 browser-error or blocked-request inspection limit");
      }
      await page.screenshot({ path: screenshotPath, fullPage });
      const screenshot = await readFile(screenshotPath);
      const screenshotBase64 = screenshot.toString("base64");
      if (screenshotBase64.length > 1_500_000) throw new Error("screenshot exceeds the embedded evidence limit");
      evidence.viewports.push({ width: viewport.width, height: viewport.height, ...observed,
        pageErrors, blockedRequests, screenshot: { file: screenshotFile, sha256: sha256(screenshot),
          dataBase64: screenshotBase64 } });
      await context.close();
    }
    if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > 3_500_000) {
      throw new Error("render evidence exceeds the 3500000 byte transport limit");
    }
    return evidence;
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.identity) {
    process.stdout.write(JSON.stringify(await rendererIdentity(), null, 2) + "\n");
    return;
  }
  const plan = JSON.parse((await readBounded(resolve(args.plan), 500_000, "plan")).toString("utf8"));
  const html = args.html ? (await readBounded(resolve(args.html), 2_000_000, "artifact")).toString("utf8") : await renderPlan(plan);
  const outDir = resolve(args.out);
  await mkdir(outDir, { recursive: true });
  const artifactPath = join(outDir, "artifact.html");
  await writeFile(artifactPath, html, "utf8");
  const evidence = await inspectArtifact(plan, html, outDir);
  const evidencePath = join(outDir, "render-evidence.json");
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  process.stdout.write(JSON.stringify({ artifact: artifactPath, evidence: evidencePath,
    artifactSha256: evidence.artifactSha256, planSha256: evidence.planSha256 }) + "\n");
}

if (process.argv[1] && scriptPath === resolve(process.argv[1])) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}

export { canonical, expectedFacts, renderPlan, inspectArtifact, rendererIdentity };

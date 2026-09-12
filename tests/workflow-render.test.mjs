import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { chromium } from "playwright";
import { canonical, expectedFacts, rendererIdentity } from "../scripts/workflow-render.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const RENDERER_IDENTITY = await rendererIdentity();

test("renderer identity binds the complete installed browser payload", () => {
  assert.match(RENDERER_IDENTITY.browserLauncherSha256, /^[0-9a-f]{64}$/);
  assert.match(RENDERER_IDENTITY.browserPayloadSha256, /^[0-9a-f]{64}$/);
});

function scheduleFacts(title, props) {
  const facts = [{ id: "title", text: title }, { id: "schedule.label", text: props.label }];
  for (const field of ["ref", "description", "duration", "amount"]) {
    facts.push({ id: `schedule.columns.${field}`, text: props.columns[field] });
  }
  props.lines.forEach((line, index) => {
    for (const field of ["ref", "description", "standard", "duration", "amount"]) {
      if (line[field] !== undefined) facts.push({ id: `schedule.lines.${index}.${field}`, text: line[field] });
    }
  });
  if (props.total) {
    for (const field of ["label", "duration", "amount"]) {
      facts.push({ id: `schedule.total.${field}`, text: props.total[field] });
    }
  }
  if (props.note) facts.push({ id: "schedule.note", text: props.note });
  return facts;
}

function plan() {
  const title = "Content system proposal";
  const props = {
    label: "Scope and fees · Q-204",
    columns: { ref: "Reference", description: "Deliverable", duration: "Delivery time", amount: "Fee" },
    lines: [
      { ref: "01", description: "Content inventory", standard: "One supplied archive", duration: "2 days", amount: "£800" },
      { ref: "02", description: "Template implementation", duration: "3 days", amount: "£1,200" },
    ],
    total: { label: "Total · excluding VAT", duration: "5 days", amount: "£2,000" },
    note: "The client supplies approved source material before work begins.", factPrefix: "schedule",
  };
  const facts = scheduleFacts(title, props);
  return { schemaVersion: "0.1.0", system: "instrument", job: "T", move: "Schedule",
    artifact: { format: "html", title, viewports: [
      { width: 960, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 844 },
    ] },
    context: { build: "full", reason: "Explicit test choice" },
    selection: { reason: "Precision is the persuasion", trigger: "Scope, cost or duration must be stated exactly", alternatives: [] },
    binding: { package: "@standards/instrument", packageVersion: "1.0.0", component: "Schedule", props }, facts,
    renderer: RENDERER_IDENTITY,
    rules: ["plan.valid"], maxRepairTurns: 2,
    source: { systemVersion: "1.0.0", schemaVersion: "v0.4", files: { "SOURCE.md": "0".repeat(64) }, implementation: { "workflow/engine.py": "1".repeat(64) } },
    limitations: ["Test fixture"] };
}

function longContentPlan() {
  const fixture = plan();
  const title = "Museum archive digitisation and public access programme";
  const props = {
    label: "Scope, delivery stages and professional fees · proposal AF-2026-041",
    columns: {
      ref: "PROJECT REFERENCE",
      description: "DELIVERABLE AND STANDARD",
      duration: "ESTIMATED DELIVERY TIME",
      amount: "PROFESSIONAL FEE",
    },
    lines: [
      {
        ref: "AF-2026-01",
        description: "Collection discovery, rights review and digitisation roadmap",
        standard: "Includes a stakeholder workshop, item-level inventory and an approved representative sample.",
        duration: "12 working days",
        amount: "£18,750.00",
      },
      {
        ref: "AF-2026-02",
        description: "Accessible template system and component implementation",
        standard: "Conforms to WCAG 2.2 AA, current browser support and the approved component acceptance checklist.",
        duration: "6 working weeks",
        amount: "£42,500.00",
      },
    ],
    total: { label: "Total professional fees · excluding VAT and third-party licensing", duration: "8 working weeks", amount: "£61,250.00" },
    note: "Programme dates assume approved source files, rights decisions and consolidated stakeholder feedback arrive by each agreed review milestone.",
    factPrefix: "schedule",
  };
  fixture.artifact = { format: "html", title, viewports: [{ width: 320, height: 844 }] };
  fixture.binding = { ...fixture.binding, props };
  fixture.facts = scheduleFacts(title, props);
  fixture.limitations = ["Long-content narrow-screen regression fixture"];
  return fixture;
}

async function inspectWordWrapping(html) {
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await page.evaluate(() => {
      const midWordBreaks = [];
      const headingLineCounts = {};
      for (const element of document.querySelectorAll("[data-std-fact]")) {
        const id = element.getAttribute("data-std-fact");
        if (id?.startsWith("schedule.columns.")) {
          const range = document.createRange();
          range.selectNodeContents(element);
          headingLineCounts[id] = new Set([...range.getClientRects()]
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => Math.round(rect.top * 10) / 10)).size;
        }
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (const match of node.data.matchAll(/[\p{L}\p{M}]+(?:[’'][\p{L}\p{M}]+)*/gu)) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const lines = new Set([...range.getClientRects()]
              .filter((rect) => rect.width > 0 && rect.height > 0)
              .map((rect) => Math.round(rect.top * 10) / 10));
            if (lines.size > 1) midWordBreaks.push({ id, word: match[0], lines: lines.size });
          }
        }
      }
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headingLineCounts,
        midWordBreaks,
      };
    });
  } finally {
    await browser.close();
  }
}

async function inspectInvariantBand(html, viewport, expectedTitle) {
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  try {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await page.evaluate((title) => {
      const bands = [...document.querySelectorAll(".instrument-band")];
      const headings = [...document.querySelectorAll("h1")];
      const titleFacts = [...document.querySelectorAll('[data-std-fact="title"]')];
      const band = bands[0];
      const heading = headings[0];
      const titleCandidates = [...new Set(document.querySelectorAll(
        '.instrument-band-title, .instrument-title, [data-std-fact="title"]'))];
      const bounds = band?.getBoundingClientRect();
      const headingBounds = heading?.getBoundingClientRect();
      const headingStyle = heading ? getComputedStyle(heading) : null;
      return {
        bandCount: bands.length,
        headingCount: headings.length,
        titleFactCount: titleFacts.length,
        titleFactIsHeading: titleFacts.length === 1 && titleFacts[0] === heading,
        emptyTitleCount: titleCandidates.filter((node) => !node.textContent?.trim()).length,
        title: heading?.textContent?.trim() ?? "",
        expectedTitle: title,
        titleInsideBand: Boolean(band && heading && band.contains(heading)),
        titleVisible: Boolean(headingBounds && headingBounds.width > 0 && headingBounds.height > 0
          && headingStyle && headingStyle.display !== "none" && headingStyle.visibility !== "hidden"
          && Number(headingStyle.opacity) > 0),
        titleWithinBand: Boolean(bounds && headingBounds
          && headingBounds.left >= bounds.left && headingBounds.right <= bounds.right
          && headingBounds.top >= bounds.top && headingBounds.bottom <= bounds.bottom),
        bandBounds: bounds ? { x: bounds.x, width: bounds.width, height: bounds.height } : null,
        bandBackground: band ? getComputedStyle(band).backgroundColor : null,
        titleColour: heading ? getComputedStyle(heading).color : null,
      };
    }, expectedTitle);
  } finally {
    await browser.close();
  }
}

function assertInvariantBand(observed, viewport) {
  assert.equal(observed.bandCount, 1);
  assert.equal(observed.headingCount, 1);
  assert.equal(observed.titleFactCount, 1);
  assert.equal(observed.titleFactIsHeading, true);
  assert.equal(observed.emptyTitleCount, 0);
  assert.equal(observed.title, observed.expectedTitle);
  assert.equal(observed.titleInsideBand, true);
  assert.equal(observed.titleVisible, true);
  assert.equal(observed.titleWithinBand, true);
  assert.deepEqual(observed.bandBounds, { x: 0, width: viewport.width, height: 32 });
  assert.equal(observed.bandBackground, "rgb(17, 17, 17)");
  assert.equal(observed.titleColour, "rgb(255, 255, 255)");
}

function expectedInvariantBand(viewport) {
  return {
    count: 1,
    containsTitle: true,
    bounds: { x: 0, y: 0, width: viewport.width, height: 32 },
    backgroundColor: "rgb(17, 17, 17)",
    titleColor: "rgb(255, 255, 255)",
    borderWidths: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

async function inspectScheduleHeaderTreatment(html, viewport) {
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  try {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await page.evaluate(() => {
      const table = document.querySelector(".instrument-schedule");
      const headerRow = table?.querySelector(":scope > thead > tr");
      const ruleRow = table?.querySelector(":scope > thead > tr.instrument-schedule-header-rule");
      const ruleCell = ruleRow?.querySelector(":scope > td");
      const headers = [...(headerRow?.querySelectorAll(":scope > th") ?? [])];
      const firstBodyCells = [...(table?.querySelectorAll(":scope > tbody > tr:first-child > th, :scope > tbody > tr:first-child > td") ?? [])];
      const tableBounds = table?.getBoundingClientRect();
      const headerBounds = headerRow?.getBoundingClientRect();
      const ruleBounds = ruleRow?.getBoundingClientRect();
      const ruleCellBounds = ruleCell?.getBoundingClientRect();
      const ruleStyle = ruleRow ? getComputedStyle(ruleRow) : null;
      const ruleCellStyle = ruleCell ? getComputedStyle(ruleCell) : null;
      return {
        text: headers.map((header) => header.textContent),
        headers: headers.map((header) => {
          const style = getComputedStyle(header);
          return { textTransform: style.textTransform, fontFamily: style.fontFamily,
            color: style.color, letterSpacing: style.letterSpacing };
        }),
        tableBounds: tableBounds ? { x: tableBounds.x, width: tableBounds.width } : null,
        headerBounds: headerBounds ? { x: headerBounds.x, width: headerBounds.width,
          bottom: headerBounds.bottom } : null,
        rule: ruleBounds && ruleCellBounds && ruleStyle && ruleCellStyle
          ? { ariaHidden: ruleRow.getAttribute("aria-hidden"), text: ruleRow.textContent,
            bounds: { x: ruleBounds.x, y: ruleBounds.y, width: ruleBounds.width, height: ruleBounds.height },
            cellBounds: { x: ruleCellBounds.x, y: ruleCellBounds.y,
              width: ruleCellBounds.width, height: ruleCellBounds.height },
            backgroundColor: ruleStyle.backgroundColor,
            cellBackgroundColor: ruleCellStyle.backgroundColor,
            cellPadding: ruleCellStyle.padding }
          : null,
        firstBodyBorderWidths: firstBodyCells.map((cell) => getComputedStyle(cell).borderTopWidth),
      };
    });
  } finally {
    await browser.close();
  }
}

function assertScheduleHeaderTreatment(observed, expectedText) {
  assert.deepEqual(observed.text, expectedText);
  assert.equal(observed.headers.length, 4);
  assert.ok(observed.headers.every((header) => header.textTransform === "uppercase"));
  assert.ok(observed.headers.every((header) => /^['"]?DM Mono['"]?(?:,|$)/.test(header.fontFamily)));
  assert.ok(observed.headers.every((header) => header.color === "rgb(107, 107, 107)"));
  assert.ok(observed.headers.every((header) => Number.parseFloat(header.letterSpacing) > 0));
  assert.equal(observed.headerBounds.x, observed.tableBounds.x);
  assert.equal(observed.headerBounds.width, observed.tableBounds.width);
  assert.deepEqual(observed.rule, { ariaHidden: "true", text: "",
    bounds: { x: observed.tableBounds.x, y: observed.headerBounds.bottom,
      width: observed.tableBounds.width, height: 1.5 },
    cellBounds: { x: observed.tableBounds.x, y: observed.headerBounds.bottom,
      width: observed.tableBounds.width, height: 1.5 },
    backgroundColor: "rgb(17, 17, 17)",
    cellBackgroundColor: "rgb(17, 17, 17)", cellPadding: "0px" });
  assert.deepEqual(observed.firstBodyBorderWidths, ["0px", "0px", "0px", "0px"]);
}

function runRenderer(args) {
  const result = spawnSync(process.execPath, ["scripts/workflow-render.mjs", ...args], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000, maxBuffer: 5_000_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("renders the allowlisted Schedule and records complete desktop/mobile evidence", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-"));
  const planPath = path.join(directory, "plan.json");
  const output = path.join(directory, "output");
  const fixture = plan();
  await writeFile(planPath, JSON.stringify(fixture));
  const summary = runRenderer(["--plan", planPath, "--out", output]);
  const html = await readFile(summary.artifact, "utf8");
  const evidence = JSON.parse(await readFile(summary.evidence, "utf8"));
  assert.match(html, /data-std-fact="schedule\.total\.amount"/);
  assert.match(html, /<header class="instrument-band"><h1 class="instrument-band-title" data-std-fact="title">/);
  assert.doesNotMatch(html, /aria-hidden="true"[^>]*><\/div><main[^>]*><h1/);
  assert.doesNotMatch(html, /<link[^>]+fonts\.googleapis\.com|url\(\s*https?:/);
  for (const family of ["public-sans", "dm-mono"]) {
    const encoded = html.match(new RegExp(`<meta name="standards-font-license:${family}" data-encoding="base64" content="([A-Za-z0-9+/=]+)">`))?.[1];
    assert.ok(encoded);
    assert.deepEqual(Buffer.from(encoded, "base64"), await readFile(path.join(ROOT, `node_modules/@fontsource/${family}/LICENSE`)));
  }
  assert.equal(evidence.planSha256, sha256(Buffer.from(canonical(fixture), "utf8")));
  assert.equal(evidence.artifactSha256, sha256(Buffer.from(html, "utf8")));
  assert.equal(evidence.viewports.length, 3);
  for (const viewport of evidence.viewports) {
    assert.deepEqual(viewport.overflowingElements, []);
    assert.deepEqual(viewport.pageErrors, []);
    assert.deepEqual(viewport.blockedRequests, []);
    assert.deepEqual(viewport.unmarkedText, []);
    assert.deepEqual(viewport.invariantBand, expectedInvariantBand(viewport));
    assert.equal(viewport.semanticChecks.tableCount, 1);
    assert.equal(viewport.semanticChecks.oneVisibleH1, true);
    assert.equal(viewport.semanticChecks.numericColumnOrder, true);
    assert.equal(viewport.semanticChecks.columnHeaders, true);
    assert.equal(viewport.semanticChecks.rowHeaders, true);
    assert.equal(viewport.semanticChecks.bodyGrid, true);
    assert.equal(viewport.semanticChecks.footerStructure, true);
    assert.equal(viewport.facts.length, fixture.facts.length);
    assert.ok(viewport.facts.every((fact) => fact.visible && !fact.clipped
      && !fact.occluded && fact.contrastRatio >= 4.5));
    assert.ok(viewport.facts.filter((fact) => fact.id.startsWith("schedule.columns."))
      .every((fact) => fact.lineCount === 1));
    const png = await readFile(path.join(output, viewport.screenshot.file));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(viewport.screenshot.sha256, sha256(png));
    assert.deepEqual(Buffer.from(viewport.screenshot.dataBase64, "base64"), png);
  }
  for (const viewport of fixture.artifact.viewports) {
    assertInvariantBand(await inspectInvariantBand(html, viewport, fixture.artifact.title), viewport);
  }
  const expectedHeadings = Object.values(fixture.binding.props.columns);
  for (const viewport of [{ width: 960, height: 720 }, { width: 320, height: 844 }]) {
    assertScheduleHeaderTreatment(await inspectScheduleHeaderTreatment(html, viewport), expectedHeadings);
  }
});

test("renders and verifies the valid Schedule variant without a total row", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-no-total-"));
  const planPath = path.join(directory, "plan.json");
  const output = path.join(directory, "output");
  const fixture = plan();
  fixture.artifact.viewports = [{ width: 640, height: 720 }];
  delete fixture.binding.props.total;
  fixture.facts = scheduleFacts(fixture.artifact.title, fixture.binding.props);
  assert.doesNotThrow(() => expectedFacts(fixture));
  await writeFile(planPath, JSON.stringify(fixture));
  const summary = runRenderer(["--plan", planPath, "--out", output]);
  const html = await readFile(summary.artifact, "utf8");
  const evidence = JSON.parse(await readFile(summary.evidence, "utf8"));
  assert.doesNotMatch(html, /<tfoot\b/i);
  assert.equal(evidence.viewports[0].semanticChecks.footerStructure, true);
  assert.equal(evidence.viewports[0].facts.length, fixture.facts.length);

  const emptyFooterPath = path.join(directory, "empty-footer.html");
  const emptyFooterOutput = path.join(directory, "empty-footer-output");
  await writeFile(emptyFooterPath, html.replace("</table>", "<tfoot></tfoot></table>"));
  const inspected = runRenderer(["--plan", planPath, "--html", emptyFooterPath, "--out", emptyFooterOutput]);
  const emptyFooterEvidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.equal(emptyFooterEvidence.viewports[0].semanticChecks.footerStructure, false);
});

test("derives the invariant band from its treatment rather than renderer class names", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-generic-band-"));
  const planPath = path.join(directory, "plan.json");
  const referenceOutput = path.join(directory, "reference");
  const candidateOutput = path.join(directory, "candidate");
  const fixture = plan();
  fixture.artifact.viewports = [{ width: 960, height: 720 }, { width: 320, height: 844 }];
  await writeFile(planPath, JSON.stringify(fixture));
  const reference = runRenderer(["--plan", planPath, "--out", referenceOutput]);
  const html = await readFile(reference.artifact, "utf8");
  const candidate = html.replaceAll("instrument-band-title", "candidate-title")
    .replaceAll("instrument-band", "candidate-header");
  assert.doesNotMatch(candidate, /instrument-band/);
  const candidatePath = path.join(directory, "candidate.html");
  await writeFile(candidatePath, candidate);
  const inspected = runRenderer(["--plan", planPath, "--html", candidatePath, "--out", candidateOutput]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  for (const viewport of evidence.viewports) {
    assert.deepEqual(viewport.invariantBand, expectedInvariantBand(viewport));
    assert.equal(viewport.semanticChecks.oneVisibleH1, true);
  }
});

test("records duplicate and bordered invariant band treatments", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-band-defects-"));
  const planPath = path.join(directory, "plan.json");
  const referenceOutput = path.join(directory, "reference");
  const fixture = plan();
  fixture.artifact.viewports = [{ width: 320, height: 844 }];
  await writeFile(planPath, JSON.stringify(fixture));
  const reference = runRenderer(["--plan", planPath, "--out", referenceOutput]);
  const html = await readFile(reference.artifact, "utf8");

  const duplicatePath = path.join(directory, "duplicate-band.html");
  await writeFile(duplicatePath, html.replace("</body>",
    '<div aria-hidden="true" style="width:100%;height:32px;background:#111"></div></body>'));
  const duplicate = runRenderer(["--plan", planPath, "--html", duplicatePath,
    "--out", path.join(directory, "duplicate-output")]);
  const duplicateEvidence = JSON.parse(await readFile(duplicate.evidence, "utf8"));
  assert.equal(duplicateEvidence.viewports[0].invariantBand.count, 2);
  assert.deepEqual(duplicateEvidence.viewports[0].invariantBand.bounds,
    { x: 0, y: 0, width: 320, height: 32 });

  const borderedPath = path.join(directory, "bordered-band.html");
  await writeFile(borderedPath, html.replace("</head>",
    "<style>.instrument-band{border:16px solid #fff}</style></head>"));
  const bordered = runRenderer(["--plan", planPath, "--html", borderedPath,
    "--out", path.join(directory, "bordered-output")]);
  const borderedEvidence = JSON.parse(await readFile(bordered.evidence, "utf8"));
  assert.equal(borderedEvidence.viewports[0].invariantBand.count, 1);
  assert.deepEqual(borderedEvidence.viewports[0].invariantBand.borderWidths,
    { top: 16, right: 16, bottom: 16, left: 16 });
});

test("records numeric columns moved out of visual order by CSS", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-column-order-"));
  const planPath = path.join(directory, "plan.json");
  const referenceOutput = path.join(directory, "reference");
  const fixture = plan();
  fixture.artifact.viewports = [{ width: 960, height: 720 }, { width: 320, height: 844 }];
  await writeFile(planPath, JSON.stringify(fixture));
  const reference = runRenderer(["--plan", planPath, "--out", referenceOutput]);
  const html = await readFile(reference.artifact, "utf8");
  const swappedPath = path.join(directory, "swapped.html");
  await writeFile(swappedPath, html.replace("</head>", `<style>
    .instrument-schedule tbody tr{display:grid;grid-template-columns:12fr 42fr 24fr 22fr}
    .instrument-schedule tbody tr>:nth-child(3){order:4}
    .instrument-schedule tbody tr>:nth-child(4){order:3}
  </style></head>`));
  const inspected = runRenderer(["--plan", planPath, "--html", swappedPath,
    "--out", path.join(directory, "swapped-output")]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.ok(evidence.viewports.every((viewport) => !viewport.semanticChecks.numericColumnOrder));
});

test("records whether the artifact has exactly one visible nonblank h1", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-heading-count-"));
  const planPath = path.join(directory, "plan.json");
  const referenceOutput = path.join(directory, "reference");
  const fixture = plan();
  fixture.artifact.viewports = [{ width: 320, height: 844 }];
  await writeFile(planPath, JSON.stringify(fixture));
  const reference = runRenderer(["--plan", planPath, "--out", referenceOutput]);
  const html = await readFile(reference.artifact, "utf8");

  const hiddenPath = path.join(directory, "hidden-heading.html");
  await writeFile(hiddenPath, html.replace("</head>", "<style>h1{display:none!important}</style></head>"));
  const hidden = runRenderer(["--plan", planPath, "--html", hiddenPath,
    "--out", path.join(directory, "hidden-output")]);
  const hiddenEvidence = JSON.parse(await readFile(hidden.evidence, "utf8"));
  assert.equal(hiddenEvidence.viewports[0].semanticChecks.oneVisibleH1, false);

  const duplicatePath = path.join(directory, "duplicate-heading.html");
  await writeFile(duplicatePath, html.replace("</body>", "<h1>Duplicate heading</h1></body>"));
  const duplicate = runRenderer(["--plan", planPath, "--html", duplicatePath,
    "--out", path.join(directory, "duplicate-output")]);
  const duplicateEvidence = JSON.parse(await readFile(duplicate.evidence, "utf8"));
  assert.equal(duplicateEvidence.viewports[0].semanticChecks.oneVisibleH1, false);
});

test("keeps a fact-heavy Schedule legible and horizontally complete at 320px", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-long-mobile-"));
  const planPath = path.join(directory, "plan.json");
  const output = path.join(directory, "output");
  const fixture = longContentPlan();
  assert.doesNotThrow(() => expectedFacts(fixture));
  await writeFile(planPath, JSON.stringify(fixture));
  const summary = runRenderer(["--plan", planPath, "--out", output]);
  const html = await readFile(summary.artifact, "utf8");
  const evidence = JSON.parse(await readFile(summary.evidence, "utf8"));
  const viewport = evidence.viewports[0];
  assert.equal(evidence.viewports.length, 1);
  assert.equal(viewport.width, 320);
  assert.equal(viewport.document.clientWidth, 320);
  assert.equal(viewport.document.scrollWidth, 320);
  assert.deepEqual(viewport.overflowingElements, []);
  assert.deepEqual(viewport.pageErrors, []);
  assert.deepEqual(viewport.blockedRequests, []);
  assert.deepEqual(viewport.unmarkedText, []);
  assert.deepEqual(viewport.invariantBand, expectedInvariantBand(viewport));
  assert.equal(viewport.facts.length, fixture.facts.length);
  assert.deepEqual(viewport.facts.map(({ id, text }) => ({ id, text })), fixture.facts);
  for (const fact of viewport.facts.filter(({ id }) => id.startsWith("schedule."))) {
    assert.equal(fact.visible, true, `${fact.id} must be visible`);
    assert.equal(fact.clipped, false, `${fact.id} must not be clipped`);
    assert.equal(fact.occluded, false, `${fact.id} must not be occluded`);
    assert.ok(fact.contrastRatio >= 4.5, `${fact.id} contrast ${fact.contrastRatio} is below 4.5:1`);
    assert.ok(fact.bounds.x >= -1, `${fact.id} starts outside the viewport`);
    assert.ok(fact.bounds.x + fact.bounds.width <= 321, `${fact.id} ends outside the viewport`);
  }
  assert.ok(viewport.facts.filter(({ id }) => /^schedule\.(?:lines\.\d+|total)\.(?:duration|amount)$/.test(id))
    .every(({ lineCount }) => lineCount === 1), "durations and fees must remain readable on one line");
  assertInvariantBand(await inspectInvariantBand(
    html, fixture.artifact.viewports[0], fixture.artifact.title), fixture.artifact.viewports[0]);

  const screenshot = await readFile(path.join(output, viewport.screenshot.file));
  assert.equal(screenshot.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(screenshot.readUInt32BE(16), 320);
  assert.equal(viewport.screenshot.sha256, sha256(screenshot));
  assert.deepEqual(Buffer.from(viewport.screenshot.dataBase64, "base64"), screenshot);

  const layout = await inspectWordWrapping(html);
  assert.equal(layout.clientWidth, 320);
  assert.equal(layout.scrollWidth, 320);
  assert.deepEqual(layout.midWordBreaks, []);
  const headingLines = Object.values(layout.headingLineCounts);
  assert.equal(headingLines.length, 4);
  assert.ok(headingLines.some((lineCount) => lineCount > 1), "fixture must exercise heading wrapping");
  assert.ok(headingLines.every((lineCount) => lineCount >= 1 && lineCount <= 2),
    `headings must wrap into at most two intact lines: ${JSON.stringify(layout.headingLineCounts)}`);
});

test("keeps the long Schedule complete across its mobile-to-table breakpoint", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-breakpoint-"));
  const planPath = path.join(directory, "plan.json");
  const output = path.join(directory, "output");
  const fixture = longContentPlan();
  fixture.artifact.viewports = [
    { width: 480, height: 844 },
    { width: 639, height: 844 },
    { width: 640, height: 844 },
  ];
  await writeFile(planPath, JSON.stringify(fixture));
  const summary = runRenderer(["--plan", planPath, "--out", output]);
  const evidence = JSON.parse(await readFile(summary.evidence, "utf8"));
  assert.deepEqual(evidence.viewports.map(({ width }) => width), [480, 639, 640]);
  for (const viewport of evidence.viewports) {
    assert.equal(viewport.document.clientWidth, viewport.width);
    assert.equal(viewport.document.scrollWidth, viewport.width);
    assert.deepEqual(viewport.overflowingElements, []);
    assert.deepEqual(viewport.pageErrors, []);
    assert.deepEqual(viewport.blockedRequests, []);
    assert.deepEqual(viewport.invariantBand, expectedInvariantBand(viewport));
    assert.ok(viewport.facts.every((fact) => fact.visible && !fact.clipped && !fact.occluded));
    assert.ok(viewport.facts.filter(({ id }) => id.startsWith("schedule.columns."))
      .every(({ lineCount }) => lineCount >= 1 && lineCount <= 2));
  }
});

test("inspection disables artifact scripts and records attempted external requests", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-hostile-"));
  const planPath = path.join(directory, "plan.json");
  const goodOutput = path.join(directory, "good");
  const hostileOutput = path.join(directory, "hostile");
  await writeFile(planPath, JSON.stringify(plan()));
  const good = runRenderer(["--plan", planPath, "--out", goodOutput]);
  const original = await readFile(good.artifact, "utf8");
  const hostilePath = path.join(directory, "hostile.html");
  await writeFile(hostilePath, original.replace("</body>", '<script>document.body.textContent="PWNED"</script><img src="https://example.invalid/x.png"></body>'));
  const inspected = runRenderer(["--plan", planPath, "--html", hostilePath, "--out", hostileOutput]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.ok(evidence.viewports.every((viewport) => viewport.blockedRequests.includes("https://example.invalid/x.png")));
  assert.ok(evidence.viewports.every((viewport) => !viewport.unmarkedText.includes("PWNED")));
});

test("inspection rejects facts positioned outside the captured page", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-offscreen-"));
  const planPath = path.join(directory, "plan.json");
  const goodOutput = path.join(directory, "good");
  const offscreenOutput = path.join(directory, "offscreen");
  await writeFile(planPath, JSON.stringify(plan()));
  const good = runRenderer(["--plan", planPath, "--out", goodOutput]);
  const original = await readFile(good.artifact, "utf8");
  const offscreenPath = path.join(directory, "offscreen.html");
  await writeFile(offscreenPath, original.replace("</head>",
    "<style>[data-std-fact]{position:fixed!important;top:3000px!important;left:16px!important}</style></head>"));
  const inspected = runRenderer(["--plan", planPath, "--html", offscreenPath, "--out", offscreenOutput]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.ok(evidence.viewports.every((viewport) => viewport.facts.every((fact) => !fact.visible || fact.clipped)));
});

test("inspection rejects facts hidden behind an opaque overlay", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-overlay-"));
  const planPath = path.join(directory, "plan.json");
  const goodOutput = path.join(directory, "good");
  const overlayOutput = path.join(directory, "overlay");
  await writeFile(planPath, JSON.stringify(plan()));
  const good = runRenderer(["--plan", planPath, "--out", goodOutput]);
  const original = await readFile(good.artifact, "utf8");
  const overlayPath = path.join(directory, "overlay.html");
  await writeFile(overlayPath, original.replace("</body>",
    '<p>Covered unmarked copy</p><div style="position:fixed;inset:0;background:white;z-index:2147483647;pointer-events:none"></div></body>'));
  const inspected = runRenderer(["--plan", planPath, "--html", overlayPath, "--out", overlayOutput]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.ok(evidence.viewports.every((viewport) => viewport.facts.every((fact) => fact.occluded && !fact.visible)));
  assert.ok(evidence.viewports.every((viewport) => !viewport.unmarkedText.includes("Covered unmarked copy")));
});

test("unmarked-text evidence excludes content clipped by an ancestor", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-unmarked-clipped-"));
  const planPath = path.join(directory, "plan.json");
  const goodOutput = path.join(directory, "good");
  const clippedOutput = path.join(directory, "clipped");
  const fixture = plan();
  fixture.artifact.viewports = [{ width: 320, height: 844 }];
  await writeFile(planPath, JSON.stringify(fixture));
  const good = runRenderer(["--plan", planPath, "--out", goodOutput]);
  const original = await readFile(good.artifact, "utf8");
  const clippedPath = path.join(directory, "clipped.html");
  await writeFile(clippedPath, original.replace("</body>",
    '<div style="height:1px;overflow:hidden"><p>Clipped unmarked copy</p></div></body>'));
  const inspected = runRenderer(["--plan", planPath, "--html", clippedPath, "--out", clippedOutput]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.ok(evidence.viewports.every((viewport) => !viewport.unmarkedText.includes("Clipped unmarked copy")));
});

test("inspection rejects facts hidden by a visual filter", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-filter-"));
  const planPath = path.join(directory, "plan.json");
  const goodOutput = path.join(directory, "good");
  const filteredOutput = path.join(directory, "filtered");
  await writeFile(planPath, JSON.stringify(plan()));
  const good = runRenderer(["--plan", planPath, "--out", goodOutput]);
  const original = await readFile(good.artifact, "utf8");
  const filteredPath = path.join(directory, "filtered.html");
  await writeFile(filteredPath, original.replace("</head>",
    "<style>[data-std-fact]{filter:opacity(0)!important}</style></head>"));
  const inspected = runRenderer(["--plan", planPath, "--html", filteredPath, "--out", filteredOutput]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.ok(evidence.viewports.every((viewport) => viewport.facts.every((fact) => !fact.visible)));
});

test("inspection rejects fact text without sufficient contrast", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-contrast-"));
  const planPath = path.join(directory, "plan.json");
  const goodOutput = path.join(directory, "good");
  const contrastOutput = path.join(directory, "contrast");
  await writeFile(planPath, JSON.stringify(plan()));
  const good = runRenderer(["--plan", planPath, "--out", goodOutput]);
  const original = await readFile(good.artifact, "utf8");
  const contrastPath = path.join(directory, "contrast.html");
  await writeFile(contrastPath, original.replace("</head>",
    "<style>[data-std-fact]{color:white!important;background:white!important}</style></head>"));
  const inspected = runRenderer(["--plan", planPath, "--html", contrastPath, "--out", contrastOutput]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.ok(evidence.viewports.every((viewport) => viewport.facts
    .every((fact) => !fact.visible && fact.contrastRatio === 1)));
});

test("inspection measures the effective WebKit text fill colour", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-text-fill-"));
  const planPath = path.join(directory, "plan.json");
  const goodOutput = path.join(directory, "good");
  const fillOutput = path.join(directory, "fill");
  await writeFile(planPath, JSON.stringify(plan()));
  const good = runRenderer(["--plan", planPath, "--out", goodOutput]);
  const original = await readFile(good.artifact, "utf8");
  const fillPath = path.join(directory, "fill.html");
  await writeFile(fillPath, original.replace("</head>",
    "<style>[data-std-fact]{color:#111!important;background:#fff!important;-webkit-text-fill-color:#fff!important}</style></head>"));
  const inspected = runRenderer(["--plan", planPath, "--html", fillPath, "--out", fillOutput]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.ok(evidence.viewports.every((viewport) => viewport.facts
    .every((fact) => !fact.visible && fact.contrastRatio === 1)));
});

test("inspection rejects alternate text stroke painting", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standards-render-text-stroke-"));
  const planPath = path.join(directory, "plan.json");
  const goodOutput = path.join(directory, "good");
  const strokeOutput = path.join(directory, "stroke");
  await writeFile(planPath, JSON.stringify(plan()));
  const good = runRenderer(["--plan", planPath, "--out", goodOutput]);
  const original = await readFile(good.artifact, "utf8");
  const strokePath = path.join(directory, "stroke.html");
  await writeFile(strokePath, original.replace("</head>",
    "<style>[data-std-fact]{-webkit-text-stroke:12px #fff!important}</style></head>"));
  const inspected = runRenderer(["--plan", planPath, "--html", strokePath, "--out", strokeOutput]);
  const evidence = JSON.parse(await readFile(inspected.evidence, "utf8"));
  assert.ok(evidence.viewports.every((viewport) => viewport.facts
    .every((fact) => !fact.visible)));
});

test("rejects plans whose fact ledger differs from component props", () => {
  const fixture = plan();
  fixture.facts.at(-1).text = "Changed after planning";
  assert.throws(() => expectedFacts(fixture), /facts differ/);
});

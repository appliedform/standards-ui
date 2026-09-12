import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { Datum, InstrumentRoot } from "@standards/instrument";

const ROOT = path.resolve(import.meta.dirname, "..");

test("Instrument tokens stay inside their pack root and Root creates no network surface", async () => {
  const tokens = await readFile(path.join(ROOT, "packages/instrument/dist/styles/tokens.css"), "utf8");
  assert.doesNotMatch(tokens, /(^|[},\s]):root\b/m);
  assert.ok(tokens.match(/^\[data-standards-pack="instrument"\]/m));

  const markup = renderToStaticMarkup(React.createElement(InstrumentRoot, null,
    React.createElement(Datum, { label: "Yield", value: "96", unit: "%" })));
  assert.doesNotMatch(markup, /<(?:link|script|style)\b|https?:\/\//i);
  assert.match(markup, /^<div data-standards-pack="instrument"/);

  const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  try {
    const context = await browser.newContext({ viewport: { width: 640, height: 480 },
      javaScriptEnabled: false, serviceWorkers: "block" });
    const page = await context.newPage();
    const requests = [];
    await page.route("**/*", async (route) => {
      requests.push(route.request().url());
      await route.abort("blockedbyclient");
    });
    await page.setContent(`<!doctype html><html><head><style>
      ${tokens}
      body{color:rgb(1,2,3);font-family:serif}
      #host-sibling{background:rgb(4,5,6)}
      #fake-rule{background:rgb(7,8,9)}
    </style></head><body>
      <div id="host-sibling">Host content</div>
      <div id="fake-rule" class="instrument-schedule-header-rule"></div>
      ${markup}
    </body></html>`, { waitUntil: "load" });
    const observed = await page.evaluate(() => {
      const root = document.querySelector('[data-standards-pack="instrument"]');
      const host = document.querySelector("#host-sibling");
      const fakeRule = document.querySelector("#fake-rule");
      return {
        documentInk: getComputedStyle(document.documentElement).getPropertyValue("--ink").trim(),
        hostInk: getComputedStyle(host).getPropertyValue("--ink").trim(),
        hostColour: getComputedStyle(host).color,
        hostFont: getComputedStyle(host).fontFamily,
        hostBackground: getComputedStyle(host).backgroundColor,
        fakeRuleBackground: getComputedStyle(fakeRule).backgroundColor,
        packInk: getComputedStyle(root).getPropertyValue("--ink").trim(),
        packGround: getComputedStyle(root).getPropertyValue("--ground").trim(),
        packColour: getComputedStyle(root).color,
        packFont: getComputedStyle(root).fontFamily,
      };
    });
    assert.deepEqual(requests, []);
    assert.equal(observed.documentInk, "");
    assert.equal(observed.hostInk, "");
    assert.equal(observed.hostColour, "rgb(1, 2, 3)");
    assert.equal(observed.hostFont, "serif");
    assert.equal(observed.hostBackground, "rgb(4, 5, 6)");
    assert.equal(observed.fakeRuleBackground, "rgb(7, 8, 9)");
    assert.equal(observed.packInk, "#111111");
    assert.equal(observed.packGround, "#FFFFFF");
    assert.equal(observed.packColour, "rgb(17, 17, 17)");
    assert.match(observed.packFont, /^"?Public Sans"?(?:,|$)/);
    await context.close();
  } finally {
    await browser.close();
  }
});

test("bundled font CSS is explicit, local and complete", async () => {
  const css = await readFile(path.join(ROOT, "packages/instrument/dist/styles/fonts.css"), "utf8");
  assert.doesNotMatch(css, /https?:|\/\//i);
  assert.equal((css.match(/@font-face/g) ?? []).length, 5);
  const assets = ["PublicSans-400.woff2", "PublicSans-600.woff2", "PublicSans-800.woff2",
    "DMMono-400.woff2", "DMMono-500.woff2"];
  for (const asset of assets) {
    assert.match(css, new RegExp(asset.replace(".", "\\.")));
    const bytes = await readFile(path.join(ROOT, "packages/instrument/dist/fonts", asset));
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
  }
  for (const licence of ["OFL-Public-Sans.txt", "OFL-DM-Mono.txt"]) {
    assert.match(await readFile(path.join(ROOT, "packages/instrument/dist/fonts", licence), "utf8"),
      /SIL OPEN FONT LICENSE Version 1\.1/);
  }
});

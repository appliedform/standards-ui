import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

// This is a consumer-owned app, not an Instrument feature or an agent workflow
// admission. It exercises both supported React majors using only packed files.
const fixture = `
import * as React from 'react';
import { InstrumentRoot, Band, Datum, Matrix, BandStatement, Series, Schedule,
  RunningIndex } from '@standards/instrument';
export function App() {
  const [count, setCount] = React.useState(0);
  return React.createElement(React.Fragment, null,
    React.createElement('p', {id:'host-sibling'}, 'Host content'),
    React.createElement('button', {onClick:()=>setCount(count+1)}, 'Count ' + count),
    React.createElement(InstrumentRoot, null,
      React.createElement(Band, {title:'Packed consumer',meta:'React '+React.version}),
      React.createElement('main', {style:{padding:24,display:'grid',gap:48}},
        React.createElement(Datum, {label:'Yield',value:'24',unit:'%',factPrefix:'datum'}),
        React.createElement(Matrix, {label:'Comparison',columns:['Planned','Actual'],
          rows:[{label:'Review/build',values:['24','25']}],factPrefix:'matrix'}),
        React.createElement(BandStatement, {label:'Literal text',statement:'Safe <script>alert(1)</script> & exact',bleed:0,factPrefix:'statement'}),
        React.createElement(Series, {label:'Change',periods:[{period:'Before',value:-2,display:'−2'},
          {period:'After',value:3,display:'+3'}],factPrefix:'series'}),
        React.createElement(Schedule, {label:'Scope',lines:[{ref:'A',description:'Review',duration:'1 day',amount:'£0'}],
          total:{label:'Total',duration:'1 day',amount:'£0'},factPrefix:'schedule'}),
        React.createElement(RunningIndex, {document:'Report',folio:'1',sections:['Evidence','Decision'],current:2,factPrefix:'position'})
      )));
}
`;

export async function checkPackedBrowser(consumer, major, command) {
  writeFileSync(join(consumer, "app.mjs"), fixture);
  writeFileSync(join(consumer, "ssr.mjs"), `
    import * as React from 'react';
    import { renderToString } from 'react-dom/server';
    import { App } from './app.mjs';
    if (!React.version.startsWith('${major}.')) throw new Error('Wrong server React');
    process.stdout.write(renderToString(React.createElement(App)));
  `);
  const markup = command(process.execPath, ["ssr.mjs"], consumer);
  assert.match(markup, /Safe &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; exact/);
  assert.doesNotMatch(markup, /<script\b/);
  writeFileSync(join(consumer, "browser.mjs"), `
    import '@standards/instrument/styles/tokens.css';
    import '@standards/instrument/styles/fonts.css';
    import * as React from 'react';
    import { hydrateRoot } from 'react-dom/client';
    import { App } from './app.mjs';
    window.consumerReact = React.version;
    window.hydrationFailures = [];
    hydrateRoot(document.getElementById('app'), React.createElement(App), {
      onRecoverableError(error) { window.hydrationFailures.push(error.message); }
    });
  `);
  const outputDirectory = join(consumer, "bundle");
  const bundle = await build({ absWorkingDir: consumer, entryPoints: ["browser.mjs"],
    bundle: true, write: false, format: "iife", platform: "browser", metafile: true,
    outdir: outputDirectory, entryNames: "app", assetNames: "fonts/[name]-[hash]", loader: { ".woff2": "file" },
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent" });
  // A workspace fallback would turn this into a source checkout test, not a
  // distribution test. Every bundled input must come from this clean consumer.
  for (const input of Object.keys(bundle.metafile.inputs)) {
    assert.ok(resolve(consumer, input).startsWith(resolve(consumer) + "/"), `Escaped consumer: ${input}`);
  }
  const assets = new Map([
    ["/", { type: "text/html", body: `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="/app.css">
      <style>body{margin:0;color:rgb(1,2,3);font-family:serif}#host-sibling{background:rgb(4,5,6)}</style>
      </head><body><div id="app">${markup}</div><script src="/app.js"></script></body></html>` }],
  ]);
  for (const output of bundle.outputFiles) {
    const path = '/' + relative(outputDirectory, output.path).replaceAll('\\', '/');
    const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'font/woff2';
    assets.set(path, { type, body: Buffer.from(output.contents) });
  }
  const fontNames = ["PublicSans-400", "PublicSans-600", "PublicSans-800", "DMMono-400", "DMMono-500"];
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    context.setDefaultTimeout(10_000);
    const unexpected = [], errors = [], requested = new Set();
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const asset = url.origin === "http://standards-consumer.test" ? assets.get(url.pathname) : null;
      if (!asset) { unexpected.push(url.href); return route.abort("blockedbyclient"); }
      requested.add(url.pathname);
      return route.fulfill({ status: 200, contentType: asset.type, body: asset.body });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("http://standards-consumer.test/", { waitUntil: "load" });
    assert.deepEqual(errors, [], "Consumer load failed before hydration");
    await page.waitForFunction(() => window.consumerReact && document.fonts.status === "loaded");
    await page.evaluate(async () => {
      await Promise.all(['400 16px "Public Sans"', '600 16px "Public Sans"', '800 16px "Public Sans"',
        '400 16px "DM Mono"', '500 16px "DM Mono"'].map((font) => document.fonts.load(font)));
      await document.fonts.ready;
    });
    await page.getByRole("button", { name: "Count 0", exact: true }).click();
    await page.getByRole("button", { name: "Count 1", exact: true }).waitFor();
    assert.match(await page.evaluate(() => window.consumerReact), new RegExp(`^${major}\\.`));
    const expectedFacts = Object.entries({
      "datum.label":"Yield", "datum.value":"24", "datum.unit":"%",
      "matrix.label":"Comparison", "matrix.columns.0":"Planned", "matrix.columns.1":"Actual",
      "matrix.rows.0.label":"Review/build", "matrix.rows.0.values.0":"24", "matrix.rows.0.values.1":"25",
      "statement.label":"Literal text", "statement.statement":"Safe <script>alert(1)</script> & exact",
      "series.label":"Change", "series.zero":"0", "series.periods.0.period":"Before",
      "series.periods.0.display":"−2", "series.periods.1.period":"After", "series.periods.1.display":"+3", "series.current":"Current",
      "schedule.label":"Scope", "schedule.columns.ref":"REF", "schedule.columns.description":"DESCRIPTION",
      "schedule.columns.duration":"DURATION", "schedule.columns.amount":"AMOUNT", "schedule.lines.0.ref":"A",
      "schedule.lines.0.description":"Review", "schedule.lines.0.duration":"1 day", "schedule.lines.0.amount":"£0",
      "schedule.total.label":"Total", "schedule.total.duration":"1 day", "schedule.total.amount":"£0",
      "position.document":"Report", "position.folio":"1", "position.numbers.0":"1",
      "position.sections.0":"Evidence", "position.numbers.1":"2", "position.sections.1":"Decision",
    });
    assert.equal(await page.locator('[data-std-fact="statement.statement"]').textContent(), 'Safe <script>alert(1)</script> & exact');
    for (const width of [320, 390, 640, 1280]) {
      await page.setViewportSize({ width, height: 960 });
      assert.equal(await page.getByRole("table", { name: "Comparison", exact: true }).count(), 1);
      assert.equal(await page.getByRole("table", { name: "Scope", exact: true }).count(), 1);
      assert.equal(await page.getByRole("columnheader", { name: "Planned", exact: true }).count(), 1);
      assert.equal(await page.getByRole("rowheader", { name: "Review/build", exact: true }).count(), 1);
      assert.equal(await page.getByRole("navigation", { name: "Report", exact: true }).count(), 1);
      assert.equal(await page.getByRole("list", { name: "Change", exact: true }).count(), 1);
      const result = await page.evaluate(() => {
        const host = getComputedStyle(document.getElementById("host-sibling"));
        const root = getComputedStyle(document.querySelector('[data-standards-pack="instrument"]'));
        return { width: innerWidth, scroll: document.documentElement.scrollWidth,
          hostInk: host.getPropertyValue("--ink"), hostColour: host.color, hostBackground: host.backgroundColor,
          packColour: root.color, fonts: [...document.fonts].map((font) => font.status),
          facts: [...document.querySelectorAll("[data-std-fact]")].map((n) => [n.dataset.stdFact,n.textContent]),
          hiddenFacts: [...document.querySelectorAll("[data-std-fact]")].filter((n) => {
            const r=n.getBoundingClientRect(); return r.width<=0 || r.height<=0 || r.left < -1 || r.right>innerWidth+1;
          }).map((n) => n.dataset.stdFact) };
      });
      assert.ok(result.scroll <= width + 1, `React ${major} horizontal overflow at ${width}: ${result.scroll}; out-of-frame facts: ${result.hiddenFacts.join(', ')}`);
      assert.deepEqual(result.hiddenFacts, [], `React ${major} out-of-frame facts at ${width}`);
      assert.deepEqual(result.facts, expectedFacts);
      assert.equal(result.hostInk, "");
      assert.equal(result.hostColour, "rgb(1, 2, 3)");
      assert.equal(result.hostBackground, "rgb(4, 5, 6)");
      assert.equal(result.packColour, "rgb(17, 17, 17)");
      assert.deepEqual(result.fonts, Array(5).fill("loaded"));
    }
    assert.deepEqual(await page.evaluate(() => window.hydrationFailures), []);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    for (const name of fontNames) assert.ok([...requested].some((path) => path.startsWith(`/fonts/${name}-`) && path.endsWith('.woff2')), `Bundled font was not served: ${name}`);
    await context.close();
  } finally {
    await browser.close();
  }
}

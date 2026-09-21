import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Matrix, RunningIndex, Series } from "@standards/instrument";

test("each Matrix connects its table to its own visible label, even with repeated fact prefixes", () => {
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null,
    ...["First comparison", "Second comparison"].map((label) => React.createElement(Matrix, {
      key: label, label, columns: ["Actual"], rows: [{ label: "One", values: ["24"] }], factPrefix: "matrix",
    }))));
  const ids = [...markup.matchAll(/<table aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
  for (const id of ids) assert.ok(markup.includes(`id="${id}" data-std-fact="matrix.label"`));
  assert.match(markup, /First comparison/);
  assert.match(markup, /Second comparison/);
});

test("Matrix has an accessible table label without opt-in fact markers", () => {
  const markup = renderToStaticMarkup(React.createElement(Matrix, {
    label: "Plain comparison", columns: [], rows: [],
  }));
  const match = markup.match(/<table aria-labelledby="([^"]+)"/);
  assert.ok(match);
  assert.ok(markup.includes(`id="${match[1]}"`));
  assert.doesNotMatch(markup, /data-std-fact/);
});

for (const factPrefix of [undefined, "repeated-prefix"]) {
  test(`repeated Series keep their own accessible name (${factPrefix ?? "no fact markers"})`, () => {
    const markup = renderToStaticMarkup(React.createElement(React.Fragment, null,
      ...["First series", "Second series"].map(label => React.createElement(Series, {
        key: label, label, periods: [{period:"P1",value:24,display:"24"}], factPrefix,
      }))));
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, "Repeated fact prefixes must not duplicate DOM IDs");
    const names = [...markup.matchAll(/<ol\b[^>]*aria-labelledby="([^"]+)"/g)].map(match => match[1]);
    assert.equal(names.length, 2);
    for (const [index, label] of ["First series", "Second series"].entries())
      assert.match(markup, new RegExp(`id="${names[index]}"[^>]*>${label}</`));
  });

  test(`repeated RunningIndex names identify their visible document (${factPrefix ?? "no fact markers"})`, () => {
    const markup = renderToStaticMarkup(React.createElement(React.Fragment, null,
      ...["First handbook", "Second handbook"].map(document => React.createElement(RunningIndex, {
        key: document, document, folio:"1 / 2", sections:["Evidence"], current:1, factPrefix,
      }))));
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, "Repeated fact prefixes must not duplicate DOM IDs");
    const names = [...markup.matchAll(/<nav\b[^>]*aria-labelledby="([^"]+)"/g)].map(match => match[1]);
    assert.equal(names.length, 2);
    for (const [index, document] of ["First handbook", "Second handbook"].entries())
      assert.match(markup, new RegExp(`id="${names[index]}"[^>]*>${document}</`));
  });
}

test("RunningIndex retains a useful fallback name for an empty document label", () => {
  const markup = renderToStaticMarkup(React.createElement(RunningIndex, {
    document: "   ", folio: "1", sections: [],
  }));
  assert.match(markup, /aria-label="Document position"/);
});

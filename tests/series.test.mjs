import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { Series } from "@standards/instrument";

// Render the packed public component through React, then inspect its DOM/styles.
// Never call a function component outside React's render lifecycle: it may use
// hooks. These tests inspect declared geometry; responsive layout has separate tests.
let browser, page;
before(async () => {
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  page = await browser.newPage();
  await page.route("**/*", route => route.abort("blockedbyclient"));
});
after(async () => { if (browser) await browser.close(); });

function text(node) {
  return node?.text ?? "";
}

async function chart(values, props = {}) {
  const markup = renderToStaticMarkup(createElement(Series, {
    label: "Operating balance",
    periods: values.map((value, i) => ({ period: `P${i + 1}`, value, display: String(value) })),
    ...props,
  }));
  await page.setContent(markup);
  const { output, nodes } = await page.evaluate(() => {
    const describe = element => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const content = [];
      while (walker.nextNode()) if (walker.currentNode.textContent.trim()) content.push(walker.currentNode.textContent.trim());
      // Preserve declared shorthand keys; CSSStyleDeclaration iteration expands
      // border/background shorthands into longhands in Chromium.
      const declared = (element.getAttribute("style") ?? "").split(";").filter(value => value.includes(":"))
        .map(value => value.slice(0, value.indexOf(":")).trim());
      const style = Object.fromEntries(declared.map(name => {
        const value = element.style.getPropertyValue(name);
        const key = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return [key, /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?px$/i.test(value) ? Number.parseFloat(value) : value];
      }));
      return { type: element.localName, text: content.join(" "),
        props: { ...Object.fromEntries([...element.attributes].map(attr => [attr.name, attr.value])), style } };
    };
    return { output: describe(document.body), nodes: [...document.body.querySelectorAll("*")].map(describe) };
  });
  return {
    output, nodes,
    plot: nodes.find((n) => "data-series-plot" in n.props),
    zero: nodes.find((n) => "data-series-zero" in n.props),
    bars: nodes.filter((n) => "data-series-bar" in n.props),
    current: nodes.filter((n) => "data-series-current" in n.props),
    items: nodes.filter((n) => n.type === "li"),
  };
}

function assertSafeGeometry(result) {
  const dimensions = ["height", "width", "top", "bottom", "left", "right", "minWidth"];
  for (const node of result.nodes) {
    for (const [name, value] of Object.entries(node.props.style ?? {})) {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `${name}: ${value}`);
      if (dimensions.includes(name) && typeof value === "number") {
        assert.ok(value >= 0, `${name} must not be negative: ${value}`);
      }
      if (typeof value === "string") assert.doesNotMatch(value, /NaN|Infinity/);
    }
  }
  if (result.plot) {
    const height = result.plot.props.style.height;
    assert.ok(result.zero.props.style.top >= 0 && result.zero.props.style.top <= height);
    for (const bar of result.bars) {
      assert.ok(bar.props.style.top + bar.props.style.height <= height + 1e-9);
    }
  }
}

test("mixed signs share a visible zero baseline and retain signed readable values", async () => {
  const result = await chart([-4, 0, 4]);
  assert.equal(result.plot.props.style.height, 152);
  assert.equal(result.zero.props.style.top, 76);
  assert.equal(result.zero.props.style.borderTop, "1px solid var(--ink)");
  assert.deepEqual(result.bars.map((b) => [b.props.style.top, b.props.style.height]), [
    [76, 76], [76, 0], [0, 76],
  ]);
  assert.match(text(result.items[0]), /P1 -4/);
  assert.match(text(result.items[1]), /P2 0/);
  assert.match(text(result.items[2]), /P3 4/);
  assertSafeGeometry(result);
});

test("unequal positive and negative extents use one scale", async () => {
  const result = await chart([-6, 3], { height: 228 });
  assert.equal(result.zero.props.style.top, 60);
  assert.deepEqual(result.bars.map((b) => [b.props.style.top, b.props.style.height]), [
    [60, 120], [0, 60],
  ]);
  assertSafeGeometry(result);
});

test("positive-only and negative-only series grow on the correct side of zero", async () => {
  const positive = await chart([1, 2]);
  assert.equal(positive.zero.props.style.top, 152);
  assert.deepEqual(positive.bars.map((b) => [b.props.style.top, b.props.style.height]), [
    [76, 76], [0, 152],
  ]);
  const negative = await chart([-1, -2]);
  assert.equal(negative.zero.props.style.top, 0);
  assert.deepEqual(negative.bars.map((b) => [b.props.style.top, b.props.style.height]), [
    [0, 76], [0, 152],
  ]);
  assertSafeGeometry(positive);
  assertSafeGeometry(negative);
});

test("all-zero and empty series are explicit and stable", async () => {
  const zeros = await chart([0, -0, 0]);
  assert.equal(zeros.zero.props.style.top, 76);
  assert.equal(zeros.bars.length, 3);
  assert.ok(zeros.bars.every((b) => b.props.style.height === 0));
  assertSafeGeometry(zeros);
  const empty = await chart([]);
  assert.equal(empty.plot, undefined);
  assert.equal(empty.bars.length, 0);
  assert.equal(empty.current.length, 0);
  assert.match(text(empty.output), /No data available\./);
  assertSafeGeometry(empty);
});

test("non-finite observations are unavailable, not zero or custom-display measurements", async () => {
  const result = await chart([], {
    periods: [
      { period: "NaN input", value: NaN, display: "Invented measurement" },
      { period: "Infinite input", value: Infinity, display: "Infinity" },
      { period: "Negative infinite input", value: -Infinity, display: "-Infinity" },
      { period: "Measured", value: 3, display: "3 kg" },
    ],
  });
  assert.equal(result.bars.length, 1);
  assert.equal(result.bars[0].props["data-period"], "Measured");
  assert.equal(result.bars[0].props.style.height, 152);
  assert.equal(result.items.length, 4);
  for (const item of result.items.slice(0, 3)) assert.match(text(item), /Unavailable/);
  assert.doesNotMatch(text(result.output), /Invented measurement/);
  assert.match(text(result.items[3]), /3 kg/);
  assertSafeGeometry(result);
  const missing = await chart([NaN, Infinity, -Infinity]);
  assert.equal(missing.zero.props.style.top, 76);
  assert.equal(missing.bars.length, 0);
  assertSafeGeometry(missing);
});

test("finite numeric extremes cannot overflow or divide the scale into NaN", async () => {
  const extremes = await chart([-Number.MAX_VALUE, Number.MAX_VALUE]);
  assert.equal(extremes.zero.props.style.top, 76);
  assert.deepEqual(extremes.bars.map((b) => b.props.style.height), [76, 76]);
  assertSafeGeometry(extremes);
  const subnormal = await chart([-Number.MIN_VALUE, Number.MIN_VALUE]);
  assert.deepEqual(subnormal.bars.map((b) => b.props.style.height), [76, 76]);
  assertSafeGeometry(subnormal);
  assertSafeGeometry(await chart([-Number.MAX_VALUE, Number.MIN_VALUE, Number.MAX_VALUE]));
});

test("invalid height values use a safe default and finite heights are bounded", async () => {
  for (const height of [NaN, Infinity, -Infinity, -200, 0, null, "200", undefined]) {
    const result = await chart([-4, 4], { height });
    assert.equal(result.plot.props.style.height, 152, `height ${String(height)}`);
    assertSafeGeometry(result);
  }
  for (const height of [Number.MIN_VALUE, 1, 48, 95.5, 96]) {
    const result = await chart([-4, 4], { height });
    assert.equal(result.plot.props.style.height, 48);
    assertSafeGeometry(result);
  }
  for (const height of [4096, 4097, Number.MAX_VALUE]) {
    const result = await chart([-4, 4], { height });
    assert.equal(result.plot.props.style.height, 4048);
    assertSafeGeometry(result);
  }
});

test("current-period emphasis has a text cue and only one signal accent; bars stay ink", async () => {
  for (const values of [[1, 2], [-1, -2], [0, 0], [1, NaN]]) {
    const result = await chart(values);
    assert.ok(result.bars.every((b) => b.props.style.background === "var(--ink)"));
    assert.equal(result.current.length, 1);
    assert.equal(text(result.current[0]), "Current");
    assert.match(text(result.items.at(-1)), /Current/);
    assert.doesNotMatch(text(result.items[0]), /Current/);
    const accents = result.nodes.filter((n) => Object.values(n.props.style ?? {}).some(
      (v) => typeof v === "string" && v.includes("var(--signal)"),
    ));
    assert.deepEqual(accents, result.current);
    assert.equal(result.current[0].props.style.color, "var(--ink)");
    assert.equal(result.current[0].props.style.borderLeft, "4px solid var(--signal)");
  }
  const plain = await chart([1, 2], { emphasiseLast: false });
  assert.equal(plain.current.length, 0);
  assert.doesNotMatch(JSON.stringify(plain.nodes.map((n) => n.props.style)), /var\(--signal\)/);
});

test("period/value text, custom displays, supporting figures and note survive the change", async () => {
  const result = await chart([], {
    periods: [{ period: "January", value: -24, display: "−£24,000" }],
    summary: [{ term: "Cumulative", value: "£10,000" }],
    note: "Synthetic fixture; no causal attribution.",
  });
  const list = result.nodes.find((n) => n.type === "ol");
  const label = result.nodes.find(n => n.props.id === list.props["aria-labelledby"]);
  assert.equal(text(label), "Operating balance");
  assert.equal(result.plot.props["aria-hidden"], undefined);
  assert.equal(result.zero.props["aria-hidden"], "true");
  assert.match(text(result.items[0]), /January −£24,000 Current/);
  assert.match(text(result.output), /Cumulative £10,000/);
  assert.match(text(result.output), /Synthetic fixture; no causal attribution\./);
});

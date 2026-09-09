import test from "node:test";
import assert from "node:assert/strict";
import { isValidElement } from "react";
import { Plate } from "@standards/instrument";

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  return [node, ...elements(node.props.children)];
}

function text(node) {
  if (Array.isArray(node)) return node.map(text).filter(Boolean).join(" ");
  if (isValidElement(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}

function plate(rows) {
  const output = Plate({
    number: "Plate 3", title: "Synthetic comparison", rows,
    caption: "Fixed comparison data.", reference: "Reference A",
  });
  const nodes = elements(output);
  return {
    output, nodes,
    bars: nodes.filter((n) => "data-plate-bar" in n.props),
    selected: nodes.filter((n) => "data-plate-selected" in n.props),
    unavailable: nodes.filter((n) => "data-plate-scale-unavailable" in n.props),
    accents: nodes.filter((n) => Object.values(n.props.style ?? {}).some(
      (value) => typeof value === "string" && value.includes("var(--signal)"),
    )),
  };
}

test("selected data retains neutral fills and a visible non-colour cue with one red rule", () => {
  const result = plate([
    { label: "Earlier", value: "24 kg", pct: 24 },
    { label: "Selected batch", value: "68 kg", pct: 68, emphasis: true },
  ]);
  assert.deepEqual(result.bars.map((bar) => bar.props.style.background), ["var(--ink)", "var(--ink)"]);
  assert.deepEqual(result.bars.map((bar) => bar.props.style.width), ["24%", "68%"]);
  assert.equal(result.selected.length, 1);
  assert.equal(text(result.selected[0]), "Selected");
  assert.equal(result.selected[0].props["aria-hidden"], undefined);
  assert.equal(result.selected[0].props.style.color, "var(--ink)");
  assert.equal(result.selected[0].props.style.borderLeft, "4px solid var(--signal)");
  assert.deepEqual(result.accents, result.selected);
  assert.ok(result.nodes.every((node) => node.props.style?.color !== "var(--signal)"));
  assert.match(text(result.output), /Plate 3 Synthetic comparison/);
  assert.match(text(result.output), /Earlier 24 kg/);
  assert.match(text(result.output), /Selected batch Selected 68 kg/);
  assert.match(text(result.output), /Fixed comparison data\. Reference A/);
});

test("multiple emphasis requests select only the first without changing any measurements", () => {
  const result = plate([
    { label: "First requested", value: "12", pct: 12, emphasis: true },
    { label: "Second requested", value: "30", pct: 30, emphasis: true },
    { label: "Plain", value: "50", pct: 50 },
  ]);
  assert.equal(result.selected.length, 1);
  assert.equal(result.accents.length, 1);
  assert.match(text(result.output), /First requested Selected 12/);
  assert.match(text(result.output), /Second requested 30/);
  assert.doesNotMatch(text(result.output), /Second requested Selected/);
  assert.deepEqual(result.bars.map((bar) => bar.props.style.width), ["12%", "30%", "50%"]);
  assert.ok(result.bars.every((bar) => bar.props.style.background === "var(--ink)"));
});

test("unselected and empty plates carry no signal accent", () => {
  for (const rows of [[], [{ label: "Only", value: "0", pct: 0, emphasis: false }]]) {
    const result = plate(rows);
    assert.equal(result.selected.length, 0);
    assert.equal(result.accents.length, 0);
    assert.match(text(result.output), /Plate 3 Synthetic comparison/);
    assert.match(text(result.output), /Fixed comparison data\. Reference A/);
  }
});

test("invalid percentages preserve displayed values and expose a neutral scale-unavailable cue", () => {
  for (const pct of [-1, -Number.MIN_VALUE, 100.01, 101, NaN, Infinity, -Infinity]) {
    const result = plate([{ label: "Reported", value: "42 kg as supplied", pct }]);
    assert.equal(result.bars.length, 0, `Invalid scale ${String(pct)} must not become a clamped bar`);
    assert.equal(result.unavailable.length, 1);
    assert.equal(text(result.unavailable[0]), "Scale unavailable");
    assert.equal(result.unavailable[0].props["aria-hidden"], undefined);
    assert.equal(result.unavailable[0].props.style.color, "var(--muted)");
    assert.equal(result.accents.length, 0);
    assert.match(text(result.output), /Reported Scale unavailable 42 kg as supplied/);
    for (const node of result.nodes) {
      for (const [name, value] of Object.entries(node.props.style ?? {})) {
        if (typeof value === "number") {
          assert.ok(Number.isFinite(value), `${name}: ${value}`);
          assert.ok(value >= 0, `${name} must not be negative`);
        } else if (typeof value === "string") {
          assert.doesNotMatch(value, /NaN|Infinity/);
        }
      }
    }
  }
});

test("finite percentage boundaries and fractions keep their exact scale", () => {
  const result = plate([
    { label: "Zero", value: "None", pct: 0 },
    { label: "Fraction", value: "Half", pct: 0.5 },
    { label: "Complete", value: "All", pct: 100 },
  ]);
  assert.deepEqual(result.bars.map((bar) => bar.props.style.width), ["0%", "0.5%", "100%"]);
  assert.equal(result.unavailable.length, 0);
});

test("an invalid selected scale does not move emphasis to a later row or change its display value", () => {
  const result = plate([
    { label: "First requested", value: "Original result", pct: NaN, emphasis: true },
    { label: "Later requested", value: "Other result", pct: 50, emphasis: true },
  ]);
  assert.equal(result.selected.length, 1);
  assert.equal(result.accents.length, 1);
  assert.equal(result.unavailable.length, 1);
  assert.match(text(result.output), /First requested Selected Scale unavailable Original result/);
  assert.match(text(result.output), /Later requested Other result/);
  assert.deepEqual(result.bars.map((bar) => bar.props.style.width), ["50%"]);
  assert.ok(result.bars.every((bar) => bar.props.style.background === "var(--ink)"));
});

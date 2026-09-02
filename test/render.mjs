// Proves the package renders correctly for a consumer who never imports any
// CSS — the exact failure the token injection exists to prevent.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InstrumentRoot, Sheet, Datum, fig, range, delta } from "../packages/instrument/dist/index.js";

const html = renderToStaticMarkup(
  React.createElement(InstrumentRoot, null,
    React.createElement(Sheet, { title: "Qualification report", meta: "R-118" },
      React.createElement(Datum, {
        label: "Mean tensile strength",
        value: "1,240", unit: "MPa",
        supporting: [{ term: "n", value: "24" }, { term: "range", value: range(1181, 1309) }],
      })
    )
  )
);

const checks = {
  "tokens injected without importing any CSS": html.includes("--ground: #FFFFFF"),
  "root scope applied":                        html.includes('data-standards-pack="instrument"'),
  "both faces loaded":                         html.includes("Public+Sans") && html.includes("DM+Mono"),
  "invariant band present":                    html.includes("var(--ink)"),
  "fig() binds unit with a no-break space":    fig(1240, "MPa") === "1,240 MPa",
  "fig() sets a true minus":                   fig(-1.7) === "−1.7",
  "range() uses an en dash":                   range(1181, 1309) === "1,181–1,309",
  "delta() signs positives":                   delta(9) === "+9",
};
let bad = 0;
for (const [k, v] of Object.entries(checks)) { if (!v) bad++; console.log(`  ${v ? "ok  " : "FAIL"} ${k}`); }
console.log(`\n${Object.keys(checks).length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);

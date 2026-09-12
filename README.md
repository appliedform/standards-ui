# Standards UI

React components for **Standards by Applied Form** — the open half.

Standards design systems are written as rulesets a language model can execute and
compiled to every format people work in. This repository is the React target: the
shared contract every pack implements, and **Instrument**, the free pack.

## What is here

| Package | Contents |
|---|---|
| `@standards/core` | the six-job taxonomy, move metadata, the token-contract type |
| `@standards/instrument` | Instrument's nine archetype moves, its tokens and root |

Instrument is licensed **CC BY 4.0** — see `LICENSE-INSTRUMENT`. The code in this
repository is MIT. The other systems in the catalogue are proprietary and are not
part of this repository.

The [agent workflow renderer](examples/agent-workflow/README.md) turns the public
foundation's first Instrument Schedule plan into static React HTML, captures desktop and
mobile browser evidence, and leaves design judgement explicitly outside its mechanical pass.

## The idea

Every Standards pack indexes its components by the **rhetorical job** they do, not
by how they look:

| Key | Job |
|---|---|
| `E` | Evidence — the proof is the argument |
| `S` | Structure — the shape of the thinking is the value |
| `N` | Narrative — words carry the weight |
| `C` | Change — the story is a movement between states |
| `T` | Transaction — the deal, scope or ask needs stating plainly |
| `W` | Wayfinding — the reader needs to know where they are |

Packs share that spine and nothing else. Two packs answer the same job with
components that have nothing in common — which is the point: they are different
house styles, not one system with themes. Consistency is enforced at the
**contract**; divergence is left to the packs.

## Using Instrument

```tsx
import { InstrumentRoot, Datum, Band } from "@standards/instrument";
import "@standards/instrument/dist/styles/tokens.css";

<InstrumentRoot>
  <Band title="Qualification report" meta="R-118" />
  <Datum
    label="Mean tensile strength · batch R-118"
    value="1,240"
    unit="MPa"
    supporting={[{ term: "n", value: "24" }, { term: "σ", value: "38 MPa" }]}
  />
</InstrumentRoot>
```

`InstrumentRoot` puts the five colours and both faces in scope as custom
properties. Components read them through `var()`, so nothing hard-codes a value
the system could later change — outside the root, the tokens are not in scope.

Every move carries its metadata, so a component can be traced back to the rule
that justifies it:

```ts
Datum.meta
// { job: "E", move: "Datum",
//   when: "One figure reframes the section",
//   why: "Scale in mono reads as a measurement, not a boast" }
```

That metadata is **generated** from the pack's `archetypes.json` — never typed by
hand, so it cannot drift from the contract.

`Series` plots signed values against a visible zero baseline. Bars use ink;
`emphasiseLast` adds neutral **Current** text and one red rule, so emphasis remains explicit without
colour. Non-finite values are shown as **Unavailable** and do not affect the scale.
An empty series shows **No data available**; zero values retain their labels without
inventing bar height. The optional `height` budget defaults to 200px, accepts finite
positive numbers clamped to 96–4096px, and reserves 48px for labels (which may wrap).

`Plate` also keeps every bar in ink. The first row requesting `emphasis` receives
neutral **Selected** text, weight and one red rule; later requests do not add accents.
The plate identifier stays ink, so this cue is the plate's only use of signal red.

## Build and audit

```bash
npm ci
npx playwright install chromium   # pinned browser for rendered workflow checks
npm run build     # declarations with tsc, ESM bundles with esbuild
npm run audit     # conformance
npm run workflow:render -- --plan PLAN.json --out DIRECTORY
npm test          # built-component regression checks (run build first)
npm run check     # generation, freshness, build, audit and regression checks
```

The audit is the interesting part. For each pack it checks that every declared
move is exported with metadata matching `archetypes.json` exactly, that nothing
undeclared is exported, that every colour appears in that pack's `tokens.json`,
that no spacing falls off its scale, and that forbidden ornament is absent.

It earns its keep. On the first pass through Instrument it found 165 spacing
values written by habit rather than by the scale — none of them visible by eye.
That is the argument for writing a design system as rules a machine can check.

See [CONTRIBUTING.md](CONTRIBUTING.md) for component fixes, designer failure reports
and the contract workflow. Report vulnerabilities through [SECURITY.md](SECURITY.md).

---

**Standards by Applied Form.** Instrument is free because it is the argument, not
a sample.

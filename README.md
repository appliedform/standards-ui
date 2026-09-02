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

## Build and audit

```bash
npm install
npm run build     # declarations with tsc, ESM bundles with esbuild
npm run audit     # conformance
```

The audit is the interesting part. For each pack it checks that every declared
move is exported with metadata matching `archetypes.json` exactly, that nothing
undeclared is exported, that every colour appears in that pack's `tokens.json`,
that no spacing falls off its scale, and that forbidden ornament is absent.

It earns its keep. On the first pass through Instrument it found 165 spacing
values written by habit rather than by the scale — none of them visible by eye.
That is the argument for writing a design system as rules a machine can check.

---

**Standards by Applied Form.** Instrument is free because it is the argument, not
a sample.

# @standards/instrument

Instrument is the free reference design system for Standards by Applied Form.
This React package includes its nine moves, root, primitives, token CSS and
machine-readable token and archetype contracts.

```tsx
import { InstrumentRoot, Series } from "@standards/instrument";
import "@standards/instrument/styles/tokens.css";

<InstrumentRoot loadFonts={false}>
  <Series
    label="Operating balance · GBP thousands"
    periods={[
      { period: "January", value: -24 },
      { period: "February", value: -12 },
      { period: "March", value: 0 },
      { period: "April", value: 8 },
    ]}
  />
</InstrumentRoot>;
```

Use React 18 or later. TypeScript consumers also need the matching `@types/react`.
The package is ESM and includes declarations compatible with NodeNext and bundler
resolution. `@standards/core` is an installed dependency.

Load the CSS once and place components inside `InstrumentRoot`. The example leaves
font loading to the host; provide Public Sans and DM Mono locally, or omit
`loadFonts={false}` to let the root request them from Google Fonts. Font binaries
are not included.

## Public imports

| Path | Contents |
|---|---|
| `@standards/instrument` | Components, primitives and prop types |
| `@standards/instrument/styles/tokens.css` | Token custom properties and base rules |
| `@standards/instrument/dist/styles/tokens.css` | Retained alias for existing CSS imports |
| `@standards/instrument/tokens.json` | Versioned token contract |
| `@standards/instrument/archetypes.json` | Job and move contract |
| `@standards/instrument/package.json` | Package metadata |

Read JSON contracts using the host's JSON-module support or resolve their paths
and parse the files. Every move also carries `.meta` with its job, name, trigger
and purpose. Other internal build paths are not public imports.

`Series` places signed values around zero and uses neutral bar fills. Final-period
emphasis includes explicit **Current** text and a single accent. Non-finite values
show **Unavailable**; empty data is explicit. Its finite positive `height` budget
is bounded to 96–4096px; invalid heights use 200px.

## Licensing

Implementation code is MIT licensed (`LICENSE`). Instrument design-system
material, including the contracts and design values, is CC BY 4.0
(`LICENSE-INSTRUMENT`). `NOTICE` explains the boundary and attribution. These are
respective licences for the package's parts, not alternative licences.

Suggested design-system attribution: **Instrument, a Standards pack, from Applied
Form. CC BY 4.0.** Retain the licence link and indicate adaptations as required.

Source: [appliedform/standards-ui](https://github.com/appliedform/standards-ui/tree/main/packages/instrument).

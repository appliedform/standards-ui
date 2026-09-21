# @standards/instrument

Instrument is the free reference design system for Standards by Applied Form.
This React package includes its nine moves, root, primitives, token CSS and
machine-readable token and archetype contracts.

```tsx
import { InstrumentRoot, Series } from "@standards/instrument";
import "@standards/instrument/styles/tokens.css";
import "@standards/instrument/styles/fonts.css";

<InstrumentRoot>
  <Series
    label="Operating balance · GBP thousands"
    periods={[
      { period: "January", value: -24, display: "−24" },
      { period: "February", value: -12, display: "−12" },
      { period: "March", value: 0, display: "0" },
      { period: "April", value: 8, display: "+8" },
    ]}
  />
</InstrumentRoot>;
```

Use React 18 or later. TypeScript consumers also need the matching `@types/react`.
The package is ESM and includes declarations compatible with NodeNext and bundler
resolution. `@standards/core` is an installed dependency.

Current consumer checks cover React/React DOM 18.3.1 and 19.2.8 with matching-major
types, SSR, hydration and bundled CSS/fonts in Chromium. The peer range declares a
minimum version, not verified compatibility with every later release. Hosts must
support CSS imports and local WOFF2 assets when using the optional font stylesheet.

Load the token CSS once and place components inside `InstrumentRoot`. Tokens and
component selectors are scoped to its `data-standards-pack="instrument"` boundary.
The root never loads a network resource. Import the optional font CSS explicitly
to use the bundled Public Sans and DM Mono WOFF2 files, or supply those faces in
the host. Complete SIL Open Font License 1.1 texts ship beside the font files.

`Matrix` associates its table with the visible label using a unique React ID.
`Series` names its values list from the visible label, and `RunningIndex` names its
navigation from the document title, also using unique React IDs. Optional fact
prefixes do not define these IDs; repeating a fact prefix cannot mislabel another
instance. Independently checked workflow fact prefixes still need to be unique.
`BandStatement` wraps otherwise unbreakable tokens without changing their text;
ordinary words use normal wrapping opportunities first.

## Public imports

| Path | Contents |
|---|---|
| `@standards/instrument` | Components, primitives and prop types |
| `@standards/instrument/styles/tokens.css` | Token custom properties and base rules |
| `@standards/instrument/dist/styles/tokens.css` | Retained alias for existing CSS imports |
| `@standards/instrument/styles/fonts.css` | Optional local `@font-face` declarations |
| `@standards/instrument/fonts/*` | Bundled WOFF2 files and OFL 1.1 licence texts |
| `@standards/instrument/tokens.json` | Versioned token contract |
| `@standards/instrument/archetypes.json` | Job and move contract |
| `@standards/instrument/package.json` | Package metadata |

Read JSON contracts using the host's JSON-module support or resolve their paths
and parse the files. Every move also carries `.meta` with its job, name, trigger
and purpose. Other internal build paths are not public imports.

`Series` requires an explicit visible `display` string for every numeric period,
places signed values around zero and uses neutral bar fills. Final-period
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

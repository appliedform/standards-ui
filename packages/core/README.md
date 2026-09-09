# @standards/core

The shared contract for Standards React packs: the six rhetorical jobs, move
metadata, `defineMove`, and TypeScript token-contract types.

```ts
import { JOBS, defineMove } from "@standards/core";
import type { JobKey, MoveMeta, TokenContract } from "@standards/core";

const job: JobKey = "C";
JOBS[job]; // "Change"
```

`defineMove(component, metadata)` attaches a move's `job`, `move`, `when` and `why`
to a React function component. Packs provide the actual components and styling.

This package is ESM and includes TypeScript declarations. Use React 18 or later;
TypeScript consumers also need the matching `@types/react`. The public entry is
`@standards/core`; `@standards/core/package.json` exposes package metadata. Internal
build paths are not public imports. No styles or fonts are included.

MIT licensed; see `LICENSE`. Source:
[appliedform/standards-ui](https://github.com/appliedform/standards-ui/tree/main/packages/core).

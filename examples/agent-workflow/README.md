# Agent workflow renderer

This repository provides the React rendering and browser-observation half of
the first Standards workflow preview. It accepts the immutable Instrument
Schedule plan returned by the public foundation. It does not accept arbitrary
components or execute scripts from supplied HTML.

Build the packages, install the pinned browser and export this host's renderer identity:

```bash
npm run build
npx playwright install chromium
node scripts/workflow-render.mjs --identity > /tmp/standards-renderer-identity.json
```

Pass that identity to the public planner as documented in its `workflow/README.md`.
Then render the resulting host-pinned plan:

```bash
npm run workflow:render -- \
  --plan /tmp/standards-schedule-plan.json \
  --out .workflow-output/schedule
```

The output contains static self-contained HTML, a screenshot for every planned
viewport, and JSON observations bound to the exact plan, artifact, renderer/runtime
identity and screenshot bytes. The HTML embeds the open fonts and exact base64-encoded
licence files, so the render does not make network requests. Evidence covers horizontal
overflow, clipping, occlusion, minimum text contrast, the invariant title band, compact
one- or two-line column headings, visual duration/amount order, unapproved visible text,
table relationships, browser errors and blocked requests.

The renderer launches Chromium with its sandbox enabled, disables artifact JavaScript,
blocks every request and bounds DOM, evidence and screenshot work. Use the public checker
to interpret the observations. A pass establishes the declared mechanical checks and
input consistency; independent design review, broader accessibility testing and remote
execution attestation remain separate evidence.

## Change

What concrete input or situation caused the problem, and what happens after this change?
Link the issue and any upstream contract change. Note public API or package-surface effects.

## Evidence

Describe the synthetic fixture, regression check and any before/after render evidence.
For visual changes, give the viewport, browser and fonts. State accessibility checks
and remaining limits; use “not applicable” with a reason when appropriate.

## Checks

- [ ] `npm run check` passes, or the exact unrun/failed check and reason are recorded.
- [ ] Behaviour changes have a relevant regression fixture; documentation-only changes are identified.
- [ ] Vendored contracts and generated metadata follow the upstream workflow, or are unchanged.
- [ ] Generated `dist` output is not included.
- [ ] Fixtures, screenshots and logs are safe to publish; applicable source licences and attribution are preserved.

# Native Point-route fixture review

Base: `c540412ec2e4d4a68c93c4e59a26343756adaf69`, frozen application source.

The five native Guide-to-Point routes in `interaction-layout.spec.ts` requested the
world origin and asserted literal `A = (0, 0)`. A responsive 225px logical canvas has
a half-pixel center. Firefox's integer client-coordinate delivery, already observed
in the preceding integration trace, cannot deliver that exact requested center.

Independent arithmetic verified the concrete projection: canvas top 227, height 225,
zoom 50 and requested client y=339.5 produce delivered integer y=339 and world y=0.01.
The Node assertion checked each intermediate number and that the world result differs
from zero. No production projection/rounding code or synthetic pointer event was used.

The routes now use the existing independent `nativeWorldPoint`/`pointText` helper,
retain exactly one A, and compare the entire canonical document byte for byte. New
exact canvas-bounds equality before/after the real click preserves sensitivity to
startup reflow. The Guide must be gone both before and after input. Existing outline,
Undo and other layout assertions are unchanged. ADR-0074 records this fixture correction.

Focused validation:

- The copied immutable public artifact's `release.json` identifies application source
  `c540412ec2e4d4a68c93c4e59a26343756adaf69` and `/geomira/` base. No app rebuild or
  production source edit was needed for these fixture-only checks.
- `PATH=/tmp/geomira-bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/tmp/geomira-browsers GEOMIRA_BASE=/geomira/ GEOMIRA_PREVIEW_PORT=4298 pnpm --filter @geomira/web exec playwright test interaction-layout --grep 'choosing Point' --project desktop --workers 1`:
  **5 passed**, 10.1 seconds, Chromium.
- `PATH=/tmp/geomira-bin:$PATH pnpm exec eslint apps/web/e2e/interaction-layout.spec.ts --max-warnings 0`: passed.
- `PATH=/tmp/geomira-bin:$PATH pnpm exec tsc -p tsconfig.tests.json --noEmit`: passed.

Firefox remains unavailable locally as previously diagnosed; actual Firefox and WebKit
confirmation belongs to final integrated CI. No broad test repeat, application change,
snapshot update, tolerance change, push, merge or deployment was performed.

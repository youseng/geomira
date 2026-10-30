# ADR-0053: The engines field asks for Node 22.19

Status: accepted (maintainer request "usability", item 9, 2026-10-30). Closes the request of Run
16c's STATUS (Requests) and the open point of ADR-0044 (Consequences).

## Context

ADR-0044 decision 3 made the slice test (`apps/web/test/host-discovery.test.ts`) count each task
as the shorter of its wall time and its thread's CPU time, read with `process.threadCpuUsage`,
which Node has from 22.19. package.json's engines field still said `>=22.12`, so on Node
22.12–22.18 `pnpm verify` failed with a TypeError in that test while the engines field said the
version was supported. CI and the development container run later versions of Node 22.

## Decision

1. package.json's `engines.node` is `>=22.19`.
2. `scripts/engines.test.ts` checks the field's text and that the Node running the tests satisfies
   it and has `process.threadCpuUsage`. Its first test failed before the change.

## Consequences

- A contributor on an older Node 22 sees pnpm's engines warning instead of an unexplained test
  failure. CI's `node-version: 22` resolves to the latest Node 22, which satisfies it.
- No runtime code changes; the built site has no engines requirement (it runs in browsers).

## Alternatives considered

- **Keeping 22.12 and a fallback in the test** (wall time when `threadCpuUsage` is missing): the
  test would measure differently on different machines, which ADR-0044 removed on purpose.
- **`engine-strict`** (refusing to install on older Node): stricter than the maintainer asked; the
  warning is enough.

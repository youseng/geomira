# Geomira

Web-based dynamic geometry for olympiad geometry. The specification is
[docs/SPEC.md](docs/SPEC.md); progress is in [docs/STATUS.md](docs/STATUS.md); project rules
are in [CLAUDE.md](CLAUDE.md).

```sh
pnpm install
pnpm verify   # typecheck + lint + depcruise + rules + test
pnpm build    # apps/web → apps/web/dist
pnpm e2e      # Playwright against the built app
```

# Audit checklist (manual checks)

Checks that CI cannot run, done by hand in each audit (SPEC §14) and recorded in STATUS.md with
the date, the commit and the result.

## Exports

- [ ] **AoPS (`aops` Asymptote dialect, ADR-0014 decisions 14–15).** olympiad.asy is not
      vendored (no licence), so CI does not compile this dialect. For each example
      (`packages/export/test/__snapshots__/<example>/aops.asy`, or Export → Asymptote → AoPS
      in the app), paste the file into an AoPS post between `[asy]` and `[/asy]`, preview it,
      and check:
  - it renders without an error (in particular `import olympiad;`, the `gm` helpers with
    `struct`, `labelmargin = 0`, `unitsize`, and `foot`, `circumcenter`, `incenter`);
  - the figure matches the standalone PDF of the same example (`asy -f pdf standalone.asy`):
    points, lines, circles, marks, label positions;
  - labels with `\measuredangle` (∡) or `\mathrm` render (AoPS's own preamble).

  Record any failure under "Known bugs" with the example and AoPS's message.

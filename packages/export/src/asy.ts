/**
 * Asymptote export (SPEC §14), two dialects:
 *
 * - `standalone`: plain Asymptote with self-contained helpers (asy-helpers.ts), compiled in
 *   CI (`asy -f pdf`), with `texpreamble` loading amssymb for the labels;
 * - `aops`: for Art of Problem Solving posts, `import olympiad;` and olympiad.asy's `foot`,
 *   `circumcenter` and `incenter` in place of the corresponding helpers. olympiad.asy is not
 *   vendored (its source carries no licence, ADR-0014), so this dialect uses only those
 *   three functions, whose signatures are documented publicly, and is snapshot-tested only;
 *   docs/audit-checklist.md has the manual AoPS check.
 *
 * Layout: header (unit = the screen's size, pens, the drawn region), helpers, the named
 * objects (asy-plan.ts: constructive where mapped, numeric otherwise), the drawing
 * (asy-draw.ts). `toAsymptoteCheck` appends `write()` lines with every variable's numbers at
 * full precision, which the CI coordinate check compares with the kernel (check.ts).
 */
import type { Registry } from '@geomira/kernel/registry';
import { MARGIN_PX } from '@geomira/scene/display';
import { worldRect } from '@geomira/scene/viewport';
import { assertNever } from '@geomira/num/assert';
import { asyHelper, helperClosure } from './asy-helpers';
import type { AsyDialect, AsyType } from './asy-map';
import { planAsy, exactNum, type AsyDecl, type AsyPlan } from './asy-plan';
import { AsyDrawer, drawingCode } from './asy-draw';
import type { ExportFrame } from './frame';
import { paintOf, uniqueWarnings, type ExportText } from './paint';
import { measureText, unitBp, warningLines } from './tex-common';

export interface AsyExport extends ExportText {
  readonly plan: AsyPlan;
}

function header(f: ExportFrame, dialect: AsyDialect, d: AsyDrawer): string[] {
  const unit = measureText(unitBp(f));
  const r = worldRect(f.view, MARGIN_PX);
  const paper = paintOf(f.theme.paper, 1, f.theme, 'the paper', d.warnings).hex;
  return [
    `// GEOMIRA export: Asymptote (${dialect}). One unit is ${unit}bp (${measureText(f.view.viewport.zoom)} px on screen).`,
    ...(dialect === 'aops'
      ? [
          '// For AoPS: uses olympiad.asy (foot, circumcenter, incenter); checked by hand, not compiled in CI.',
          'import olympiad;',
        ]
      : ['// Compile with: asy -f pdf <file>.asy', 'texpreamble("\\usepackage{amssymb}");']),
    `unitsize(${unit});`,
    'defaultpen(fontsize(11pt) + roundcap + roundjoin);',
    'labelmargin = 0;',
    `pen gm_paper = rgb("${paper}");`,
    '// The region the screen draws (the view and a margin): lines are cut to it.',
    `pair gm_lo = (${exactNum(r.minX)}, ${exactNum(r.minY)}), gm_hi = (${exactNum(r.maxX)}, ${exactNum(r.maxY)});`,
  ];
}

function declLine(d: AsyDecl): string {
  const note = d.constructive || !d.dependent ? '' : ' // numeric';
  return `${d.type} ${d.ident} = ${d.code};${note}`;
}

function build(f: ExportFrame, registry: Registry, dialect: AsyDialect) {
  const plan = planAsy(f, registry, dialect);
  const d = new AsyDrawer(f, plan);
  const head = header(f, dialect, d);
  const drawing = drawingCode(d);
  const pens = [...d.pens].map(([hex, name]) => `pen ${name} = rgb("${hex}");`);
  const helpers = helperClosure([...plan.decls.flatMap((x) => x.helpers), ...d.helpers]);
  const warnings = uniqueWarnings(d.warnings);
  const lines = [
    ...head.slice(0, 1),
    ...warningLines(warnings, '//'),
    ...head.slice(1),
    ...pens,
    '',
    '// ---- helpers ----',
    ...helpers.map((h) => asyHelper(h)?.code ?? ''),
    '',
    '// ---- the figure ----',
    ...plan.decls.map(declLine),
    '',
    '// ---- drawing, back to front as on the screen ----',
    ...drawing,
  ];
  return { lines, warnings, plan };
}

/** The Asymptote file of the frame in a dialect (module comment). */
export function toAsymptote(f: ExportFrame, registry: Registry, dialect: AsyDialect): AsyExport {
  const b = build(f, registry, dialect);
  return {
    text: [...b.lines, ''].join('\n'),
    warnings: b.warnings,
    drawn: f.display.items.map((i) => i.id),
    plan: b.plan,
  };
}

/** The numbers a variable of type `t` writes for the coordinate check. */
function written(ident: string, t: AsyType): string {
  switch (t) {
    case 'pair':
      return `${ident}.x, ${ident}.y`;
    case 'gmline':
      return `${ident}.p.x, ${ident}.p.y, ${ident}.d.x, ${ident}.d.y, ${ident}.haslo ? 1 : 0, ${ident}.lo, ${ident}.hashi ? 1 : 0, ${ident}.hi`;
    case 'gmcircle':
      return `${ident}.c.x, ${ident}.c.y, ${ident}.r`;
    case 'real':
      return ident;
    case 'transform':
      return `${ident}.x, ${ident}.y, ${ident}.xx, ${ident}.xy, ${ident}.yx, ${ident}.yy`;
    case 'path':
      return '';
    default:
      return assertNever(t, 'asy type');
  }
}

/**
 * The standalone file plus the coordinate check: one `write` line per variable, `<id>`
 * followed by its numbers (`%.17g`); a path writes its vertices.
 */
export function toAsymptoteCheck(f: ExportFrame, registry: Registry): AsyExport {
  const e = toAsymptote(f, registry, 'standalone');
  const check = [
    '// ---- coordinate check (GEOMIRA CI): every variable at full precision ----',
    'void gm_w(string n, real[] xs) { string s = n; for (real x : xs) s += " " + format("%.17g", x); write(s); }',
    'void gm_w(string n, path p) { real[] xs; for (int i = 0; i < length(p); ++i) { xs.push(point(p, i).x); xs.push(point(p, i).y); } gm_w(n, xs); }',
    ...e.plan.decls.map((d) =>
      d.type === 'path'
        ? `gm_w("${String(d.id)}", ${d.ident});`
        : `gm_w("${String(d.id)}", new real[] {${written(d.ident, d.type)}});`,
    ),
  ];
  return { ...e, text: `${e.text}${check.join('\n')}\n` };
}

/**
 * The export formats as the app offers them (the Export dialog of apps/web holds no export
 * logic, note E of Run 9a): a choice of format and its variant gives the file's text (or, for
 * PNG, the raster plan), its name, MIME type and warnings, with the messages to show.
 */
import type { Registry } from '@geomira/kernel/registry';
import { assertNever } from '@geomira/num/assert';
import { toAsymptote } from './asy';
import type { AsyDialect } from './asy-map';
import type { ExportFrame } from './frame';
import { warningText, type ExportText, type ExportWarning } from './paint';
import { pngPlan, type PngPlan } from './png';
import { toSvg } from './svg';
import { toTikz, toTikzStandalone } from './tikz';

export type ExportChoice =
  | { readonly format: 'svg' }
  | { readonly format: 'png'; readonly pixelRatio: number }
  | { readonly format: 'tikz'; readonly standalone: boolean }
  | { readonly format: 'asy'; readonly dialect: AsyDialect };

export type ExportFormat = ExportChoice['format'];

export interface FormatInfo {
  readonly format: ExportFormat;
  readonly label: string;
  readonly mime: string;
}

/** The formats, in the order the dialog lists them. */
export const FORMATS: readonly FormatInfo[] = Object.freeze([
  { format: 'svg', label: 'SVG', mime: 'image/svg+xml' },
  { format: 'png', label: 'PNG', mime: 'image/png' },
  { format: 'tikz', label: 'TikZ', mime: 'text/x-tex' },
  { format: 'asy', label: 'Asymptote', mime: 'text/plain' },
]);

export type ExportOutput =
  | (ExportText & { readonly kind: 'text'; readonly fileName: string; readonly mime: string })
  | {
      readonly kind: 'png';
      readonly plan: PngPlan;
      readonly fileName: string;
      readonly mime: string;
      readonly warnings: readonly ExportWarning[];
      readonly drawn: readonly number[];
    };

/** A file name from the figure's title ("Euler line" → "euler-line"), else "figure". */
export function baseName(title: string | undefined): string {
  const s = (title ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return s === '' ? 'figure' : s.slice(0, 60);
}

/** The export of the frame in the chosen format (module comment). */
export function exportAs(f: ExportFrame, choice: ExportChoice, registry: Registry): ExportOutput {
  const base = baseName(f.doc.meta.title);
  const text = (t: ExportText, ext: string, mime: string): ExportOutput => ({
    ...t,
    kind: 'text',
    fileName: `${base}.${ext}`,
    mime,
  });
  switch (choice.format) {
    case 'svg':
      return text(toSvg(f), 'svg', 'image/svg+xml');
    case 'png': {
      const plan = pngPlan(f, choice.pixelRatio);
      return {
        kind: 'png',
        plan,
        fileName: `${base}.png`,
        mime: 'image/png',
        warnings: [],
        drawn: plan.drawn,
      };
    }
    case 'tikz':
      return choice.standalone
        ? text(toTikzStandalone(f), 'tex', 'text/x-tex')
        : text(toTikz(f), 'tikz.tex', 'text/x-tex');
    case 'asy':
      return text(
        toAsymptote(f, registry, choice.dialect),
        choice.dialect === 'aops' ? 'aops.asy' : 'asy',
        'text/plain',
      );
    default:
      return assertNever(choice, 'export choice');
  }
}

/** The messages the dialog shows for an export's warnings (one sentence each). */
export function warningMessages(out: ExportOutput): string[] {
  return out.warnings.map(warningText);
}

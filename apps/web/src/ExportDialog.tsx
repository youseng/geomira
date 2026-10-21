/**
 * The Export dialog (SPEC §14, note E of Run 9a): format and variant, the file's text to read
 * and copy, a download, and the warnings of the export (characters TeX cannot write, colours
 * that cannot be read). No export logic here: packages/export builds the frame of the
 * canvas's current view and the file (`exportAs`); for PNG it plans the raster, which this
 * page draws with its own canvas renderer before packages/export adds the PNG's metadata.
 */
import { useMemo, useState } from 'react';
import type { EditorState } from '@geomira/editor/state';
import { exportFrame } from '@geomira/export/frame';
import {
  exportAs,
  FORMATS,
  warningMessages,
  type ExportChoice,
  type ExportFormat,
  type ExportOutput,
} from '@geomira/export/formats';
import { PNG_RATIOS, pngWithMetadata, type PngPlan } from '@geomira/export/png';
import type { Registry } from '@geomira/kernel/registry';
import { assertNever } from '@geomira/num/assert';
import { print } from '@geomira/lang/print';
import type { Size } from '@geomira/scene/viewport';
import { CopyButton } from './Dialogs';
import { drawDisplay, LIGHT_THEME, NO_UI } from './render';

export interface ExportDialogProps {
  readonly state: EditorState;
  readonly registry: Registry;
  /** The canvas's size: the export shows the canvas's view. */
  readonly size: Size | null;
  /** The format chosen in the Export menu. */
  readonly initialFormat: ExportFormat;
  readonly onClose: () => void;
  readonly onError: (message: string) => void;
}

interface Variant {
  readonly standalone: boolean;
  readonly aops: boolean;
  readonly ratio: number;
}

function choiceOf(format: ExportFormat, v: Variant): ExportChoice {
  switch (format) {
    case 'svg':
      return { format };
    case 'png':
      return { format, pixelRatio: v.ratio };
    case 'tikz':
      return { format, standalone: v.standalone };
    case 'asy':
      return { format, dialect: v.aops ? 'aops' : 'standalone' };
    default:
      return assertNever(format, 'export format');
  }
}

/** Saves bytes or text as a file through a temporary link. */
function download(data: BlobPart, fileName: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/** Draws the planned raster with the canvas renderer and returns the PNG with its metadata. */
async function pngBytes(plan: PngPlan, text: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('no 2D canvas for the PNG');
  drawDisplay(ctx, plan.display, NO_UI, LIGHT_THEME, plan.pixelRatio);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (blob === null) throw new Error('the browser could not encode the PNG');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return pngWithMetadata(bytes, text, 96 * plan.pixelRatio);
}

function Variants(p: { format: ExportFormat; variant: Variant; setVariant: (v: Variant) => void }) {
  const { format, variant, setVariant } = p;
  const radio = (label: string, checked: boolean, next: Partial<Variant>) => (
    <label key={label}>
      <input
        type="radio"
        name="export-variant"
        checked={checked}
        onChange={() => {
          setVariant({ ...variant, ...next });
        }}
      />{' '}
      {label}
    </label>
  );
  if (format === 'tikz')
    return (
      <div role="radiogroup" aria-label="TikZ form">
        {radio('Snippet', !variant.standalone, { standalone: false })}
        {radio('Standalone document', variant.standalone, { standalone: true })}
      </div>
    );
  if (format === 'asy')
    return (
      <div role="radiogroup" aria-label="Asymptote dialect">
        {radio('Standalone', !variant.aops, { aops: false })}
        {radio('AoPS (olympiad.asy)', variant.aops, { aops: true })}
      </div>
    );
  if (format === 'png')
    return (
      <div role="radiogroup" aria-label="Pixel ratio">
        {PNG_RATIOS.map((r) => radio(`${String(r)}×`, variant.ratio === r, { ratio: r }))}
      </div>
    );
  return null;
}

function Output(p: { out: ExportOutput; text: string; onError: (m: string) => void }) {
  const { out, text } = p;
  const warnings = warningMessages(out);
  return (
    <>
      {warnings.length > 0 && (
        <ul className="export-warnings" aria-label="Export warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {out.kind === 'text' ? (
        <textarea readOnly value={out.text} aria-label="Export content" rows={14} />
      ) : (
        <p aria-label="Export content">
          PNG, {out.plan.width} × {out.plan.height} pixels; the file also holds the figure&apos;s
          text.
        </p>
      )}
      <div>
        {out.kind === 'text' && <CopyButton text={out.text} label="Copy" />}
        <button
          type="button"
          onClick={() => {
            if (out.kind === 'text') download(out.text, out.fileName, out.mime);
            else
              pngBytes(out.plan, text).then(
                (bytes) => {
                  download(new Uint8Array(bytes), out.fileName, out.mime);
                },
                (e: unknown) => {
                  p.onError(e instanceof Error ? e.message : String(e));
                },
              );
          }}
        >
          Download {out.fileName}
        </button>
      </div>
    </>
  );
}

/** The dialog (module comment). */
export function ExportDialog(p: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>(p.initialFormat);
  const [variant, setVariant] = useState<Variant>({ standalone: false, aops: false, ratio: 2 });
  const { state, registry, size } = p;
  const text = useMemo(() => print(state.doc), [state.doc]);
  const result = useMemo(() => {
    if (size === null) return { ok: false as const, problem: 'the canvas has no size yet' };
    const frame = exportFrame(state.doc, state.values.values, {
      view: { viewport: state.viewport, size },
    });
    return frame.ok
      ? { ok: true as const, out: exportAs(frame.frame, choiceOf(format, variant), registry) }
      : frame;
  }, [state, size, format, variant, registry]);
  return (
    <div className="dialog export-dialog" role="dialog" aria-label="Export">
      <h2>Export</h2>
      <div role="radiogroup" aria-label="Format">
        {FORMATS.map((f) => (
          <label key={f.format}>
            <input
              type="radio"
              name="export-format"
              checked={format === f.format}
              onChange={() => {
                setFormat(f.format);
              }}
            />{' '}
            {f.label}
          </label>
        ))}
      </div>
      <Variants format={format} variant={variant} setVariant={setVariant} />
      {format === 'asy' && variant.aops && (
        <p className="muted">
          For Art of Problem Solving posts: uses olympiad.asy, which is not part of Geomira, so this
          form is checked by hand, not compiled automatically.
        </p>
      )}
      {result.ok ? (
        <Output out={result.out} text={text} onError={p.onError} />
      ) : (
        <p role="alert">Cannot export: {result.problem}.</p>
      )}
      <button type="button" onClick={p.onClose}>
        Close
      </button>
    </div>
  );
}

import { memo, useDeferredValue, useMemo, type ReactNode } from 'react';
import { claimRows, type ClaimRow } from '@geomira/editor/panels';
import type { EditorState } from '@geomira/editor/state';
import type { Scene } from '@geomira/scene/types';
import type { FrameTimes } from './bench';
import { Glyph, SrOnly } from './icons';
import { MathText } from './MathText';
import { useSettled } from './settled';
import type { EditorStore, Notice } from './store';

/** The claim's statement without the `claim` keyword (the chip and the card show it as math). */
export function claimStatement(text: string): string {
  return text.replace(/^claim\s+/u, '');
}

function chipTitle(row: ClaimRow): string {
  const b = row.badge;
  return b.value === 'undefined' ? `undefined: ${b.reason}` : `${b.value} in this figure`;
}

/**
 * Live claim chips (bottom left of the canvas, Geomdraw's claim strip): each claim's badge in
 * the current figure, three-valued (SPEC §10.2). They show the settled figure, so a drag frame
 * does not evaluate every claim (note F of Run 9a); a click opens the Claims panel.
 */
export const ClaimChips = memo(function ClaimChips(p: {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly onOpen: () => void;
}) {
  const deferred = useDeferredValue(useSettled(p.state));
  const rows = useMemo(() => claimRows(deferred, p.store.env), [deferred, p.store]);
  if (rows.length === 0) return null;
  return (
    <div className="claim-chips" role="group" aria-label="Live claim badges">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          className={`chip chip-${r.badge.value}`}
          title={chipTitle(r)}
          onClick={p.onOpen}
        >
          <MathText text={claimStatement(r.text)} />
        </button>
      ))}
    </div>
  );
});

/** Zoom and fit, floating at the bottom right of the canvas. */
export function ZoomControls(p: {
  readonly onZoom: (f: number) => void;
  readonly onFit: () => void;
}) {
  return (
    <div className="zoomctl">
      <button
        type="button"
        title="Zoom in"
        onClick={() => {
          p.onZoom(1.25);
        }}
      >
        <Glyph>+</Glyph>
        <SrOnly>Zoom in</SrOnly>
      </button>
      <button
        type="button"
        title="Zoom out"
        onClick={() => {
          p.onZoom(0.8);
        }}
      >
        <Glyph>{'−'}</Glyph>
        <SrOnly>Zoom out</SrOnly>
      </button>
      <button type="button" title="Fit the figure (0)" onClick={p.onFit}>
        <Glyph>{'⤢'}</Glyph>
        <SrOnly>Fit</SrOnly>
      </button>
    </div>
  );
}

/** A refusal, an error or information about the figure, until dismissed or answered. */
export function NoticeLine({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  if (notice === null) return null;
  return (
    <div className={`notice notice-${notice.tone}`} role="status">
      <div className="notice-text">
        {notice.text}
        {(notice.diagnostics ?? []).map((d) => (
          <div key={`${String(d.line)}:${String(d.column)}`}>
            Line {d.line}, column {d.column}: {d.message}. {d.hint}
          </div>
        ))}
      </div>
      <button type="button" className="small-tb tb" onClick={onClose}>
        Dismiss
      </button>
    </div>
  );
}

/** Developer readouts (Settings or ?dev=1): object counts and the frame-time measurement. */
export function DevBox(p: {
  readonly scene: Scene;
  readonly stats: boolean;
  readonly times: FrameTimes | null;
}) {
  const { scene, stats, times } = p;
  if (!stats && times === null) return null;
  return (
    <div className="devbox">
      {stats && (
        <p data-testid="object-counts">
          {scene.primitives.length} drawn · {scene.unavailable.length} undefined
        </p>
      )}
      {times !== null && (
        <output data-testid="frame-times" data-json={JSON.stringify(times)}>
          {times.objects} objects: drag frame median {times.drag.median.toFixed(2)} ms (p95{' '}
          {times.drag.p95.toFixed(2)}); pan frame median {times.pan.median.toFixed(2)} ms
        </output>
      )}
    </div>
  );
}

/** The stage: the canvas and what floats on it. */
export function Stage({ children }: { children: ReactNode }) {
  return <main className="stage">{children}</main>;
}

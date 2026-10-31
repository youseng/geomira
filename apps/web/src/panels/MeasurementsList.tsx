/**
 * The Measurements list (ADR-0048), at the top of the Objects panel: every number of the
 * figure with its name, definition and current value as the figure shows it (the rows come
 * from @geomira/editor/measurements: decimals, ° for angles); an Undefined value is shown as
 * undefined with its reason. A click selects the measurement (or gives it to a tool waiting
 * for a pick); a right-click or a long press opens its style card, as an object row does.
 */
import { useMemo } from 'react';
import { measurementRows, type MeasurementRow } from '@geomira/editor/measurements';
import type { EditorState } from '@geomira/editor/state';
import { assertNever } from '@geomira/num/assert';
import type { Box } from '../card-place';
import { LongPress, timeout } from '../long-press';
import type { EditorStore } from '../store';

export interface MeasurementsListProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly onStyle: (id: number, anchor: Box) => void;
  /** A click on a row's name (the Objects panel's pick: select, or a tool's pick). */
  readonly onPick: (id: number) => void;
}

/** What a row says after its definition: the value, or why there is none; drawn or not. */
export function measurementText(r: MeasurementRow): string {
  const shown = r.shown ? (r.notDrawable === undefined ? ' · shown' : ' · not drawable') : '';
  switch (r.status) {
    case 'ok':
      return `${r.value ?? ''}${shown}`;
    case 'undefined':
      return `undefined: ${r.reason ?? ''}${shown}`;
    case 'inexact':
      return `not representable: ${r.reason ?? ''}${shown}`;
    default:
      return assertNever(r.status, 'measurement status');
  }
}

function Row(p: { row: MeasurementRow } & MeasurementsListProps) {
  const { row, state, onStyle, onPick } = p;
  const selected = state.selection.includes(row.id);
  const press = useMemo(() => new LongPress(timeout), []);
  const style = (el: Element) => {
    onStyle(row.id, el.getBoundingClientRect());
  };
  return (
    <li
      className={`measurement-row status-${row.status}${selected ? ' selected' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault();
        style(e.currentTarget);
      }}
      onPointerDown={(e) => {
        const el = e.currentTarget;
        press.down(e.clientX, e.clientY, e.pointerType !== 'mouse', () => {
          style(el);
        });
      }}
      onPointerMove={(e) => {
        press.move(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        press.stop();
      }}
      onPointerCancel={() => {
        press.stop();
      }}
      onClickCapture={(e) => {
        if (press.takeClick()) e.stopPropagation();
      }}
    >
      <button
        type="button"
        className="object-name"
        aria-label={`Measurement ${row.name}`}
        aria-pressed={selected}
        onClick={() => {
          onPick(row.id);
        }}
      >
        {row.name}
      </button>
      <code className="object-def">{row.definition}</code>
      <span className="object-status measurement-value">{measurementText(row)}</span>
    </li>
  );
}

/** The list; nothing when the figure has no number. */
export function MeasurementsList(p: MeasurementsListProps) {
  const { state, store } = p;
  const rows = useMemo(() => measurementRows(state, store.env), [state, store]);
  if (rows.length === 0) return null;
  return (
    <section className="object-group measurements" aria-label="Measurements">
      <h3>Measurements</h3>
      <ul>
        {rows.map((r) => (
          <Row key={r.id} row={r} {...p} />
        ))}
      </ul>
    </section>
  );
}

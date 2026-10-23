import { useMemo } from 'react';
import { objectsByLayer, type ObjectRow } from '@geomira/editor/panels';
import type { EditorState } from '@geomira/editor/state';
import { assertNever } from '@geomira/num/assert';
import type { EditorStore } from '../store';

export interface ObjectsPanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  /** Ids of the curves the canvas cannot place at its zoom (ADR-0023). */
  readonly undrawable: readonly number[];
}

function statusText(r: ObjectRow): string {
  switch (r.status) {
    case 'ok':
      return r.kind;
    case 'undefined':
      return `undefined: ${r.reason ?? ''}`;
    case 'inexact':
      return `not representable: ${r.reason ?? ''}`;
    default:
      return assertNever(r.status, 'object status');
  }
}

/**
 * A click on an object's name: a tool waiting for a pick takes the object (transforms are
 * picked here: maps are not drawn); otherwise the object is selected. When the tool refuses
 * the object, its reason stays shown after the selection (ADR-0028).
 */
export function pickObject(store: EditorStore, id: number): void {
  const refusal = store.current().tool === 'move' ? null : store.input({ kind: 'object', id });
  if (refusal?.ok === true) return;
  const notice = store.getSnapshot().notice;
  store.apply({ kind: 'select', ids: [id], mode: 'replace' });
  if (refusal !== null && notice !== null && store.getSnapshot().notice !== notice)
    store.setNotice(notice);
}

function Row({ row, store, state, undrawable }: { row: ObjectRow } & ObjectsPanelProps) {
  const selected = state.selection.includes(row.id);
  const pick = () => {
    pickObject(store, row.id);
  };
  return (
    <li className={`object-row status-${row.status}${selected ? ' selected' : ''}`}>
      <button type="button" className="object-name" aria-pressed={selected} onClick={pick}>
        {row.name}
      </button>
      <code className="object-def">{row.definition}</code>
      <span className="object-status">
        {statusText(row)}
        {row.hidden ? ' · hidden' : ''}
        {row.managed ? ' · image' : ''}
        {undrawable.includes(row.id) ? ' · not drawable at this zoom' : ''}
      </span>
    </li>
  );
}

/**
 * Objects by layer (SPEC §15): every object with its definition and its value's kind; an
 * Undefined or Inexact value is listed with its reason (shown as undefined, never as a
 * wrong figure), and a curve the canvas cannot place at its zoom as "not drawable at this
 * zoom" (ADR-0023). A click selects the object, or gives it to a tool that waits for a pick.
 */
export function ObjectsPanel({ store, state, undrawable }: ObjectsPanelProps) {
  const groups = useMemo(() => objectsByLayer(state), [state]);
  return (
    <div className="objects">
      {groups.map((g) => (
        <section key={g.id} className="object-group">
          <h3>
            {g.name}
            {g.derived ? ' (derived)' : ''}
          </h3>
          {g.rows.length === 0 ? (
            <p className="muted">No objects.</p>
          ) : (
            <ul>
              {g.rows.map((r) => (
                <Row key={r.id} row={r} store={store} state={state} undrawable={undrawable} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

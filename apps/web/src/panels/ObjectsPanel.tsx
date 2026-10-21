import { useMemo } from 'react';
import { objectsByLayer, type ObjectRow } from '@geomira/editor/panels';
import type { EditorState } from '@geomira/editor/state';
import { assertNever } from '@geomira/num/assert';
import type { EditorStore } from '../store';

export interface ObjectsPanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
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

function Row({ row, store, state }: { row: ObjectRow } & ObjectsPanelProps) {
  const selected = state.selection.includes(row.id);
  const pick = () => {
    // A tool waiting for a pick takes the object (transforms are picked here: maps are not drawn).
    if (state.tool !== 'move' && store.input({ kind: 'object', id: row.id }).ok) return;
    store.apply({ kind: 'select', ids: [row.id], mode: 'replace' });
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
      </span>
    </li>
  );
}

/**
 * Objects by layer (SPEC §15): every object with its definition and its value's kind; an
 * Undefined or Inexact value is listed with its reason (shown as undefined, never as a
 * wrong figure). A click selects the object, or gives it to a tool that waits for a pick.
 */
export function ObjectsPanel({ store, state }: ObjectsPanelProps) {
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
                <Row key={r.id} row={r} store={store} state={state} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

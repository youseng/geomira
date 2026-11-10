import {
  selectionEdit,
  selectionSummary,
  type SelectionAction,
} from '@geomira/editor/selection-actions';
import type { EditorState } from '@geomira/editor/state';
import type { EditorStore } from './store';

/** An eye, open or struck through: shown or hidden. */
export function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M1.5 8 C3.5 4.5 5.7 3.2 8 3.2 S12.5 4.5 14.5 8 C12.5 11.5 10.3 12.8 8 12.8 S3.5 11.5 1.5 8 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      {!open && <path d="M2.5 13.5 L13.5 2.5" stroke="currentColor" strokeWidth="1.4" />}
    </svg>
  );
}

export interface SelectionBarProps {
  readonly store: EditorStore;
  readonly state: EditorState;
}

type Run = (action: SelectionAction) => void;

function ActionButton(p: { label: string; title: string; action: SelectionAction; run: Run }) {
  return (
    <button
      type="button"
      className="tb small-tb"
      title={p.title}
      onClick={() => {
        p.run(p.action);
      }}
    >
      {p.label}
    </button>
  );
}

/** The plain layers the selection can move to (shown once there is more than one). */
function LayerSelect({ state, run }: { state: EditorState; run: Run }) {
  const layers = state.doc.layers.filter((l) => l.rule === undefined);
  if (layers.length < 2) return null;
  return (
    <select
      aria-label="Move the selection to a layer"
      title="Move the selected objects to a layer"
      value=""
      onChange={(e) => {
        if (e.target.value !== '') run({ kind: 'toLayer', layer: e.target.value });
      }}
    >
      <option value="">Layer…</option>
      {layers.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}

/**
 * The selection bar (ADR-0060): while objects are selected it floats at the top of the canvas
 * and says what is selected and what can be done with ALL of it in one click, each one history
 * entry: hide or show, labels off or on, move to a layer, remove; ✕ clears the selection. The
 * decisions are packages/editor's (selection-actions.ts); a refusal (a locked layer) is the
 * store's notice, as for any edit.
 */
export function SelectionBar({ store, state }: SelectionBarProps) {
  const sum = selectionSummary(state);
  if (sum.count === 0) return null;
  const run: Run = (action) => {
    const r = selectionEdit(store.current(), action);
    if (r.ok) store.apply(r.edit);
  };
  const action = (label: string, title: string, a: SelectionAction) => (
    <ActionButton label={label} title={title} action={a} run={run} />
  );
  return (
    <div className="selbar" role="toolbar" aria-label="Selection">
      <span className="selbar-what" title="Shift+click or Ctrl+click adds or removes an object">
        {sum.text}
      </span>
      {sum.canHide && action('Hide', 'Hide the selected objects', { kind: 'hide' })}
      {sum.canShow && action('Show', 'Show the selected objects', { kind: 'show' })}
      {sum.canHideLabels &&
        action('Label off', 'Hide the labels of the selected objects', { kind: 'hideLabels' })}
      {sum.canShowLabels &&
        action('Label on', 'Show the labels of the selected objects', { kind: 'showLabels' })}
      <LayerSelect state={state} run={run} />
      {action('Delete', 'Remove the selected objects and what is built from them (Delete)', {
        kind: 'remove',
      })}
      <button
        type="button"
        className="tb small-tb"
        aria-label="Clear the selection"
        title="Clear the selection"
        onClick={() => {
          store.apply({ kind: 'select', ids: [], mode: 'replace' });
        }}
      >
        ✕
      </button>
    </div>
  );
}

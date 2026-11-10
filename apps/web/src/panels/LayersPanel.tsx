import { useState } from 'react';
import { layerNameProblem, nextLayerName, selectionEdit } from '@geomira/editor/selection-actions';
import type { EditorState } from '@geomira/editor/state';
import type { Layer } from '@geomira/kernel/document';
import type { EditorStore } from '../store';
import { ViewsPanel } from './ViewsPanel';

export interface LayersPanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  /** Images not drawn because they coincide with their drawn sources (SPEC §13). */
  readonly coincident: number;
}

/** A derived layer's rule in words: "image of main under t". */
function ruleText(state: EditorState, layerId: string): string {
  const l = state.doc.layers.find((x) => x.id === layerId);
  if (l?.rule === undefined) return '';
  const source = state.doc.layers.find((x) => x.id === l.rule?.source)?.name ?? '?';
  const map = state.doc.objects.find((o) => o.id === l.rule?.transform.id)?.name ?? '?';
  return ` · image of ${source} under ${map}`;
}

/** The lock of a layer (ADR-0020): a document edit, so it is in the text and undoable. */
function LockBox({ store, layer, index }: { store: EditorStore; layer: Layer; index: number }) {
  return (
    <label
      className="layer-lock"
      title="Locked: its objects cannot be dragged, edited or removed here (the text still can)"
    >
      <input
        type="checkbox"
        aria-label={`Lock layer ${String(index + 1)}`}
        checked={layer.locked}
        onChange={(e) => {
          store.apply({ kind: 'updateLayer', id: layer.id, patch: { locked: e.target.checked } });
        }}
      />
      <span aria-hidden="true">locked</span>
    </label>
  );
}

/**
 * Layers (SPEC §8.2, §15): visibility and the lock (document edits: they are in the text;
 * a locked layer's objects cannot be dragged, edited or removed through the GUI, ADR-0020),
 * the active layer (where new objects are built), derived layers' rules, removal of a layer,
 * and how many images are not drawn because they coincide with their sources (SPEC §13);
 * and (ADR-0060) a NEW LAYER (it becomes the active one), a layer's new name, and "move the
 * selection here"; then the views (ViewsPanel, v1.1).
 */
export function LayersPanel({ store, state, coincident }: LayersPanelProps) {
  return (
    <>
      <LayerList store={store} state={state} coincident={coincident} />
      <ViewsPanel store={store} state={state} />
    </>
  );
}

/** A layer's name as a field: Enter or leaving it renames the layer, Escape leaves it as it was. */
function RenameField(p: { store: EditorStore; state: EditorState; layer: Layer; index: number }) {
  const { store, state, layer, index } = p;
  const [name, setName] = useState<string | null>(null);
  const typed = name ?? layer.name;
  const problem = typed === layer.name ? undefined : layerNameProblem(state.doc, typed, layer.id);
  const commit = () => {
    if (name !== null && name !== layer.name && problem === undefined)
      store.apply({ kind: 'updateLayer', id: layer.id, patch: { name } });
    setName(null);
  };
  return (
    <>
      <input
        className={`layer-name${problem === undefined ? '' : ' invalid'}`}
        aria-label={`Name of layer ${String(index + 1)}`}
        aria-invalid={problem !== undefined}
        title={problem ?? 'Rename the layer (Enter)'}
        value={typed}
        spellCheck={false}
        onChange={(e) => {
          setName(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setName(null);
        }}
      />
      {problem !== undefined && (
        <span className="layer-problem" role="alert">
          {problem}
        </span>
      )}
    </>
  );
}

/** "New layer": a name (offered: layer1, layer2, …); the new layer becomes the active one. */
function NewLayer({ store, state }: { store: EditorStore; state: EditorState }) {
  const [typed, setTyped] = useState('');
  const offered = nextLayerName(state.doc);
  const name = typed.trim() === '' ? offered : typed.trim();
  const problem = layerNameProblem(state.doc, name);
  return (
    <form
      className="layer-new"
      onSubmit={(e) => {
        e.preventDefault();
        if (problem !== undefined) return;
        const r = store.apply({ kind: 'addLayer', name });
        if (!r.ok || r.layerId === undefined) return;
        store.apply({ kind: 'activeLayer', id: r.layerId });
        setTyped('');
      }}
    >
      <input
        aria-label="New layer name"
        placeholder={offered}
        value={typed}
        spellCheck={false}
        aria-invalid={problem !== undefined}
        onChange={(e) => {
          setTyped(e.target.value);
        }}
      />
      <button type="submit" disabled={problem !== undefined}>
        New layer
      </button>
      {problem !== undefined && (
        <p className="layer-problem" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}

/**
 * A layer row's second line: a derived layer's rule, "move the selection here" (a plain layer,
 * when it would move something) and the layer's removal (never the first layer's). Absent
 * when it would be empty.
 */
function LayerActions(p: { store: EditorStore; state: EditorState; layer: Layer; index: number }) {
  const { store, state, layer: l, index: i } = p;
  const move = selectionEdit(state, { kind: 'toLayer', layer: l.id });
  const rule = ruleText(state, l.id);
  const moves = move.ok && l.rule === undefined;
  if (rule === '' && !moves && i === 0) return null;
  return (
    <span className="layer-actions">
      <span className="muted">{rule}</span>
      {moves && (
        <button
          type="button"
          className="small"
          aria-label={`Move the selection to layer ${String(i + 1)}`}
          title={`Move the ${String(move.count)} selected to this layer`}
          onClick={() => {
            store.apply(move.edit);
          }}
        >
          ← selection
        </button>
      )}
      {i > 0 && (
        <button
          type="button"
          className="small"
          aria-label={`Remove layer ${String(i + 1)}`}
          title="Remove the layer (its objects move to main)"
          onClick={() => {
            store.apply({ kind: 'removeLayer', id: l.id });
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

function LayerRow(p: { store: EditorStore; state: EditorState; layer: Layer; index: number }) {
  const { store, state, layer: l, index: i } = p;
  return (
    <div className="layer-row">
      <input
        type="checkbox"
        aria-label={l.name}
        title="Shown"
        checked={l.visible}
        onChange={(e) => {
          store.apply({ kind: 'updateLayer', id: l.id, patch: { visible: e.target.checked } });
        }}
      />
      <RenameField store={store} state={state} layer={l} index={i} />
      <input
        type="radio"
        name="active-layer"
        aria-label={`Build new objects in layer ${String(i + 1)}`}
        title="Build new objects here"
        checked={state.activeLayer === l.id}
        onChange={() => {
          store.apply({ kind: 'activeLayer', id: l.id });
        }}
      />
      <LockBox store={store} layer={l} index={i} />
      <LayerActions store={store} state={state} layer={l} index={i} />
    </div>
  );
}

function LayerList({ store, state, coincident }: LayersPanelProps) {
  return (
    <fieldset className="layers">
      <legend>Layers</legend>

      {state.doc.layers.map((l, i) => (
        <LayerRow key={l.id} store={store} state={state} layer={l} index={i} />
      ))}
      <NewLayer store={store} state={state} />
      <p className="muted layer-note">
        New objects are built in the layer with the dot. {coincident} coincident images hidden (an
        image on its drawn source is not drawn)
      </p>
    </fieldset>
  );
}

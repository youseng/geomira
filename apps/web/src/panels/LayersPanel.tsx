import type { EditorState } from '@geomira/editor/state';
import type { Layer } from '@geomira/kernel/document';
import type { EditorStore } from '../store';

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
 * and how many images are not drawn because they coincide with their sources (SPEC §13).
 */
export function LayersPanel({ store, state, coincident }: LayersPanelProps) {
  return (
    <fieldset className="layers">
      <legend>Layers</legend>

      {state.doc.layers.map((l, i) => (
        <div key={l.id} className="layer-row">
          <label>
            <input
              type="checkbox"
              checked={l.visible}
              onChange={(e) => {
                store.apply({
                  kind: 'updateLayer',
                  id: l.id,
                  patch: { visible: e.target.checked },
                });
              }}
            />
            {l.name}
          </label>
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
          <span className="muted">{ruleText(state, l.id)}</span>
          {i > 0 && (
            <button
              type="button"
              className="small"
              aria-label={`Remove layer ${String(i + 1)}`}
              onClick={() => {
                store.apply({ kind: 'removeLayer', id: l.id });
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <p className="muted layer-note">
        {coincident} coincident images hidden (an image on its drawn source is not drawn)
      </p>
    </fieldset>
  );
}

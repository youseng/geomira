import type { EditorState } from '@geomira/editor/state';
import type { EditorStore } from '../store';

export interface LayersPanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
}

/** A derived layer's rule in words: "image of main under t". */
function ruleText(state: EditorState, layerId: string): string {
  const l = state.doc.layers.find((x) => x.id === layerId);
  if (l?.rule === undefined) return '';
  const source = state.doc.layers.find((x) => x.id === l.rule?.source)?.name ?? '?';
  const map = state.doc.objects.find((o) => o.id === l.rule?.transform.id)?.name ?? '?';
  return ` · image of ${source} under ${map}`;
}

/**
 * Layers (SPEC §8.2, §15): visibility (a document edit: it is in the text), the active layer
 * (where new objects are built), derived layers' rules, and removal of a layer.
 */
export function LayersPanel({ store, state }: LayersPanelProps) {
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
    </fieldset>
  );
}

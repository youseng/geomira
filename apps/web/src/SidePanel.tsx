import type { Registry } from '@geomira/kernel/registry';
import type { FrameTimes } from './bench';
import { setLayerVisible, type Figure } from './figure';

export interface SidePanelProps {
  readonly figure: Figure;
  readonly registry: Registry;
  readonly onFigure: (f: Figure) => void;
  readonly selection: ReadonlySet<number>;
  readonly times: FrameTimes | null;
}

/**
 * Layers (toggles are document edits), what the scene drew and hid, the Undefined objects
 * with their reasons (never drawn as garbage), the selection, and measured frame times.
 */
export function SidePanel({ figure, registry, onFigure, selection, times }: SidePanelProps) {
  const selected = figure.doc.objects.filter((o) => selection.has(o.id)).map((o) => o.name);
  const { scene } = figure;
  return (
    <aside className="side" aria-label="Figure">
      <fieldset>
        <legend>Layers</legend>
        {figure.doc.layers.map((l) => (
          <label key={l.id}>
            <input
              type="checkbox"
              checked={l.visible}
              onChange={(e) => {
                onFigure(setLayerVisible(figure, registry, l.id, e.target.checked));
              }}
            />
            {l.name}
            {l.rule === undefined ? '' : ' (derived)'}
          </label>
        ))}
      </fieldset>
      <p>
        {scene.primitives.length} drawn · {scene.coincident.length} coincident images hidden ·{' '}
        {figure.diagnostics.length} diagnostics
      </p>
      {selected.length > 0 && <p>Selected: {selected.join(', ')}</p>}
      {scene.unavailable.length > 0 && (
        <ul className="unavailable" aria-label="Undefined objects">
          {scene.unavailable.map((u) => (
            <li key={u.id}>
              {u.name}: undefined ({u.reason})
            </li>
          ))}
        </ul>
      )}
      {times !== null && (
        <output data-testid="frame-times" data-json={JSON.stringify(times)}>
          {times.objects} objects: drag frame median {times.drag.median.toFixed(2)} ms (p95{' '}
          {times.drag.p95.toFixed(2)}); pan frame median {times.pan.median.toFixed(2)} ms
        </output>
      )}
    </aside>
  );
}

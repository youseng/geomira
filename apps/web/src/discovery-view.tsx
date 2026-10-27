/**
 * What the canvas shows of discovery (ADR-0035, ADR-0036): the objects of a hovered fact,
 * ringed, and a viewed document (a special position, a branch fix) drawn instead of the figure
 * as a draft, a render override and never a document edit (ADR-0024, ADR-0029). The view
 * closes with its banner's Close, or by itself at the next document edit: the canvas never
 * shows a draft over a figure it was not made from.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Document } from '@geomira/kernel/document';
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import { FloatField } from '@geomira/num/float-field';
import { buildScene } from '@geomira/scene/build';
import type { Scene } from '@geomira/scene/types';
import type { DiscoveryRuns } from './discovery-runs';
import type { EditorStore } from './store';

/** The scene and the rings the canvas draws, given the discovery store. */
export function useDiscoveryCanvas(
  discovery: DiscoveryRuns,
  store: EditorStore,
  scene: Scene,
  doc: Document,
) {
  // The canvas part only: a job's progress reports do not re-render the page.
  const snap = useSyncExternalStore(discovery.subscribe, discovery.getCanvas, discovery.getCanvas);
  const view = snap.view;
  useEffect(() => {
    // Any edit of the figure closes the view (it was made from the figure before the edit).
    discovery.setView(null);
  }, [discovery, doc]);
  const shown = useMemo(() => {
    if (view === null) return scene;
    const c = evalContextFor(view.doc);
    const values = evaluate(view.doc, store.env.registry, FloatField, c.ok ? c.ctx : { scale: 0 });
    return buildScene(view.doc, values.values);
  }, [view, scene, store]);
  return { scene: shown, highlight: view?.objects ?? snap.highlight, view };
}

/** The banner over the canvas while a draft is viewed. */
export function ViewBanner({ discovery }: { discovery: DiscoveryRuns }) {
  const snap = useSyncExternalStore(discovery.subscribe, discovery.getCanvas, discovery.getCanvas);
  if (snap.view === null) return null;
  return (
    <div className="view-banner" role="status">
      Viewing {snap.view.label} (a draft: the figure is unchanged).{' '}
      <button
        type="button"
        onClick={() => {
          discovery.setView(null);
        }}
      >
        Close view
      </button>
    </div>
  );
}

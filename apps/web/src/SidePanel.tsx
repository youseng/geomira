import { memo } from 'react';
import type { EditorState } from '@geomira/editor/state';
import { assertNever } from '@geomira/num/assert';
import type { Scene } from '@geomira/scene/types';
import type { FrameTimes } from './bench';
import { ClaimsPanel } from './panels/ClaimsPanel';
import { HelpPanel } from './panels/HelpPanel';
import { LayersPanel } from './panels/LayersPanel';
import { ObjectsPanel } from './panels/ObjectsPanel';
import { StylePanel } from './panels/StylePanel';
import { TextPanel } from './panels/TextPanel';
import { useSettled } from './settled';
import type { EditorStore } from './store';
import type { TestRuns } from './test-runs';

export const TABS = ['Text', 'Objects', 'Claims', 'Style', 'Help'] as const;
export type Tab = (typeof TABS)[number];

export interface SidePanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly scene: Scene;
  readonly runs: TestRuns;
  readonly times: FrameTimes | null;
  readonly tab: Tab;
  readonly onTab: (t: Tab) => void;
}

function Summary({ scene, state }: { scene: Scene; state: EditorState }) {
  const selected = state.doc.objects
    .filter((o) => state.selection.includes(o.id))
    .map((o) => o.name);
  return (
    <>
      <p>
        {scene.primitives.length} drawn · {scene.coincident.length} coincident images hidden ·{' '}
        {scene.unavailable.length} undefined
      </p>
      {selected.length > 0 && <p>Selected: {selected.join(', ')}</p>}
    </>
  );
}

/** The tab's panel; memoised, so a drag frame (with the settled state unchanged) skips it. */
const Body = memo(function Body({
  tab,
  store,
  state,
  runs,
}: Pick<SidePanelProps, 'tab' | 'store' | 'state' | 'runs'>) {
  switch (tab) {
    case 'Text':
      return <TextPanel store={store} state={state} />;
    case 'Objects':
      return <ObjectsPanel store={store} state={state} />;
    case 'Claims':
      return <ClaimsPanel store={store} state={state} runs={runs} />;
    case 'Style':
      return <StylePanel store={store} state={state} />;
    case 'Help':
      return <HelpPanel />;
    default:
      return assertNever(tab, 'tab');
  }
});

const Layers = memo(LayersPanel);

/**
 * The panels (SPEC §15): the layers and a summary of the scene always on top, then Text,
 * Objects, Claims, Style and Help as tabs. On a phone the panel sits under the canvas. During
 * a drag they show the state from before it and update at drag end (settled.ts, note F).
 */
export function SidePanel(props: SidePanelProps) {
  const { store, scene, runs, times, tab, onTab } = props;
  const state = useSettled(props.state);
  return (
    <aside className="side" aria-label="Figure">
      <Layers store={store} state={state} />
      <Summary scene={scene} state={state} />
      <div className="tabs" role="tablist" aria-label="Panels">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              onTab(t);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="tab-body" role="tabpanel" aria-label={`${tab} panel`}>
        <Body tab={tab} store={store} state={state} runs={runs} />
      </div>
      {times !== null && (
        <output data-testid="frame-times" data-json={JSON.stringify(times)}>
          {times.objects} objects: drag frame median {times.drag.median.toFixed(2)} ms (p95{' '}
          {times.drag.p95.toFixed(2)}); pan frame median {times.pan.median.toFixed(2)} ms
        </output>
      )}
    </aside>
  );
}

import { memo, useRef, type RefObject } from 'react';
import type { EditorState } from '@geomira/editor/state';
import { assertNever } from '@geomira/num/assert';
import type { Scene } from '@geomira/scene/types';
import type { Box } from './card-place';
import { ClaimsPanel } from './panels/ClaimsPanel';
import { HelpPanel } from './panels/HelpPanel';
import { LayersPanel } from './panels/LayersPanel';
import { ObjectsPanel } from './panels/ObjectsPanel';
import { TextPanel, type TextDraft } from './panels/TextPanel';
import { useSettled } from './settled';
import type { EditorStore } from './store';
import type { TestRuns } from './test-runs';

/** The tabs; styles are edited in the style card of each object (ADR-0029), not in a tab. */
export const TABS = ['Text', 'Objects', 'Layers', 'Claims', 'Help'] as const;
export type Tab = (typeof TABS)[number];

export interface SidePanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly scene: Scene;
  /** Ids of the curves not drawable at the current zoom (ADR-0023). */
  readonly undrawable: readonly number[];
  readonly runs: TestRuns;
  readonly tab: Tab;
  /** Shows a tab (on a phone this also opens the drawer). */
  readonly onTab: (t: Tab) => void;
  /** On a phone: whether the drawer is open. */
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onTestClaim: (text: string) => boolean;
  /** Opens an object's style card (a right-click on its row; ADR-0029). Stable. */
  readonly onStyle: (id: number, anchor: Box) => void;
}

type BodyProps = Pick<
  SidePanelProps,
  'tab' | 'store' | 'state' | 'runs' | 'onTestClaim' | 'undrawable' | 'onStyle'
> & {
  readonly coincident: number;
  readonly kept: RefObject<TextDraft | null>;
};

/** The tab's panel; memoised, so a drag frame (with the settled state unchanged) skips it. */
const Body = memo(function Body({
  tab,
  store,
  state,
  runs,
  onTestClaim,
  coincident,
  kept,
  undrawable,
  onStyle,
}: BodyProps) {
  switch (tab) {
    case 'Text':
      return <TextPanel store={store} state={state} kept={kept} />;
    case 'Objects':
      return <ObjectsPanel store={store} state={state} undrawable={undrawable} onStyle={onStyle} />;
    case 'Layers':
      return <LayersPanel store={store} state={state} coincident={coincident} />;
    case 'Claims':
      return <ClaimsPanel store={store} state={state} runs={runs} onTestClaim={onTestClaim} />;
    case 'Help':
      return <HelpPanel />;
    default:
      return assertNever(tab, 'tab');
  }
});

/**
 * The panels (SPEC §15; Geomdraw's right column): Text, Objects, Layers, Claims and Help as
 * tabs (styles: the style card, ADR-0029). On a phone the tab row sits above the tool strip
 * and a tab opens the panel as a drawer over the canvas. During a drag they show the state from before it and update at drag
 * end (settled.ts, note F of Run 9a). The text panel's draft is kept here while another tab is
 * shown (Run 10 audit, W4).
 */
export function SidePanel(props: SidePanelProps) {
  const { store, scene, runs, tab, onTab, open, onClose, onTestClaim, undrawable, onStyle } = props;
  const state = useSettled(props.state);
  const kept = useRef<TextDraft>(null);
  return (
    <aside className={open ? 'side open' : 'side'} aria-label="Figure">
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
        <button type="button" className="drawer-close" title="Hide the panels" onClick={onClose}>
          <span aria-hidden="true">{'✕'}</span>
          <span className="sr-only">Hide panels</span>
        </button>
      </div>
      <div className="tab-body" role="tabpanel" aria-label={`${tab} panel`}>
        <Body
          tab={tab}
          store={store}
          state={state}
          runs={runs}
          onTestClaim={onTestClaim}
          coincident={scene.coincident.length}
          kept={kept}
          undrawable={undrawable}
          onStyle={onStyle}
        />
      </div>
    </aside>
  );
}

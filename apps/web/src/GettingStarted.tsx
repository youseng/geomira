import { useSyncExternalStore, type RefObject } from 'react';
import type { ToolId } from '@geomira/editor/tool-state';
import type { EditorStore } from './store';
import type { Workspace } from './workspace';

interface Props {
  readonly canvasHeight: number;
  readonly workspace: Workspace;
  readonly store: EditorStore;
  readonly choose: (id: ToolId) => void;
  readonly search: RefObject<HTMLInputElement | null>;
  readonly text: () => void;
  readonly exportFigure: () => void;
  readonly fit: () => void;
}
function GuideActions(p: Props & { empty: boolean; dismiss: () => void }) {
  const triangle = () => {
    const draft = p.store.textDraft.getSnapshot();
    if (p.store.current().doc.objects.length === 0 && draft.text === draft.clean) {
      p.store.command('triangle A B C');
      requestAnimationFrame(p.fit);
    }
  };
  const actions: readonly [string, () => void][] = [
    [
      'Create points',
      () => {
        p.choose('point');
      },
    ],
    ['Create a triangle', triangle],
    [
      'Choose a tool',
      () => {
        p.search.current?.focus();
      },
    ],
    [
      'Move a point',
      () => {
        p.choose('move');
      },
    ],
    ['Open text', p.text],
    ['Export figure', p.exportFigure],
  ];
  return (
    <div className="guide-actions">
      {actions.map(([label, action]) => (
        <button
          key={label}
          type="button"
          disabled={label === 'Create a triangle' && !p.empty}
          title={
            label === 'Create a triangle' && !p.empty
              ? 'Keeps the current figure and text draft'
              : undefined
          }
          onClick={() => {
            action();
            p.dismiss();
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function GettingStarted(p: Props) {
  const draft = useSyncExternalStore(
    p.store.textDraft.subscribe,
    p.store.textDraft.getSnapshot,
    p.store.textDraft.getSnapshot,
  );
  const empty = p.store.current().doc.objects.length === 0 && draft.text === draft.clean;
  if (!p.workspace.guide && (p.workspace.prefs.guideDismissed || !empty)) return null;
  const dismiss = () => {
    p.workspace.setGuide(false);
    p.workspace.update({ guideDismissed: true });
  };
  return (
    <section
      className="getting-started"
      role="region"
      aria-label="Getting started"
      style={{ maxHeight: Math.max(48, p.canvasHeight - 16) }}
    >
      <div>
        <strong>Build a figure</strong>
        <button type="button" aria-label="Dismiss getting started" onClick={dismiss}>
          ×
        </button>
      </div>
      <p>
        Choose a tool, then pick its inputs. Drag points with Move. Observations do not establish a
        general theorem.
      </p>
      <GuideActions {...p} empty={empty} dismiss={dismiss} />
      <p className="gesture-help">
        Move: drag empty space to box-select. Right or middle drag pans; touch pans and pinches. Pan
        also drags over objects. Escape cancels picks; 0 fits. Select an object for Properties.
      </p>
    </section>
  );
}

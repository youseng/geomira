import { verdictLine } from '@geomira/claims/verdict-line';
import type { Document } from '@geomira/kernel/document';
import { print } from '@geomira/lang/print';
import { assertNever } from '@geomira/num/assert';
import type { EditorStore } from '../store';
import type { Run } from '../test-runs';

export interface RunLineProps {
  readonly run: Run;
  readonly store: EditorStore;
  /** The current figure violates an assume line, said at that line (note B). */
  readonly explain: boolean;
  readonly label: string;
}

/**
 * Opens a sample figure of a verdict as an edit of the text (undo returns), and fits the view
 * to it: the sample lies anywhere in the plane (ADR-0028).
 */
export function openSample(store: EditorStore, doc: Document): void {
  if (store.apply({ kind: 'replaceText', text: print(doc) }).ok) store.requestFit();
}

/** One test's state: progress, or its verdict line (SPEC §10.5 wording) with its documents. */
export function RunLine({ run, store, explain, label }: RunLineProps) {
  switch (run.status) {
    case 'running':
      return (
        <p className="run running">
          {label}: <progress max={run.n} value={run.done} /> {run.done} of {run.n} figures
        </p>
      );
    case 'cancelled':
      return (
        <p className="run muted">
          {label}: canceled after {run.done} of {run.n} figures
        </p>
      );
    case 'failed':
      return (
        <p className="run tone-error">
          {label}: could not run ({run.message})
        </p>
      );
    case 'done': {
      const v = run.verdict;
      const line = verdictLine(v, { figureExplains: explain });
      return (
        <div className={`run verdict tone-${line.tone}`} data-regime={v.regime}>
          <p className="verdict-line">{line.text}</p>
          <p className="verdict-detail">{line.detail}</p>
          {v.counterexample !== undefined && (
            <button
              type="button"
              onClick={() => {
                if (v.counterexample) openSample(store, v.counterexample);
              }}
            >
              Open counterexample
            </button>
          )}
          {v.example !== undefined && v.kind === 'mixed' && (
            <button
              type="button"
              onClick={() => {
                if (v.example) openSample(store, v.example);
              }}
            >
              Open example
            </button>
          )}
        </div>
      );
    }
    default:
      return assertNever(run, 'run');
  }
}

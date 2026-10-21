import { useDeferredValue, useMemo, useSyncExternalStore } from 'react';
import type { ClaimValue } from '@geomira/claims/eval-claim';
import {
  claimRows,
  hypothesisRows,
  type ClaimRow,
  type HypothesisRow,
} from '@geomira/editor/panels';
import type { EditorState } from '@geomira/editor/state';
import type { EditorStore } from '../store';
import type { ClaimRuns, TestRuns } from '../test-runs';
import { RunLine } from './RunLine';

export interface ClaimsPanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly runs: TestRuns;
}

/** The live badge of a claim in the current figure (three-valued, SPEC §10.2). */
export function Badge({ value }: { value: ClaimValue }) {
  if (value.value === 'undefined')
    return (
      <span className="badge badge-undefined" title={value.reason}>
        undefined: {value.reason}
      </span>
    );
  return (
    <span className={`badge badge-${value.value}`} title={value.rung}>
      {value.value} in this figure
    </span>
  );
}

function Hypothesis({ h }: { h: HypothesisRow }) {
  return (
    <li className={`hypothesis hyp-${h.status}`}>
      <span className="line-no">line {h.line}</span> <code>{h.text}</code>
      {h.message !== null && <p className="hyp-message">{h.message}</p>}
    </li>
  );
}

interface ClaimProps {
  readonly row: ClaimRow;
  readonly state: EditorState;
  readonly store: EditorStore;
  readonly runs: TestRuns;
  readonly r: ClaimRuns | undefined;
  readonly figureExplains: boolean;
}

function Claim({ row, state, store, runs, r, figureExplains }: ClaimProps) {
  const running = r?.local?.status === 'running' || r?.global?.status === 'running';
  const stale = r !== undefined && r.doc !== state.doc;
  return (
    <li className="claim" data-claim={row.id}>
      <div>
        <span className="line-no">line {row.line}</span> <code>{row.text}</code>{' '}
        <Badge value={row.badge} />
      </div>
      <div className="claim-actions">
        <button
          type="button"
          disabled={running}
          onClick={() => {
            runs.start(state.doc, row.id, 'local');
          }}
        >
          Test
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => {
            runs.start(state.doc, row.id, 'global');
          }}
        >
          Test globally
        </button>
        {running && (
          <button
            type="button"
            onClick={() => {
              runs.cancel(row.id);
            }}
          >
            Cancel
          </button>
        )}
      </div>
      {stale && <p className="muted">These results are for an earlier version of the figure.</p>}
      {r?.local !== undefined && (
        <RunLine run={r.local} store={store} explain={figureExplains} label="Local test" />
      )}
      {r?.global !== undefined && (
        <RunLine run={r.global} store={store} explain={figureExplains} label="Global test" />
      )}
    </li>
  );
}

/**
 * Claims (SPEC §15, §10): the assume lines with the current figure's status (note B: a
 * violated hypothesis is said plainly at its line), then each claim with its live badge, its
 * tests (local first; the global test follows by itself when there are assume lines, or on
 * demand) and their verdict lines, and "Open counterexample".
 */
export function ClaimsPanel({ store, state, runs }: ClaimsPanelProps) {
  const deferred = useDeferredValue(state);
  const claims = useMemo(() => claimRows(deferred, store.env), [deferred, store]);
  const hyps = useMemo(() => hypothesisRows(deferred, store.env), [deferred, store]);
  const snapshot = useSyncExternalStore(runs.subscribe, runs.getSnapshot, runs.getSnapshot);
  const explains = hyps.some((h) => h.status !== 'holds');
  if (claims.length === 0 && hyps.length === 0)
    return (
      <p className="muted">
        No claims. Add one with the Claim tool or a line such as “claim collinear(A, B, C)”.
      </p>
    );
  return (
    <div className="claims">
      {hyps.length > 0 && (
        <ul className="hypotheses" aria-label="Hypotheses">
          {hyps.map((h) => (
            <Hypothesis key={h.id} h={h} />
          ))}
        </ul>
      )}
      <ul className="claim-list" aria-label="Claims">
        {claims.map((c) => (
          <Claim
            key={c.id}
            row={c}
            state={state}
            store={store}
            runs={runs}
            r={snapshot.get(c.id)}
            figureExplains={explains}
          />
        ))}
      </ul>
    </div>
  );
}

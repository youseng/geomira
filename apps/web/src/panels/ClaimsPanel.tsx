import { useDeferredValue, useMemo, useSyncExternalStore } from 'react';
import type { ClaimValue } from '@geomira/claims/eval-claim';
import {
  claimRows,
  hypothesisRows,
  type ClaimRow,
  type HypothesisRow,
} from '@geomira/editor/panels';
import type { EditorState } from '@geomira/editor/state';
import { ClaimBox } from '../Header';
import { MathText } from '../MathText';
import { claimStatement } from '../Stage';
import type { EditorStore } from '../store';
import { runsFor, staleRuns, type ClaimRuns, type TestRuns } from '../test-runs';
import { RunLine } from './RunLine';

export interface ClaimsPanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly runs: TestRuns;
  readonly onTestClaim: (text: string) => boolean;
}

/** The pill of a claim in the current figure (three-valued, SPEC §10.2). */
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
    <li className={`card hypothesis hyp-${h.status}`}>
      <div className="card-head">
        <span className="ty">assume</span> <MathText text={h.text.replace(/^assume\s+/u, '')} />{' '}
        <span className="line-no">line {h.line}</span>
      </div>
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

function Actions({ row, state, runs, running }: ClaimProps & { running: boolean }) {
  return (
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
  );
}

/** What the stale note says: every shown result, or only one of them, is of an earlier figure. */
function staleText(stale: { local: boolean; global: boolean }, r: ClaimRuns): string {
  const all = (stale.local || r.local === undefined) && (stale.global || r.global === undefined);
  if (all) return 'These results are for an earlier version of the figure.';
  return `The ${stale.local ? 'local' : 'global'} test result is for an earlier version of the figure.`;
}

function Claim(props: ClaimProps) {
  const { row, state, store, runs, r, figureExplains } = props;
  const running = r?.local?.status === 'running' || r?.global?.status === 'running';
  const each = r === undefined ? { local: false, global: false } : staleRuns(r, state.doc);
  const stale = each.local || each.global;
  return (
    <li className="card claim" data-claim={row.id}>
      <div className="card-head">
        <span className="ty">claim</span> <MathText text={claimStatement(row.text)} />{' '}
        <span className="line-no">line {row.line}</span>
      </div>
      <Badge value={row.badge} />
      <Actions {...props} running={running} />
      {stale && (
        <p className="stale-note">
          {r === undefined ? null : staleText(each, r)}{' '}
          <button
            type="button"
            disabled={running}
            onClick={() => {
              runs.start(state.doc, row.id, 'local');
            }}
          >
            Re-test
          </button>
        </p>
      )}
      <div className="runs">
        {r?.local !== undefined && (
          <div className={each.local ? 'run-box stale' : 'run-box'}>
            <RunLine run={r.local} store={store} explain={figureExplains} label="Local test" />
          </div>
        )}
        {r?.global !== undefined && (
          <div className={each.global ? 'run-box stale' : 'run-box'}>
            <RunLine run={r.global} store={store} explain={figureExplains} label="Global test" />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Claims (SPEC §15, §10; Geomdraw's claim cards): a claim to add and test; the assume lines
 * with the current figure's status (note B: a violated hypothesis is said plainly at its
 * line); then a card per claim: the statement in italic math, its pill for the current figure,
 * Test and Test globally, and the verdict lines (SPEC §10.5 wording) with their monospace
 * detail; results for an earlier figure are greyed and offer Re-test.
 */
export function ClaimsPanel({ store, state, runs, onTestClaim }: ClaimsPanelProps) {
  const deferred = useDeferredValue(state);
  const claims = useMemo(() => claimRows(deferred, store.env), [deferred, store]);
  const hyps = useMemo(() => hypothesisRows(deferred, store.env), [deferred, store]);
  const snapshot = useSyncExternalStore(runs.subscribe, runs.getSnapshot, runs.getSnapshot);
  const explains = hyps.some((h) => h.status !== 'holds');
  return (
    <div className="claims">
      <ClaimBox label="New claim" className="claimbox" onTestClaim={onTestClaim} />
      {claims.length === 0 && hyps.length === 0 && (
        <p className="empty">
          No claims yet. Type one above, use the Claim tool, or a line such as “claim collinear(A,
          B, C)”.
        </p>
      )}
      {hyps.length > 0 && (
        <>
          <h3 className="sec">Hypotheses</h3>
          <ul className="hypotheses" aria-label="Hypotheses">
            {hyps.map((h) => (
              <Hypothesis key={h.id} h={h} />
            ))}
          </ul>
        </>
      )}
      {claims.length > 0 && (
        <>
          <h3 className="sec">Claims in the figure</h3>
          <ul className="claim-list" aria-label="Claims">
            {claims.map((c) => (
              <Claim
                key={c.id}
                row={c}
                state={state}
                store={store}
                runs={runs}
                r={runsFor(snapshot, state.doc, c.id)}
                figureExplains={explains}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

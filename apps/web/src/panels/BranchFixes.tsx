import { useMemo, useSyncExternalStore } from 'react';
import type { BranchFixResult, Fix } from '@geomira/discovery/branch-fix';
import { verdictLine } from '@geomira/claims/verdict-line';
import type { Verdict } from '@geomira/claims/verdict';
import { branchFixEdit } from '@geomira/editor/discovery';
import type { EditorState } from '@geomira/editor/state';
import type { Document } from '@geomira/kernel/document';
import { print } from '@geomira/lang/print';
import { sameFigure, type DiscoveryRuns, type JobRun } from '../discovery-runs';
import { MathText } from '../MathText';
import type { EditorStore } from '../store';

/** Which verdict a branch fix answers: MIXED (local) or ORIENTATION-DEPENDENT (global). */
export function fixRegime(v: Verdict | undefined): 'local' | 'global' | null {
  if (v === undefined) return null;
  if (v.kind === 'mixed') return 'local';
  if (v.kind === 'orientation-dependent') return 'global';
  return null;
}

function names(doc: Document, ids: readonly number[]): string[] {
  return ids.map((id) => doc.objects.find((o) => o.id === id)?.name ?? `#${String(id)}`);
}

/** "Y and K move", or "nothing moves; only the selectors change" (ADR-0036 decision 5). */
export function movesText(doc: Document, fix: Pick<Fix, 'moves'>): string {
  const n = names(doc, fix.moves);
  if (n.length === 0) return 'nothing moves; only the selectors change';
  const list = n.length === 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} and ${n.at(-1) ?? ''}`;
  return `${list} ${n.length === 1 ? 'moves' : 'move'}`;
}

/**
 * Why a fix is not applied (ADR-0036 decision 7): "X would be the same construction as R:
 * use R instead of X" (the editor allows no two objects with one construction).
 */
export function repeatsText(doc: Document, fix: Pick<Fix, 'repeats'>): string {
  return fix.repeats
    .map((r) => {
      const [x, of] = names(doc, [r.object, r.of]);
      return `${x ?? '?'} would be the same construction as ${of ?? '?'}: use ${of ?? '?'} instead of ${x ?? '?'}.`;
    })
    .join(' ');
}

/** The rewritten definitions, as their lines in the fix's text. */
function rewritten(fix: Fix): string[] {
  const lines = print(fix.doc).split('\n');
  return names(
    fix.doc,
    fix.edits.map((e) => e.id),
  ).map((n) => lines.find((l) => l.startsWith(`${n} =`)) ?? n);
}

interface FixProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly discovery: DiscoveryRuns;
  readonly claim: number;
}

function FixCard(props: FixProps & { fix: Fix; index: number; doc: Document; fresh: boolean }) {
  const { store, discovery, fix, index, doc, fresh } = props;
  const lines = useMemo(() => rewritten(fix), [fix]);
  const line = verdictLine(fix.verdict, { figureExplains: false });
  return (
    <li className="card branch-fix" data-fix={index}>
      <p className="fix-moves">{movesText(doc, fix)}</p>
      {fix.repeats.length > 0 && <p className="stale-note">{repeatsText(doc, fix)}</p>}
      <ul className="fix-defs" aria-label="Rewritten definitions">
        {lines.map((l) => (
          <li key={l}>
            <MathText text={l} />
          </li>
        ))}
      </ul>
      <p className={`verdict-line tone-${line.tone}`}>
        {line.text} ({fix.rungs})
      </p>
      <div className="claim-actions">
        <button
          type="button"
          onClick={() => {
            discovery.setView({
              doc: fix.doc,
              label: `branch fix ${String(index + 1)}`,
              objects: fix.moves.length > 0 ? fix.moves : fix.edits.map((e) => e.id),
            });
          }}
        >
          Preview
        </button>
        <button
          type="button"
          disabled={!fresh || fix.repeats.length > 0}
          onClick={() => {
            discovery.setView(null);
            store.apply(branchFixEdit(fix));
          }}
        >
          Apply
        </button>
      </div>
    </li>
  );
}

function FixList(props: FixProps & { run: Extract<JobRun<BranchFixResult>, { status: 'done' }> }) {
  const { run, state } = props;
  const r = run.result;
  const fresh = sameFigure(run.doc, state.doc);
  return (
    <>
      {!fresh && (
        <p className="stale-note">These fixes are for an earlier version of the figure.</p>
      )}
      {r.fixes.length === 0 ? (
        <p className="empty">{r.note ?? 'No branch assignment makes the claim hold.'}</p>
      ) : (
        <ol className="fix-list" aria-label="Branch fixes">
          {r.fixes.map((f, i) => (
            <FixCard key={i} {...props} fix={f} index={i} doc={run.doc} fresh={fresh} />
          ))}
        </ol>
      )}
      <p className="muted">
        checked {r.checked} of {r.total} branch assignments
        {r.fixes.length > 0 && r.note !== undefined ? ` (${r.note})` : ''}; seed {String(r.seed)}
      </p>
    </>
  );
}

/**
 * Branch fixes of a claim whose verdict is MIXED or ORIENTATION-DEPENDENT (ADR-0036): every
 * branch assignment that makes it hold, each with what moves, a preview (a draft, not an edit)
 * and Apply (one edit, undoable).
 */
export function BranchFixes(props: FixProps & { regime: 'local' | 'global' }) {
  const { discovery, claim, regime, state } = props;
  const snap = useSyncExternalStore(
    discovery.subscribe,
    discovery.getSnapshot,
    discovery.getSnapshot,
  );
  const run = snap.fixes.get(claim);
  const running = run?.status === 'running';
  return (
    <div className="branch-fixes">
      <div className="claim-actions">
        <button
          type="button"
          disabled={running}
          onClick={() => {
            discovery.branchFix(state.doc, claim, regime);
          }}
        >
          Find branch fixes
        </button>
        {running && (
          <button
            type="button"
            onClick={() => {
              discovery.cancelFix(claim);
            }}
          >
            Cancel
          </button>
        )}
      </div>
      {run?.status === 'running' && (
        <p className="run running">
          Branch fixes: {run.phase} <progress max={run.total} value={run.done} />
        </p>
      )}
      {run?.status === 'cancelled' && <p className="run muted">Branch fixes: canceled</p>}
      {run?.status === 'failed' && (
        <p className="run tone-error">Branch fixes: could not run ({run.message})</p>
      )}
      {run?.status === 'done' && <FixList {...props} run={run} />}
    </div>
  );
}

import { useMemo, useState, useSyncExternalStore } from 'react';
import type { HuntResult, Position } from '@geomira/discovery/hunt';
import { grouped } from '@geomira/discovery/text';
import { claimArgsOf, type Fact, type FindResult, type FoundFact } from '@geomira/discovery/types';
import { factEdit } from '@geomira/editor/discovery';
import type { EditorState } from '@geomira/editor/state';
import type { Document } from '@geomira/kernel/document';
import { exprEquals } from '@geomira/kernel/expr';
import { print } from '@geomira/lang/print';
import { printClaim } from '@geomira/lang/print-claim';
import { assertNever } from '@geomira/num/assert';
import { sameFigure, type DiscoveryRuns, type JobRun } from '../discovery-runs';
import { MathText } from '../MathText';
import type { EditorStore } from '../store';

export interface DiscoveryProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly discovery: DiscoveryRuns;
}

/** The fact as the claim line would read. */
export function factText(doc: Document, f: Pick<Fact, 'kind' | 'args'>): string {
  return printClaim(doc, f.kind, claimArgsOf(f));
}

/** Whether `doc` already has the fact as a claim. */
function hasClaim(doc: Document, f: Fact): boolean {
  const args = claimArgsOf(f);
  return doc.claims.some(
    (c) =>
      c.kind === f.kind &&
      c.args.length === args.length &&
      c.args.every((a, i) => {
        const b = args[i];
        return b !== undefined && exprEquals(a, b);
      }),
  );
}

/** The progress line of a running job, or its end when cancelled or failed. */
function RunState<R>({ run, label }: { run: JobRun<R>; label: string }) {
  switch (run.status) {
    case 'running':
      return (
        <p className="run running">
          {label}: {run.phase} <progress max={run.total} value={run.done} />
        </p>
      );
    case 'cancelled':
      return <p className="run muted">{label}: canceled</p>;
    case 'failed':
      return (
        <p className="run tone-error">
          {label}: could not run ({run.message})
        </p>
      );
    case 'done':
      return null;
    default:
      return assertNever(run, 'run');
  }
}

function FactCard(props: DiscoveryProps & { fact: FoundFact; fresh: boolean }) {
  const { store, state, discovery, fact, fresh } = props;
  const added = hasClaim(state.doc, fact);
  const ring = () => {
    discovery.highlight(fact.objects);
  };
  const unring = () => {
    discovery.highlight([]);
  };
  return (
    <li
      className="card fact"
      data-fact={fact.key}
      onMouseEnter={ring}
      onMouseLeave={unring}
      onFocus={ring}
      onBlur={unring}
    >
      <div className="card-head">
        <MathText text={factText(state.doc, fact)} />
      </div>
      <p className="verdict-line tone-ok">holds in this configuration ({fact.rungs})</p>
      {fact.tag !== undefined && (
        <p className="lemma" title={fact.tag.hint}>
          {fact.tag.name}: {fact.tag.hint}
        </p>
      )}
      {fact.follows !== undefined && fact.follows.length > 0 && (
        <p className="muted">Follows from a fact above.</p>
      )}
      <button
        type="button"
        disabled={!fresh || added}
        onClick={() => {
          store.apply(factEdit(fact));
        }}
      >
        {added ? 'Added' : 'Add as claim'}
      </button>
    </li>
  );
}

function StaleNote({ onRerun, label }: { onRerun: () => void; label: string }) {
  return (
    <p className="stale-note">
      These results are for an earlier version of the figure.{' '}
      <button type="button" onClick={onRerun}>
        {label}
      </button>
    </p>
  );
}

/** "What is special?" (ADR-0035 decision 16): the facts found, the hidden ones, the caps. */
function FindBlock(props: DiscoveryProps & { run: JobRun<FindResult> | undefined }) {
  const { state, discovery, run } = props;
  const running = run?.status === 'running';
  const start = () => {
    discovery.find(state.doc);
  };
  return (
    <div className="discovery-find">
      <div className="claim-actions">
        <button type="button" disabled={running} onClick={start}>
          What is special?
        </button>
        {running && (
          <button
            type="button"
            onClick={() => {
              discovery.cancelFind();
            }}
          >
            Cancel
          </button>
        )}
      </div>
      {run !== undefined && <RunState run={run} label="Search" />}
      {run?.status === 'done' && <FindResultView {...props} run={run} onRerun={start} />}
    </div>
  );
}

function FindResultView(
  props: DiscoveryProps & {
    run: Extract<JobRun<FindResult>, { status: 'done' }>;
    onRerun: () => void;
  },
) {
  const { state, run, onRerun } = props;
  const r = run.result;
  const fresh = sameFigure(run.doc, state.doc);
  return (
    <>
      {!fresh && <StaleNote onRerun={onRerun} label="Search again" />}
      {r.facts.length === 0 ? (
        <p className="empty">No fact beyond the construction was confirmed.</p>
      ) : (
        <ul className="fact-list" aria-label="Facts">
          {r.facts.map((f) => (
            <FactCard key={f.key} {...props} fact={f} fresh={fresh} />
          ))}
        </ul>
      )}
      <ConstructionFacts doc={run.doc} construction={r.construction} />
      {r.unconfirmed.length > 0 && (
        <p className="muted">
          {grouped(r.unconfirmed.length)} screened facts were not confirmed by the local test and
          are not reported.
        </p>
      )}
      <ul className="caps" aria-label="Caps">
        {r.caps.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="seed muted">seed {String(r.seed)}</p>
    </>
  );
}

/**
 * The hidden construction facts: the count, and the list only once opened (up to 200 math
 * lines would otherwise be rendered with every result, in one task of the page).
 */
function ConstructionFacts({
  doc,
  construction,
}: {
  doc: Document;
  construction: FindResult['construction'];
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="construction-facts"
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
      }}
    >
      <summary>{grouped(construction.count)} construction facts hidden</summary>
      {open && (
        <ul>
          {construction.shown.map((f) => (
            <li key={f.key}>
              <MathText text={factText(doc, f)} />
            </li>
          ))}
        </ul>
      )}
      {open && construction.count > construction.shown.length && (
        <p className="muted">The first {grouped(construction.shown.length)} are shown.</p>
      )}
    </details>
  );
}

/** The moved input's line in the position's text ("A = (1.5, 2)"). */
function movedLine(p: Position): string {
  const name = p.doc.objects.find((o) => o.id === p.object)?.name;
  const line = print(p.doc)
    .split('\n')
    .find((l) => name !== undefined && l.startsWith(`${name} =`));
  return line ?? `${name ?? '?'} moves`;
}

function PositionCard(props: DiscoveryProps & { p: Position; index: number }) {
  const { discovery, p, index } = props;
  const text = useMemo(() => movedLine(p), [p]);
  const label = `special position ${String(index + 1)}`;
  return (
    <li className="card position" data-position={index}>
      <div className="card-head">
        <MathText text={text} />
      </div>
      <ul className="new-facts" aria-label="New facts">
        {p.facts.map((f) => (
          <li key={f.key}>
            <MathText text={factText(p.doc, f)} />
          </li>
        ))}
      </ul>
      <p className="muted">holds there ({p.rung})</p>
      <div className="claim-actions">
        <button
          type="button"
          onClick={() => {
            discovery.setView({ doc: p.doc, label, objects: p.target.objects });
          }}
        >
          View
        </button>
        <button
          type="button"
          onClick={() => {
            openAsNew(props, p.doc);
          }}
        >
          Open as new figure
        </button>
      </div>
    </li>
  );
}

/**
 * Opens `doc` as a new figure through the usual open path: the figure being left stays in
 * "Restore previous figure" (ADR-0035 decision 16).
 */
function openAsNew({ store, discovery }: DiscoveryProps, doc: Document): void {
  discovery.setView(null);
  store.openText(print(doc), 'new');
  store.requestFit();
}

/** "Special positions" (ADR-0035 decision 13): where the free inputs make new facts true. */
function HuntBlock(props: DiscoveryProps & { run: JobRun<HuntResult> | undefined }) {
  const { state, discovery, run } = props;
  const running = run?.status === 'running';
  const start = () => {
    discovery.hunt(state.doc);
  };
  const done = run?.status === 'done' ? run : null;
  const fresh = done !== null && sameFigure(done.doc, state.doc);
  return (
    <div className="discovery-hunt">
      <div className="claim-actions">
        <button type="button" disabled={running} onClick={start}>
          Special positions
        </button>
        {running && (
          <button
            type="button"
            onClick={() => {
              discovery.cancelHunt();
            }}
          >
            Cancel
          </button>
        )}
      </div>
      {run !== undefined && <RunState run={run} label="Search" />}
      {done !== null && (
        <>
          {!fresh && <StaleNote onRerun={start} label="Search again" />}
          {done.result.positions.length === 0 ? (
            <p className="empty">No special position found.</p>
          ) : (
            <ul className="position-list" aria-label="Positions">
              {done.result.positions.map((p, i) => (
                <PositionCard key={p.target.key} {...props} p={p} index={i} />
              ))}
            </ul>
          )}
          <p className="muted">{huntSummary(done.result)}</p>
        </>
      )}
    </div>
  );
}

function huntSummary(r: HuntResult): string {
  const s = r.skipped;
  const parts = [
    `solved for ${grouped(r.targets)} of ${grouped(r.falseCandidates)} near facts`,
    `skipped ${grouped(s.hypotheses)} contradicting the hypotheses`,
    `${grouped(s.degenerate)} degenerate (treated as undefined)`,
    `${grouped(s.repeated)} repeated`,
  ];
  if (r.stopped) parts.push('stopped at the time budget');
  return `${parts.join('; ')}; seed ${String(r.seed)}.`;
}

/** Discovery in the Claims panel (ADR-0035 decision 16). */
export function DiscoverySection(props: DiscoveryProps) {
  const { discovery } = props;
  const snap = useSyncExternalStore(
    discovery.subscribe,
    discovery.getSnapshot,
    discovery.getSnapshot,
  );
  return (
    <section className="discovery" aria-label="Discovery">
      <h3 className="sec">Discovery</h3>
      <FindBlock {...props} run={snap.find} />
      <HuntBlock {...props} run={snap.hunt} />
    </section>
  );
}

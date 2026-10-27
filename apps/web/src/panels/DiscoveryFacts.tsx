/**
 * The facts "What is special?" reports (ADR-0035 decision 16, ADR-0039): a fact's text (a class
 * as one chain "MB = MC = MI"), "Add as claim" (a class's links as one edit), and the hidden
 * facts that follow from it, listed under it.
 */
import { useState } from 'react';
import { grouped } from '@geomira/discovery/text';
import { claimArgsOf, type DeriveRule, type Fact, type FoundFact } from '@geomira/discovery/types';
import { factEdit } from '@geomira/editor/discovery';
import type { EditorState } from '@geomira/editor/state';
import type { Document } from '@geomira/kernel/document';
import { exprEquals } from '@geomira/kernel/expr';
import { printClaim } from '@geomira/lang/print-claim';
import { assertNever } from '@geomira/num/assert';
import type { DiscoveryRuns } from '../discovery-runs';
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

/**
 * A reported fact's text: a class (ADR-0039) as one chain "MB = MC = MI" when its links share
 * their left side, else its links joined; any other fact as its claim line.
 */
export function foundText(doc: Document, f: Pick<FoundFact, 'kind' | 'args' | 'chain'>): string {
  if (f.chain === undefined) return factText(doc, f);
  const texts = f.chain.map((x) => factText(doc, x));
  const sides = texts.map((t) => t.split(' = '));
  const left = sides[0]?.[0];
  return sides.every((p) => p.length === 2 && p[0] === left)
    ? [left, ...sides.map((p) => p[1])].join(' = ')
    : texts.join('; ');
}

/** Whether `doc` already has the fact (every link of a class) as claims. */
function hasFact(doc: Document, f: FoundFact): boolean {
  return (f.chain ?? [f]).every((x) => hasClaim(doc, x));
}

/** Whether `doc` already has the fact as a claim. */
function hasClaim(doc: Document, f: Pick<Fact, 'kind' | 'args'>): boolean {
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

export function FactCard(props: DiscoveryProps & { fact: FoundFact; fresh: boolean }) {
  const { store, state, discovery, fact, fresh } = props;
  const added = hasFact(state.doc, fact);
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
        <MathText text={foundText(state.doc, fact)} />
      </div>
      <p className="verdict-line tone-ok">holds in this configuration ({fact.rungs})</p>
      {fact.tag !== undefined && (
        <p className="lemma" title={fact.tag.hint}>
          {fact.tag.name}: {fact.tag.hint}
        </p>
      )}
      <button
        type="button"
        disabled={!fresh || added}
        onClick={() => {
          store.apply(factEdit(fact));
        }}
      >
        {added ? 'Added' : fact.chain === undefined ? 'Add as claim' : 'Add as claims'}
      </button>
      {fact.consequences !== undefined && (
        <ConsequenceList doc={state.doc} fact={fact} consequences={fact.consequences} />
      )}
    </li>
  );
}

/** How a hidden fact follows, in words. */
function ruleText(r: DeriveRule): string {
  switch (r) {
    case 'incidence':
      return 'incidences and lengths';
    case 'angles':
      return 'angle chasing';
    case 'transport':
      return 'through a map';
    case 'part':
      return 'part of this fact';
    default:
      return assertNever(r, 'rule');
  }
}

/**
 * The hidden facts that follow once this fact is known (ADR-0039: nothing hidden is lost),
 * listed only once opened.
 */
function ConsequenceList({
  doc,
  fact,
  consequences,
}: {
  doc: Document;
  fact: FoundFact;
  consequences: NonNullable<FoundFact['consequences']>;
}) {
  const [open, setOpen] = useState(false);
  const n = consequences.count;
  return (
    <details
      className="consequences"
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
      }}
    >
      <summary>
        {grouped(n)} {n === 1 ? 'consequence' : 'consequences'} of{' '}
        <MathText text={foundText(doc, fact)} />
      </summary>
      {open && (
        <ul>
          {consequences.shown.map((h) => (
            <li key={h.key}>
              <MathText text={factText(doc, h)} />{' '}
              <span className="muted">({ruleText(h.rule)})</span>
            </li>
          ))}
        </ul>
      )}
      {open && n > consequences.shown.length && (
        <p className="muted">The first {grouped(consequences.shown.length)} are shown.</p>
      )}
    </details>
  );
}

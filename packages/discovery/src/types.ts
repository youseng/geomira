/**
 * The discovery jobs' data (ADR-0035, ADR-0036): jobs, their environment, progress, commands
 * and results. Results carry their seed and every cap they hit; facts name the figure's
 * objects by id, so the host prints them with the language (packages/discovery cannot).
 */
import type { EntropySource, Seed } from '@geomira/num/rng';
import type { Document } from '@geomira/kernel/document';
import type { Evaluation } from '@geomira/kernel/evaluate';
import type { Expr, Selector } from '@geomira/kernel/expr';
import { lit, ref } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import type { Vec } from '@geomira/kernel/value';
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import type { ScreenArg } from '@geomira/claims/screen';
import type { Verdict } from '@geomira/claims/verdict';

/**
 * The GUI selector choice the host supplies for branch fixes (ADR-0036): packages/editor's
 * `chooseSelectors`, which discovery cannot import (SPEC §2).
 */
export type Chooser = (
  doc: Document,
  values: Evaluation<number>,
  registry: Registry,
  tool: string,
  argIds: readonly number[],
  click: Vec<number>,
) =>
  | { readonly ok: true; readonly selectors: readonly Selector[] }
  | { readonly ok: false; readonly reason: string };

export interface DiscoveryEnv {
  readonly registry: Registry;
  /** The claim kinds (default: v1's). */
  readonly kinds?: ClaimKinds;
  /** Cryptographic randomness for the mod-p rung of the local and global tests. */
  readonly entropy?: EntropySource;
  /** The GUI selector choice (branch fixes); without it the low-level selectors are written. */
  readonly choose?: Chooser;
}

/** `cancel`: stop and report nothing; `stop`: the host's time budget, report what is confirmed. */
export type DiscoveryCommand = 'cancel' | 'stop' | undefined;

export type DiscoveryJobKind = 'find' | 'hunt' | 'branchFix';

export interface DiscoveryProgress {
  readonly kind: 'progress';
  readonly job: DiscoveryJobKind;
  /** What the job is doing ("screening collinear", "testing 3 of 12", …). */
  readonly phase: string;
  readonly done: number;
  readonly total: number;
}

/** A fact about the figure's objects. */
export interface Fact {
  readonly kind: string;
  readonly args: readonly ScreenArg[];
  /** Its claim key (equal keys: the same claim up to the kind's symmetries). */
  readonly key: string;
  /** The objects it names, in argument order, without repeats. */
  readonly objects: readonly number[];
}

/** A claim's data for a fact: references and exact literals (a host prints it with lang). */
export function claimArgsOf(f: { readonly args: readonly ScreenArg[] }): Expr[] {
  return f.args.map((a) => ('id' in a ? ref(a.id) : lit(a.lit)));
}

/** A well-known named result a fact is an instance of (ADR-0035 decision 14). */
export interface LemmaTag {
  readonly name: string;
  readonly hint: string;
}

/**
 * How a hidden fact follows (ADR-0039): by the closure (incidence, lengths, the maps' facts),
 * by angle chasing, by transport through a map, or as a part of a group shown whole.
 */
export type DeriveRule = 'incidence' | 'angles' | 'transport' | 'part';

/** A fact hidden because it follows; `parents` are the keys of the shown facts it follows from. */
export interface HiddenFact extends Fact {
  readonly rule: DeriveRule;
  /** Shown facts (keys) it follows from with the construction; empty: the construction alone. */
  readonly parents: readonly string[];
}

/** Hidden facts listed under a shown fact: their count, and the first of them (consequences.ts). */
export interface Consequences {
  readonly count: number;
  readonly shown: readonly HiddenFact[];
}

export interface FoundFact extends Fact {
  /** The local test's verdict (HOLDS IN THIS CONFIGURATION). */
  readonly verdict: Verdict;
  /** "exact over Q, 200/200" or "numeric, 200/200" (the rungs the local test used). */
  readonly rungs: string;
  /** Every valid sample was decided by an exact rung. */
  readonly exact: boolean;
  readonly tag?: LemmaTag;
  /** A class (AB = CD = EF): its links from the first member, the claims it stands for. */
  readonly chain?: readonly Fact[];
  /** How many screened facts it stands for (a group: its members; 1 for a single fact). */
  readonly standsFor?: number;
  /** The hidden facts that follow from it (with the facts above it and the construction). */
  readonly consequences?: Consequences;
}

export interface FindBudget {
  /** Candidates screened per claim kind. */
  readonly candidatesPerKind: number;
  /** Tuples counted per kind to state its total. */
  readonly countLimit: number;
  /** Local tests of surviving facts. */
  readonly tests: number;
  /** Facts reported. */
  readonly results: number;
  /** Figures per local test (the Test button's n). */
  readonly n: number;
}

export const DEFAULT_FIND_BUDGET: FindBudget = Object.freeze({
  candidatesPerKind: 20_000,
  countLimit: 2_000_000,
  tests: 60,
  results: 50,
  n: 200,
});

export interface FindJob {
  readonly kind: 'find';
  readonly doc: Document;
  readonly seed: Seed;
  readonly budget?: Partial<FindBudget>;
}

/** What the screen covered for one kind. */
export interface KindReport {
  readonly kind: string;
  readonly checked: number;
  /** The kind's candidates (a count limited by countLimit when `more`). */
  readonly total: number;
  readonly more: boolean;
  /** False when the total counts tuples before a non-transposition symmetry (an upper bound). */
  readonly exact: boolean;
  /** Why the screen stopped before the end: the candidate budget or the host's time. */
  readonly stop?: 'budget' | 'time';
}

export interface Unconfirmed {
  readonly fact: Fact;
  /** The local verdict's kind (mixed, false, inconclusive) or why the test could not run. */
  readonly verdict: string;
}

export interface FindResult {
  readonly kind: 'found';
  readonly seed: Seed;
  readonly budget: FindBudget;
  /** The reported facts, ranked (at most budget.results). */
  readonly facts: readonly FoundFact[];
  /** Confirmed facts beyond budget.results (counted, not shown). */
  readonly beyondResults: number;
  /** Construction facts: their count, and the first CONSTRUCTION_SHOWN of them. */
  readonly construction: { readonly count: number; readonly shown: readonly Fact[] };
  /** Facts the screen called true that the local test did not confirm. */
  readonly unconfirmed: readonly Unconfirmed[];
  /** Surviving facts not tested (the test budget or the time). */
  readonly untested: number;
  /** Local tests run (ADR-0039: each claim a group is tested as counts; absent: one per fact). */
  readonly testsRun?: number;
  /** Every hidden consequence of the facts shown (listed under them; absent: none). */
  readonly consequenceCount?: number;
  readonly kinds: readonly KindReport[];
  readonly notSearched: readonly { readonly kind: string; readonly reason: string }[];
  /** The host's time budget stopped the job (`stop`). */
  readonly stopped: boolean;
  /** The caps hit, as sentences ("checked 4,000 of 18,000 collinear candidates: budget"). */
  readonly caps: readonly string[];
}

export const CONSTRUCTION_SHOWN = 200;

export type Cancelled = { readonly kind: 'cancelled' };
export type Invalid = { readonly kind: 'invalid'; readonly reason: string };

export type FindOutcome = FindResult | Cancelled | Invalid;

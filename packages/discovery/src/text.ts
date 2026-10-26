/**
 * The texts of discovery results (ADR-0035 decisions 10–11): what was checked, never more.
 * Rungs as the local test used them ("exact over Q, 200/200"), and one sentence per cap the
 * job hit. Numbers are grouped by thousands with commas, the same in every locale.
 */
import { RUNG_NAMES } from '@geomira/claims/rungs';
import type { Verdict } from '@geomira/claims/verdict';
import type { FindResult, KindReport } from './types';

/** 18000 → "18,000". */
export function grouped(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  return n < 0 ? `-${out}` : out;
}

function isExact(r: string): boolean {
  return r === 'exact over Q' || r === 'exact mod p';
}

/** "exact over Q, 200/200", or "exact over Q 150, numeric 50; 200/200" when mixed. */
export function rungText(v: Verdict): { readonly text: string; readonly exact: boolean } {
  const used = RUNG_NAMES.flatMap((r) => {
    const c = v.rungs[r];
    return c === undefined || c === 0 ? [] : [{ r, c }];
  });
  const count = `${grouped(v.tally.true)}/${grouped(v.tested)}`;
  const text =
    used.length === 1
      ? `${used[0]?.r ?? ''}, ${count}`
      : `${used.map((u) => `${u.r} ${grouped(u.c)}`).join(', ')}; ${count}`;
  return { text, exact: used.length > 0 && used.every((u) => isExact(u.r)) };
}

function total(k: KindReport): string {
  if (k.more) return `more than ${grouped(k.total)}`;
  return k.exact ? grouped(k.total) : `at most ${grouped(k.total)}`;
}

/** One sentence per cap the find job hit. */
export function capLines(r: Omit<FindResult, 'caps'>): string[] {
  const out: string[] = [];
  for (const k of r.kinds)
    if (k.stop !== undefined || k.more)
      out.push(
        `checked ${grouped(k.checked)} of ${total(k)} ${k.kind} candidates: ${k.stop === 'time' ? 'time budget' : 'budget'}`,
      );
  for (const n of r.notSearched) out.push(`${n.kind} not searched: ${n.reason}`);
  if (r.untested > 0)
    out.push(
      `tested ${grouped(r.unconfirmed.length + r.facts.length + r.beyondResults)} of ${grouped(r.unconfirmed.length + r.facts.length + r.beyondResults + r.untested)} facts: ${r.stopped ? 'time budget' : 'test budget'}`,
    );
  if (r.beyondResults > 0)
    out.push(
      `showing ${grouped(r.facts.length)} of ${grouped(r.facts.length + r.beyondResults)} facts`,
    );
  if (r.stopped) out.push('stopped at the time budget');
  return out;
}

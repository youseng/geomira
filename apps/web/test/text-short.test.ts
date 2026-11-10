/**
 * ADR-0061 in the web app: the text panel shows the figure in the short notation. What was
 * typed short stays short after the text is applied and the field is left (it used to be
 * rewritten into the canonical form); what the GUI builds appears short; the files, links and
 * autosaves still hold the canonical text, and both read back to the same figure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Edit } from '@geomira/editor/edit';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { timeout } from '../src/long-press';
import { EditorStore } from '../src/store';
import { TEXT_APPLY_PAUSE_MS, TextApplier } from '../src/text-apply';
import { registry } from './helpers';

const TYPED = [
  '@version 1',
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'X = (6, 3)',
  'O = circumcenter(ABC)',
  'w = incircle(ABC)',
  'D = foot(A, BC)',
  'P, Q = tangents(X, w)',
  '',
].join('\n');

function setup(text = '@version 1\n') {
  const store = new EditorStore({ registry }, (m) => {
    throw new Error(m);
  });
  store.openText(text, 'new');
  const host = {
    env: store.env,
    current: () => store.current(),
    apply: (e: Edit) => store.apply(e),
  };
  const applier = new TextApplier(host, timeout, () => Date.now());
  store.subscribe(() => {
    applier.follow(store.current().doc);
  });
  return { store, applier };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the text panel shows the short notation', () => {
  it('what was typed short is still that text after it is applied and the field is left', () => {
    const { store, applier } = setup();
    applier.type(TYPED);
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS);
    expect(store.current().doc.objects.map((o) => o.name)).toEqual([
      'A',
      'B',
      'C',
      'X',
      'O',
      'w',
      'D',
      'P',
      'Q',
    ]);
    applier.leave();
    expect(applier.getSnapshot().text).toBe(TYPED);
    expect(store.current().history.past).toHaveLength(1);
  });

  it('a figure opened from its canonical text is shown short', () => {
    const canonical = print(parse(TYPED, registry).doc);
    expect(canonical).toContain('D = foot(A, line(B, C))');
    expect(canonical).toContain('Q = tangent_from(X, w, orient(-))');
    expect(setup(canonical).applier.getSnapshot().text).toBe(TYPED);
  });

  it('what another edit builds appears short, and an undo shows the text before', () => {
    const { store, applier } = setup(TYPED);
    const before = applier.getSnapshot().text;
    const text = `${print(store.current().doc)}H = orthocenter(A, B, C)\n`;
    store.apply({ kind: 'replaceText', text });
    expect(applier.getSnapshot().text).toBe(`${TYPED}H = orthocenter(ABC)\n`);
    store.apply({ kind: 'undo' });
    expect(applier.getSnapshot().text).toBe(before);
  });

  it('the canonical text of the figure is unchanged: files and links hold it', () => {
    const { store, applier } = setup();
    applier.type(TYPED);
    applier.applyNow();
    expect(print(store.current().doc)).toBe(print(parse(TYPED, registry).doc));
    expect(print(parse(applier.getSnapshot().text, registry).doc)).toBe(print(store.current().doc));
  });
});

/**
 * Run 16b (ADR-0042, ADR-0029's style card): a conic is a curve. Its card names it "conic" and
 * shows the curve fields; a draft of colour, width, dash and opacity written from the card is
 * one style edit that reads back from the text, and the scene draws the conic with it.
 */
import { describe, expect, it } from 'vitest';
import { applyEdit } from '@geomira/editor/edit';
import { createEditor } from '@geomira/editor/state';
import { findObjectByName } from '@geomira/kernel/document';
import { createRegistry } from '@geomira/kernel/registry';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import { cardKindOf, fieldsOf, kindName, writeEdit } from '../src/style-draft';

const registry = createRegistry();
const TEXT =
  '@version 1\nA = (1, 1)\nB = (2, 1/2)\nC = (-1, -1)\nD = (4, 1/4)\nE = (1/2, 2)\nk = conic(A, B, C, D, E)\n';

describe('the style card on a conic', () => {
  const doc = parse(TEXT, registry).doc;
  const state = createEditor(doc, { registry });
  const k = findObjectByName(doc, 'k');
  const v = k === undefined ? undefined : state.values.values.get(k.id);

  it('is a curve named "conic", with the curve fields', () => {
    expect(v?.kind).toBe('conic');
    expect(v && kindName(v, null)).toBe('conic');
    expect(v === undefined ? 'none' : cardKindOf(v.kind, null)).toBe('curve');
    expect(cardKindOf('undefined', 'conic')).toBe('curve');
    const f = fieldsOf('curve');
    expect(f.main).toEqual(expect.arrayContaining(['color', 'width', 'opacity', 'label']));
    expect(f.more).toContain('dash');
  });

  it('writes colour, width, dash and opacity as one edit, read back and drawn on the conic', () => {
    if (k === undefined) throw new Error('no conic');
    const draft = { color: 'red', width: 2, dash: 'dashed', opacity: 0.5 } as const;
    const r = applyEdit(state, writeEdit(k.id, draft), { registry });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.history.past).toHaveLength(1);
    expect(print(r.state.doc)).toMatch(
      /^k = conic\(A, B, C, D, E\) \[color=red, width=2, dash=dashed, opacity=0\.5\]$/mu,
    );
    expect(findObjectByName(parse(print(r.state.doc), registry).doc, 'k')?.style).toEqual(draft);
    const p = buildScene(r.state.doc, r.state.values.values).primitives.find((i) => i.name === 'k');
    expect(p?.shape.kind === 'conic' && p.shape.type).toBe('hyperbola');
    expect(p?.style).toMatchObject({ color: 'red', width: 2, dash: 'dashed', opacity: 0.5 });
  });
});

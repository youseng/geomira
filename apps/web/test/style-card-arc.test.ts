/**
 * Run 13 (ADR-0031, ADR-0029's style card): an arc is a curve. Its card names it "arc" and
 * shows the curve fields (colour, width, opacity, label, visible; dash under More); a draft
 * of colour, width, dash and opacity written from the card is one style edit that reads back
 * from the text, and the scene draws the arc (only the arc) with it.
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
const TEXT = '@version 1\nA = (4, 0)\nB = (0, 4)\nC = (-4, 0)\na = arc(A, B, C)\n';

describe('the style card on an arc', () => {
  const doc = parse(TEXT, registry).doc;
  const state = createEditor(doc, { registry });
  const a = findObjectByName(doc, 'a');
  const v = a === undefined ? undefined : state.values.values.get(a.id);

  it('is a curve named "arc", with the curve fields', () => {
    expect(v?.kind).toBe('circle');
    expect(v && kindName(v, null)).toBe('arc');
    const kind = v === undefined ? 'none' : cardKindOf(v.kind, null);
    expect(kind).toBe('curve');
    const f = fieldsOf('curve');
    expect(f.main).toEqual(expect.arrayContaining(['color', 'width', 'opacity']));
    expect(f.more).toContain('dash');
  });

  it('writes colour, width, dash and opacity as one edit, read back from the text and drawn on the arc', () => {
    if (a === undefined) throw new Error('no arc');
    const draft = { color: 'red', width: 2, dash: 'dashed', opacity: 0.5 } as const;
    const r = applyEdit(state, writeEdit(a.id, draft), { registry });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.history.past).toHaveLength(1);
    expect(print(r.state.doc)).toMatch(
      /^a = arc\(A, B, C\) \[color=red, width=2, dash=dashed, opacity=0\.5\]$/mu,
    );
    const back = parse(print(r.state.doc), registry).doc;
    expect(findObjectByName(back, 'a')?.style).toEqual(draft);
    const shape = buildScene(r.state.doc, r.state.values.values).primitives.find(
      (i) => i.name === 'a',
    );
    expect(shape?.shape.kind === 'circle' && shape.shape.arc).not.toBeNull();
    expect(shape?.style).toMatchObject({ color: 'red', width: 2, dash: 'dashed', opacity: 0.5 });
  });
});

/**
 * applyEdit for every edit type (SPEC §12): document edits (the kernel's, claims,
 * assumptions, the whole text, the document's viewport, batches) are one history entry each;
 * UI edits change no document; refusals leave the state unchanged (the same object) and say
 * why; removal reports its cascade list.
 */
import { describe, expect, it } from 'vitest';
import { call, lit, ref } from '@geomira/kernel/expr';
import { fromInteger } from '@geomira/num/rational';
import { sameUpToIds } from '@geomira/lang/canonical';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { applyEdit, type Edit } from '../src/edit';
import { evaluationOf, LOG_LENGTH } from '../src/state';
import { edit, editorOf, env, idOf, ok, registry, xyOf } from './helpers/editor';

const FIG = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'l = line(A, B)',
  'M = midpoint(A, B)',
  'claim collinear(A, M, B)',
  'assume acute(A, B, C)',
].join('\n');

function refused(s: ReturnType<typeof editorOf>, e: Edit, reason: RegExp | string): void {
  const r = applyEdit(s, e, env);
  expect(r.ok).toBe(false);
  expect(r.state).toBe(s);
  if (!r.ok) expect(r.reason).toMatch(reason);
}

describe('applyEdit: document edits', () => {
  it('add, rename, redefine, style, setLayers, move: one history entry each', () => {
    let s = editorOf(FIG);
    s = edit(s, {
      kind: 'add',
      object: { name: 'D', def: call('point', [lit(fromInteger(5)), lit(fromInteger(6))]) },
    });
    s = edit(s, { kind: 'rename', id: idOf(s, 'D'), name: 'E' });
    s = edit(s, {
      kind: 'redefine',
      id: idOf(s, 'E'),
      def: call('midpoint', [ref(idOf(s, 'B')), ref(idOf(s, 'C'))]),
    });
    expect(xyOf(s, 'E')).toEqual([2.5, 1.5]);
    s = edit(s, { kind: 'style', id: idOf(s, 'E'), style: { color: 'red' } });
    s = edit(s, { kind: 'addLayer', name: 'aux' });
    const aux = s.doc.layers.find((l) => l.name === 'aux')?.id ?? '';
    s = edit(s, { kind: 'setLayers', id: idOf(s, 'E'), layers: ['main', aux] });
    s = edit(s, { kind: 'move', id: idOf(s, 'E'), index: 3 });
    expect(s.doc.objects.map((o) => o.name).indexOf('E')).toBe(3);
    expect(s.history.past.map((h) => h.label)).toEqual([
      'add',
      'rename D',
      'redefine E',
      'style E',
      'addLayer',
      'setLayers E',
      'move E',
    ]);
  });

  it('remove reports the cascade list: dependents, claims, assumptions', () => {
    const s = editorOf(FIG);
    const r = applyEdit(s, { kind: 'remove', id: idOf(s, 'A') }, env);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const names = (ids: readonly number[]) =>
      ids.map((id) => s.doc.objects.find((o) => o.id === id)?.name);
    expect(names(r.removed.objects)).toEqual(['A', 'l', 'M']);
    expect(r.removed.claims).toEqual([s.doc.claims[0]?.id]);
    expect(r.removed.assumptions).toEqual([s.doc.assumptions[0]?.id]);
    expect(r.state.doc.objects.map((o) => o.name)).toEqual(['B', 'C']);
  });

  it('layers, derived layers and views', () => {
    let s = editorOf(`${FIG}\nT = reflect(l)`);
    s = edit(s, {
      kind: 'addDerivedLayer',
      spec: { name: 'mirror', transform: idOf(s, 'T'), source: 'main' },
    });
    const m = s.doc.layers.find((l) => l.name === 'mirror')?.id ?? '';
    expect(xyOf(s, 'C*')).toEqual([1, -3]);
    s = edit(s, { kind: 'updateRule', layerId: m, patch: { suffix: '**' } });
    expect(s.doc.objects.some((o) => o.name === 'C**')).toBe(true);
    s = edit(s, { kind: 'addView', view: { name: 'only', layerVisibility: { main: false } } });
    s = edit(s, { kind: 'applyView', name: 'only' });
    expect(s.doc.layers.find((l) => l.id === 'main')?.visible).toBe(false);
    s = edit(s, { kind: 'removeView', name: 'only' });
    s = edit(s, { kind: 'updateLayer', id: m, patch: { opacity: 0.5 } });
    s = edit(s, { kind: 'removeRule', layerId: m });
    expect(s.doc.objects.some((o) => o.name === 'C**')).toBe(false);
    s = edit(s, { kind: 'removeLayer', id: m });
    expect(s.doc.layers.map((l) => l.id)).toEqual(['main']);
  });

  it('claims and assumptions are checked by packages/claims', () => {
    let s = editorOf(FIG);
    const [A, B, C] = ['A', 'B', 'C'].map((n) => ref(idOf(s, n)));
    if (A === undefined || B === undefined || C === undefined) throw new Error('points');
    s = edit(s, { kind: 'addClaim', claim: { kind: 'collinear', args: [A, B, C], name: 'cab' } });
    const id = s.doc.claims[1]?.id ?? -1;
    refused(
      s,
      { kind: 'addClaim', claim: { kind: 'colinear', args: [A, B, C] } },
      'unknown claim "colinear"',
    );
    refused(
      s,
      { kind: 'addClaim', claim: { kind: 'collinear', args: [A, ref(999), C] } },
      'there is no object #999',
    );
    refused(
      s,
      { kind: 'addClaim', claim: { kind: 'collinear', args: [A, B, C], name: 'A' } },
      'the name A is already used',
    );
    s = edit(s, { kind: 'renameClaim', id, name: 'line_abc' });
    expect(s.doc.claims[1]?.name).toBe('line_abc');
    s = edit(s, { kind: 'renameClaim', id });
    expect(s.doc.claims[1]?.name).toBeUndefined();
    s = edit(s, { kind: 'removeClaim', id });
    refused(s, { kind: 'removeClaim', id }, `there is no claim #${String(id)}`);
    s = edit(s, { kind: 'addAssumption', assumption: { kind: 'scalene', args: [A, B, C] } });
    refused(
      s,
      { kind: 'addAssumption', assumption: { kind: 'equal', args: [A, B] } },
      /construct it/,
    );
    s = edit(s, { kind: 'removeAssumption', id: s.doc.assumptions[1]?.id ?? -1 });
    expect(s.doc.assumptions).toHaveLength(1);
  });

  it('replaceText keeps ids (parseInto), refuses a text with errors, and an equal text is no edit', () => {
    const s = editorOf(FIG);
    const text = print(s.doc).replace('C = (1, 3)', 'C = (2, 5)');
    const t = edit(s, { kind: 'replaceText', text });
    expect(idOf(t, 'C')).toBe(idOf(s, 'C'));
    expect(xyOf(t, 'C')).toEqual([2, 5]);
    expect(t.history.past).toHaveLength(1);
    const r = applyEdit(s, { kind: 'replaceText', text: `${text}\nX = midpoint(A, Q)` }, env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnostics?.[0]?.message).toBe('unknown name "Q"');
    const same = edit(s, { kind: 'replaceText', text: print(s.doc) });
    expect(same.doc).toBe(s.doc);
    expect(same.history.past).toHaveLength(0);
  });

  it("docViewport sets the text's @viewport (in history); a bad one is refused", () => {
    let s = editorOf(FIG);
    s = edit(s, { kind: 'docViewport', viewport: { cx: 1, cy: 2, zoom: 30 } });
    expect(print(s.doc)).toContain('@viewport 1 2 30');
    refused(
      s,
      { kind: 'docViewport', viewport: { cx: 1, cy: Number.NaN, zoom: 30 } },
      /not finite/,
    );
    refused(s, { kind: 'docViewport', viewport: { cx: 1, cy: 2, zoom: 0 } }, /zoom/);
    s = edit(s, { kind: 'docViewport', viewport: null });
    expect(s.doc.viewport).toBeNull();
  });

  it('a batch applies all or nothing, as one history entry', () => {
    const s = editorOf(FIG);
    const t = edit(s, {
      kind: 'batch',
      label: 'two points',
      edits: [
        {
          kind: 'add',
          object: {
            name: 'P',
            def: call('centroid', [ref(idOf(s, 'A')), ref(idOf(s, 'B')), ref(idOf(s, 'C'))]),
          },
        },
        {
          kind: 'add',
          object: { name: 'Q', def: call('midpoint', [ref(idOf(s, 'A')), ref(idOf(s, 'C'))]) },
        },
      ],
    });
    expect(t.history.past.map((h) => h.label)).toEqual(['two points']);
    refused(
      s,
      {
        kind: 'batch',
        label: 'bad',
        edits: [
          { kind: 'add', object: { name: 'P', def: ref(idOf(s, 'A')) } },
          { kind: 'add', object: { name: 'P', def: ref(idOf(s, 'B')) } },
        ],
      },
      'the name P is already used',
    );
  });

  it('what the text format cannot hold is refused (law L5): bad calls, misplaced strings, bad styles', () => {
    const s = editorOf(FIG);
    const [A, l] = [ref(idOf(s, 'A')), ref(idOf(s, 'l'))];
    const add = (def: Parameters<typeof call>[1][number]) => ({
      kind: 'add' as const,
      object: { name: 'Z', def },
    });
    refused(
      s,
      add(call('midpoint', [A, l])),
      'midpoint does not accept (point, line); signatures: midpoint(point, point)',
    );
    refused(s, add(call('nope', [A])), 'unknown tool "nope"');
    refused(
      s,
      add(call('intersect', [l, call('circle', [A, ref(idOf(s, 'B'))])])),
      /add a selector|selector/,
    );
    refused(
      s,
      add({ kind: 'str', value: 'x' }),
      'a string is only an argument of a call, as in text(P, "…")',
    );
    refused(
      s,
      add(call('add', [{ kind: 'str', value: 'x' }, lit(fromInteger(1))])),
      /add does not accept/,
    );
    refused(
      s,
      { kind: 'style', id: idOf(s, 'A'), style: { width: Number.NaN } },
      'a width is a finite number ≥ 0',
    );
    refused(
      s,
      { kind: 'style', id: idOf(s, 'A'), style: { labelDist: -1 } },
      'a label distance is a finite number ≥ 0',
    );
    refused(
      s,
      { kind: 'style', id: idOf(s, 'A'), style: { z: Number.POSITIVE_INFINITY } },
      /finite/,
    );
    refused(
      s,
      { kind: 'addClaim', claim: { kind: 'collinear', args: [A, call('midpoint', [l]), A] } },
      /midpoint does not accept/,
    );
    // A redefinition that changes a kind under what is built from it, or under a claim.
    const toMap = call('reflect', [call('line', [A, ref(idOf(s, 'C'))])]);
    refused(
      s,
      { kind: 'redefine', id: idOf(s, 'B'), def: toMap },
      /^l would no longer be valid: line does not accept \(point, transform\)/,
    );
    const t = editorOf(`${FIG}\nclaim collinear(A, midpoint(B, C), M)`);
    refused(
      t,
      { kind: 'redefine', id: idOf(t, 'C'), def: call('reflect', [ref(idOf(t, 'l'))]) },
      /^a collinear condition would no longer be valid: midpoint does not accept/,
    );
  });

  it('keeps the document in text order: no user object inside an image run (law L5)', () => {
    let s = editorOf(`${FIG}\nT = reflect(line(A, C))\n@layer m = image(T, main)`);
    s = edit(s, {
      kind: 'add',
      object: { name: 'P', def: call('midpoint', [ref(idOf(s, 'A*')), ref(idOf(s, 'A'))]) },
    });
    const at = s.doc.objects.findIndex((o) => o.name === 'A*');
    s = edit(s, { kind: 'move', id: idOf(s, 'P'), index: at + 1 });
    const names = s.doc.objects.map((o) => o.name);
    expect(names.indexOf('P')).toBeGreaterThan(names.indexOf('l*'));
    expect(sameUpToIds(parse(print(s.doc), registry).doc, s.doc)).toBe(true);
  });

  it('a rename re-evaluates what names it in an undefined reason (values equal a full evaluation)', () => {
    let s = editorOf('A = (0, 0)\nB = (0, 0)\nl = line(A, B)\nM = foot(A, l)');
    s = edit(s, { kind: 'rename', id: idOf(s, 'l'), name: 'k' });
    expect(s.values.values.get(idOf(s, 'M'))).toEqual({
      kind: 'undefined',
      reason: 'k is undefined',
    });
    expect(s.values.values).toEqual(evaluationOf(s.doc, env).values);
  });

  it('refusals: unknown objects, bad names, managed images, cycles', () => {
    const s = editorOf(`${FIG}\nT = reflect(l)\n@layer m = image(T, main)`);
    refused(s, { kind: 'remove', id: 999 }, 'there is no object #999');
    refused(s, { kind: 'rename', id: idOf(s, 'A'), name: 'Ma' }, /did you mean M_a/);
    refused(s, { kind: 'rename', id: idOf(s, 'A'), name: 'C*' }, 'C* is the image of C in layer m');
    refused(s, { kind: 'remove', id: idOf(s, 'C*') }, /follows C/);
    refused(s, { kind: 'redefine', id: idOf(s, 'A'), def: ref(idOf(s, 'M')) }, /cycle/);
    refused(s, { kind: 'undo' }, 'nothing to undo');
    refused(s, { kind: 'redo' }, 'nothing to redo');
  });
});

describe('applyEdit: UI edits (outside history)', () => {
  it('selection modes, hover, viewport, active layer, tool', () => {
    let s = editorOf(`${FIG}\n@layer aux`);
    const [A, B, C] = [idOf(s, 'A'), idOf(s, 'B'), idOf(s, 'C')];
    s = edit(s, { kind: 'select', ids: [A, B, A], mode: 'replace' });
    expect(s.selection).toEqual([A, B]);
    s = edit(s, { kind: 'select', ids: [C], mode: 'add' });
    s = edit(s, { kind: 'select', ids: [B, C], mode: 'toggle' });
    expect(s.selection).toEqual([A]);
    refused(s, { kind: 'select', ids: [999], mode: 'add' }, 'there is no object #999');
    s = edit(s, { kind: 'hover', id: B });
    s = edit(s, { kind: 'viewport', viewport: { cx: 3, cy: 4, zoom: 80 } });
    refused(s, { kind: 'viewport', viewport: { cx: 3, cy: 4, zoom: -1 } }, /zoom/);
    const aux = s.doc.layers.find((l) => l.name === 'aux')?.id ?? '';
    s = edit(s, { kind: 'activeLayer', id: aux });
    refused(s, { kind: 'activeLayer', id: 'nope' }, 'there is no layer "nope"');
    s = edit(s, { kind: 'tool', tool: 'claim', claimKind: 'concyclic' });
    expect(s.toolState.claimKind).toBe('concyclic');
    expect(s.history.past).toHaveLength(0);
    expect([s.hover, s.viewport.zoom, s.activeLayer, s.tool]).toEqual([B, 80, aux, 'claim']);
  });

  it('an edit that removes the selected, hovered or active things prunes them', () => {
    let s = editorOf(`${FIG}\n@layer aux`);
    const aux = s.doc.layers.find((l) => l.name === 'aux')?.id ?? '';
    s = edit(s, { kind: 'select', ids: [idOf(s, 'M'), idOf(s, 'C')], mode: 'replace' });
    s = edit(s, { kind: 'hover', id: idOf(s, 'M') });
    s = edit(s, { kind: 'activeLayer', id: aux });
    s = edit(s, { kind: 'remove', id: idOf(s, 'A') });
    s = edit(s, { kind: 'removeLayer', id: aux });
    expect([s.selection, s.hover, s.activeLayer]).toEqual([[idOf(s, 'C')], null, 'main']);
  });

  it('the log keeps the last LOG_LENGTH applied edits', () => {
    let s = editorOf(FIG);
    for (let i = 0; i < LOG_LENGTH + 7; i++)
      s = ok(applyEdit(s, { kind: 'hover', id: i % 2 === 0 ? null : idOf(s, 'A') }, env));
    expect(s.log).toHaveLength(LOG_LENGTH);
    const r = applyEdit(s, { kind: 'remove', id: 999 }, env);
    expect(r.state.log).toBe(s.log);
  });
});

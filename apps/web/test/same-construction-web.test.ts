/**
 * Repeated constructions in the page (ADR-0029): a GUI tool that reuses the existing object
 * says so ("l is line(A, B) already"), and the next document edit or tool action answers the
 * notice; the text panel warns about a definition that repeats an earlier one, without
 * refusing the text (old files with repeats must stay editable).
 */
import { describe, expect, it } from 'vitest';
import { findObjectByName } from '@geomira/kernel/document';
import { diagnosticsOf } from '../src/panels/TextPanel';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

const FIG = '@version 1\nA = (0, 0)\nB = (4, 0)\nl = line(A, B)\n';

function idOf(store: EditorStore, name: string): number {
  return findObjectByName(store.current().doc, name)?.id ?? -1;
}

describe('a reused construction', () => {
  it('the Line tool on B then A shows "l is line(A, B) already" and adds nothing', () => {
    const store = new EditorStore({ registry }, () => undefined);
    store.openText(FIG, 'new');
    const before = store.current().doc.objects.length;
    store.apply({ kind: 'tool', tool: 'line' });
    store.input({ kind: 'object', id: idOf(store, 'B') });
    store.input({ kind: 'object', id: idOf(store, 'A') });
    expect(store.current().doc.objects).toHaveLength(before);
    expect(store.getSnapshot().notice).toMatchObject({
      tone: 'info',
      text: 'l is line(A, B) already',
    });
    store.apply({ kind: 'tool', tool: 'midpoint' });
    expect(store.getSnapshot().notice).toBeNull();
  });

  it('the text panel warns about a repeat and still accepts it', () => {
    const d = diagnosticsOf(`${FIG}m = line(B, A)\n`, registry);
    expect(d.map((x) => [x.line, x.severity])).toEqual([[5, 'warning']]);
    expect(d[0]?.message).toMatch(/same construction as l/u);
  });
});

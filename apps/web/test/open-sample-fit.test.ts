/**
 * Bug-fix round (ADR-0028): "Open counterexample" replaced the text without fitting the view,
 * so the sample figure (drawn anywhere in the plane) often left the canvas empty. Opening a
 * verdict's sample figure now asks for a fit, as opening a document does.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { openSample } from '../src/panels/RunLine';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

describe('opening a sample figure of a verdict', () => {
  it('is one undoable edit of the text, and the view is fitted to it', () => {
    const store = new EditorStore({ registry }, () => undefined);
    store.openText('@version 1\nA = (0, 0)\nB = (4, 0)\n', 'new');
    const fits = store.getSnapshot().fits;
    const sample = parse('@version 1\nA = (900, -700)\nB = (905, -702)\n', registry).doc;
    openSample(store, sample);
    expect(print(store.current().doc)).toBe(print(sample));
    expect(store.current().history.past.length).toBe(1);
    expect(store.getSnapshot().fits).toBe(fits + 1);
  });

  it('opening a document fits too; an ordinary edit does not', () => {
    const store = new EditorStore({ registry }, () => undefined);
    const fits = store.getSnapshot().fits;
    store.openText('@version 1\nA = (0, 0)\n', 'new');
    expect(store.getSnapshot().fits).toBe(fits + 1);
    store.command('B = (1, 1)');
    expect(store.getSnapshot().fits).toBe(fits + 1);
  });
});

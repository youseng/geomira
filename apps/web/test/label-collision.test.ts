import { describe, expect, it } from 'vitest';
import { layout } from '@geomira/scene/display';
import { boxesOverlap, labelBox } from '@geomira/scene/label-box';
import { EXAMPLES } from '../src/examples';
import { loadFigure, viewportFor } from '../src/figure';
import { registry } from './helpers';

/** Note C of Run 8b on the parsed examples, in the e2e tests' desktop and mobile canvases. */

const SIZES = [
  { width: 900, height: 640 },
  { width: 390, height: 420 },
];

function labelsOf(id: string, size: { width: number; height: number }) {
  const text = EXAMPLES.find((e) => e.id === id)?.text ?? '';
  const f = loadFigure(text, registry);
  const d = layout(f.scene, { viewport: viewportFor(f, size), size });
  const names = new Map(d.items.map((i) => [i.id, i.name]));
  return new Map(d.labels.map((l) => [names.get(l.id) ?? '?', l]));
}

describe('labels of nearby points do not overlap (note C)', () => {
  for (const size of SIZES) {
    it(`nine-point circle, ${String(size.width)}×${String(size.height)}: M_a and D`, () => {
      const ls = labelsOf('nine-point-circle', size);
      const [ma, d] = [ls.get('M_a'), ls.get('D')];
      if (ma === undefined || d === undefined) throw new Error('labels missing');
      expect(boxesOverlap(labelBox(ma), labelBox(d))).toBe(false);
    });

    it(`every example, ${String(size.width)}×${String(size.height)}: no two point labels overlap`, () => {
      for (const e of EXAMPLES.filter((x) => x.id !== 'stress-300')) {
        const ls = [...labelsOf(e.id, size).entries()];
        for (const [i, [a, la]] of ls.entries())
          for (const [b, lb] of ls.slice(i + 1))
            expect(boxesOverlap(labelBox(la), labelBox(lb)), `${e.id}: ${a} and ${b}`).toBe(false);
      }
    });
  }
});

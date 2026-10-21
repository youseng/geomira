/**
 * Golden snapshots (Run 9a): every example and export fixture in every text format, as
 * committed files under test/__snapshots__/<input>/. A change of any exporter, of the scene
 * (placement, order) or of the kernel's values shows up here as a diff to review; tex.yml
 * compiles the same outputs. Update with `vitest run packages/export -u` and review the diff.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { toAsymptote } from '../src/asy';
import { toSvg } from '../src/svg';
import { toTikz, toTikzStandalone } from '../src/tikz';
import { examples, frameOf, REGISTRY } from './helpers/figure';

const inputs = [
  ...examples(),
  ...['constructions', 'display', 'numeric'].map((n) => ({
    name: `fixture-${n}`,
    text: readFileSync(`tests/fixtures/export/${n}.geo`, 'utf8'),
  })),
];

describe('golden snapshots per input and format', () => {
  for (const input of inputs)
    it(input.name, async () => {
      const f = frameOf(input.text);
      const dir = `./__snapshots__/${input.name}`;
      await expect(toSvg(f).text).toMatchFileSnapshot(`${dir}/figure.svg`);
      await expect(toTikz(f).text).toMatchFileSnapshot(`${dir}/snippet.tikz.tex`);
      await expect(toTikzStandalone(f).text).toMatchFileSnapshot(`${dir}/standalone.tex`);
      await expect(toAsymptote(f, REGISTRY, 'standalone').text).toMatchFileSnapshot(
        `${dir}/standalone.asy`,
      );
      await expect(toAsymptote(f, REGISTRY, 'aops').text).toMatchFileSnapshot(`${dir}/aops.asy`);
    });
});

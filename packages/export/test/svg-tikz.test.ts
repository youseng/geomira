import { describe, expect, it } from 'vitest';
import type { View } from '@geomira/scene/viewport';
import { toSvg, xml } from '../src/svg';
import { toTikz, toTikzStandalone } from '../src/tikz';
import { frameOf } from './helpers/figure';

const STYLED = `@version 1
@title "Styles & <specials>"
@layer faint [opacity=0.4]
A = (0, 0)
B = (4, 0)
C = (1, 3)
p = polygon(A, B, C) [color=teal]
l = line(A, B) [dash=dashed, width=2]
m = segment(B, C) [dash=dotted, color="rgba(255, 0, 0, 0.5)"]
c = circle(C, 1) [layers=faint]
k = circle(A, B, C) [color=notacolour]
label A "A_1 & co"
`;

describe('SVG', () => {
  const f = frameOf(STYLED);
  const r = toSvg(f);

  it('is an SVG of the view: size, background, title escaped', () => {
    expect(
      r.text.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"',
      ),
    ).toBe(true);
    expect(r.text).toContain('<title>Styles &amp; &lt;specials&gt;</title>');
    expect(r.text).toContain('<rect width="640" height="480" fill="#fbfbf8"/>');
    expect(r.text.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('draws fills, dashes, widths, colours and opacities as the canvas does', () => {
    expect(r.text).toContain('fill="#008080" fill-opacity="0.08"');
    expect(r.text).toMatch(/stroke-width="2" stroke-dasharray="10 8"/u);
    expect(r.text).toMatch(
      /stroke="#FF0000" stroke-opacity="0.5" stroke-width="1.5" stroke-dasharray="1.5 5"/u,
    );
    expect(r.text).toMatch(
      /<g data-id="\d+" data-name="c">\n<path d="M[^"]*" fill="none" stroke="#1B1F24" stroke-opacity="0.4"/u,
    );
  });

  it('draws a full circle as two half arcs and points as outlined dots', () => {
    const k = /<g data-id="\d+" data-name="c">\n<path d="([^"]*)"/u.exec(r.text)?.[1] ?? '';
    expect(k.match(/A/gu)).toHaveLength(2);
    expect(r.text).toMatch(
      /<circle cx="[\d.]+" cy="[\d.]+" r="3.5" fill="#1B1F24" fill-opacity="1" stroke="#fbfbf8"/u,
    );
  });

  it('writes labels with scripts as tspans, escaped', () => {
    expect(r.text).toMatch(
      /<text data-id="\d+" [^>]*><tspan font-size="15">A<\/tspan><tspan font-size="11" dy="3.75">1<\/tspan><tspan font-size="15" dy="-3.75"> &amp; co<\/tspan><\/text>/u,
    );
  });

  it('reports a colour it cannot read and draws it in the ink', () => {
    expect(r.warnings).toEqual([{ kind: 'colour', object: 'k', colour: 'notacolour' }]);
  });

  it('xml escapes the five specials', () => {
    expect(xml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;');
  });
});

describe('TikZ', () => {
  const f = frameOf(STYLED);

  it('the snippet is one tikzpicture with six-digit colours and the view clipped', () => {
    const t = toTikz(f).text;
    expect(t).toMatch(/^% GEOMIRA export: TikZ\. One unit is [\d.]+bp/u);
    expect(t).toContain('% Needs \\usepackage{tikz} and \\usepackage{amssymb}.');
    expect(t).toContain(
      '% Warning: the colour "notacolour" of k cannot be read: drawn in the default ink',
    );
    for (const m of t.matchAll(/\\definecolor\{gmc\d+\}\{HTML\}\{([^}]*)\}/gu))
      expect(m[1]).toMatch(/^[0-9A-F]{6}$/u);
    expect(t).toContain('\\definecolor{gmc0}{HTML}{008080}');
    expect(t).toMatch(/\\clip \(-?[\d.]+,-?[\d.]+\) rectangle \(-?[\d.]+,-?[\d.]+\);/u);
    expect(t).toContain('\\begin{tikzpicture}[');
    expect(t.trimEnd().endsWith('\\end{tikzpicture}')).toBe(true);
    expect(t).not.toContain('\\documentclass');
  });

  it('strokes carry widths and dash patterns in bp; opacities only below 1', () => {
    const t = toTikz(f).text;
    expect(t).toMatch(/line width=1\.5bp, dash pattern=on 7\.5bp off 6bp\]/u);
    expect(t).toMatch(/draw opacity=0\.5\]/u);
    expect(t).toMatch(/\\fill\[gmc0, fill opacity=0\.08\]/u);
    expect(t).toContain('draw opacity=0.4');
  });

  it('labels are nodes anchored as on the screen', () => {
    expect(toTikz(f).text).toMatch(
      /\\node\[anchor=[a-z ]+, inner sep=0pt, text=gmc\d+\] at \([-\d.]+,[-\d.]+\) \{A\\textsubscript\{1\} \\& co\}; % label of A/u,
    );
  });

  it('the standalone document wraps the snippet', () => {
    const s = toTikzStandalone(f).text;
    expect(
      s.startsWith(
        '\\documentclass[11pt]{standalone}\n\\usepackage{tikz}\n\\usepackage{amssymb}\n\\begin{document}\n',
      ),
    ).toBe(true);
    expect(s).toContain(toTikz(f).text.trimEnd());
    expect(s.trimEnd().endsWith('\\end{document}')).toBe(true);
  });

  it('a view far from the origin writes coordinates relative to its centre', () => {
    const far = `@version 1\nA = (100000, 100000)\nB = (100003, 100000)\nl = segment(A, B)\n`;
    const view: View = {
      viewport: { cx: 100001.5, cy: 100000, zoom: 100 },
      size: { width: 400, height: 300 },
    };
    const t = toTikz(frameOf(far, { view })).text;
    expect(t).toContain(
      '% Coordinates are relative to (100001.5, 100000), the centre of the view.',
    );
    expect(t).toContain('(-1.5,0)');
    const near = toTikz(frameOf(far.replaceAll('100000', '1').replace('100003', '4'))).text;
    expect(near).not.toContain('relative to');
  });
});

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEditor } from '@geomira/editor/state';
import { TOOL_GROUPS } from '@geomira/editor/tool-groups';
import { TOOLS } from '@geomira/editor/tools';
import { emptyDocument } from '@geomira/kernel/document';
import { createRegistry } from '@geomira/kernel/registry';
import { App } from '../src/App';
import { ToolIcon } from '../src/icons';
import { MathText } from '../src/MathText';
import { claimStatement } from '../src/Stage';
import { EditorStore } from '../src/store';
import { Palette } from '../src/ToolBar';

/** Run 9b (ADR-0016): the design pass keeps names, roles and texts the packages give. */

const store = new EditorStore({ registry: createRegistry() }, () => undefined);
const state = createEditor(emptyDocument(), store.env);

describe('the tool palette', () => {
  const html = renderToString(<Palette store={store} state={state} />);

  it('is the toolbar "Tools" with every tool once, named by its label, in its group', () => {
    expect(html).toContain('role="toolbar" aria-label="Tools"');
    for (const t of TOOLS) {
      expect(html.split(`<span class="sr-only">${t.label}</span>`)).toHaveLength(2);
      expect(html).toContain(`title="${t.label}: ${t.help} (key ${t.key.toUpperCase()})"`);
    }
    for (const g of TOOL_GROUPS) expect(html).toContain(`role="group" aria-label="${g.label}"`);
  });

  it('marks the active tool pressed', () => {
    expect(html.match(/aria-pressed="true"/gu)).toHaveLength(1);
  });

  it('has an icon for every tool', () => {
    for (const t of TOOLS) {
      const svg = renderToString(<ToolIcon tool={t.id} />);
      expect(svg).toMatch(/^<svg class="icon" viewBox="0 0 24 24"/u);
      expect(svg).toContain('aria-hidden="true"');
      expect(svg.length, t.id).toBeGreaterThan(150);
    }
  });
});

/** Server rendering separates adjacent text nodes with comments; the text is what counts. */
function math(text: string): string {
  return renderToString(<MathText text={text} />).replace(/<!-- -->/gu, '');
}

describe('math text', () => {
  it('draws point names with real sub- and superscripts, other text as it is', () => {
    expect(math("collinear(M_a, H', A_1, A*)")).toBe(
      '<span class="math">collinear(M<sub>a</sub>, H′, A<sub>1</sub>, A<sup>*</sup>)</span>',
    );
    expect(math('on(H, ω*)')).toBe('<span class="math">on(H, ω<sup>*</sup>)</span>');
    expect(math('AB = 2·CD')).toBe('<span class="math">AB = 2·CD</span>');
  });

  it('a claim card and chip show the statement without the keyword', () => {
    expect(claimStatement('claim collinear(A, B, C)')).toBe('collinear(A, B, C)');
    expect(claimStatement('claim ∠BHC + ∠BAC = 180')).toBe('∠BHC + ∠BAC = 180');
  });
});

describe('the page', () => {
  const html = renderToString(<App />);

  it('keeps the old labels as accessible names of icon buttons', () => {
    for (const name of ['Undo', 'Redo', 'Zoom in', 'Zoom out', 'Fit'])
      expect(html).toContain(`<span class="sr-only">${name}</span>`);
    for (const name of ['Settings', 'Help']) expect(html).toContain(`>${name}</span>`);
    expect(html).toContain('aria-label="Example"');
    expect(html).toContain('aria-label="Command"');
  });

  it('keeps the developer items out of the main bar', () => {
    expect(html).not.toContain('Measure frame time');
    expect(html).not.toContain('Debug report');
    expect(html).not.toContain('coincident images hidden');
  });

  it('never has a claim-box button whose whole text is "Test" (a claim card’s is)', () => {
    expect(html).not.toMatch(/<button[^>]*>Test<\/button>/u);
    expect(html).toContain('Test</button>');
  });
});

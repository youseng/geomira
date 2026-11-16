import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchingTools } from '../src/tool-search';
import {
  DEFAULT_WORKSPACE,
  panelWidth,
  readWorkspace,
  writeWorkspace,
} from '../src/workspace-prefs';

afterEach(() => {
  vi.unstubAllGlobals();
});
describe('workspace preferences never become document state', () => {
  it('survives denied and corrupt storage without claiming a geometry save', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new DOMException('denied');
      },
      setItem() {
        throw new DOMException('full');
      },
    });
    expect(readWorkspace()).toEqual(DEFAULT_WORKSPACE);
    expect(() => {
      writeWorkspace(DEFAULT_WORKSPACE);
    }).not.toThrow();
    vi.stubGlobal('localStorage', { getItem: () => '{broken' });
    expect(readWorkspace()).toEqual(DEFAULT_WORKSPACE);
  });
  it('bounds widths and ignores unsafe field values', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ width: 9999, recent: ['line', null, 7], compact: false }),
    });
    expect(readWorkspace()).toMatchObject({ width: 560, compact: false, recent: ['line'] });
    expect(panelWidth(560, 768)).toBe(348);
    expect(panelWidth(320, 1440)).toBe(320);
    expect(panelWidth(-999, 768)).toBe(240);
  });
});
describe('search consumes the available tool catalog', () => {
  it('understands readable labels, IDs, operation aliases and centre spelling', () => {
    expect(matchingTools('circumcentre').map((t) => t.id)).toContain('circumcenter');
    expect(matchingTools('perp').map((t) => t.id)).toContain('perpendicular');
    expect(matchingTools('apply map').map((t) => t.id)).toContain('apply_map');
    expect(matchingTools('no-such-tool')).toEqual([]);
  });
  it('cannot expose the retired public claim tool', () => {
    expect(matchingTools('claim').some((t) => t.id === 'claim')).toBe(false);
  });
});

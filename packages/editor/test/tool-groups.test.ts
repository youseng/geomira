import { describe, expect, it } from 'vitest';
import { TOOL_GROUPS, toolGroup } from '../src/tool-groups';
import { TOOLS } from '../src/tools';

/** Run 9b: the palette's groups are data over the tool table. */
describe('tool groups', () => {
  it('every tool is in exactly one group, in the table order', () => {
    const listed = TOOL_GROUPS.flatMap((g) => g.tools.map((t) => t.id));
    expect([...listed].sort()).toEqual(TOOLS.map((t) => t.id).sort());
    for (const g of TOOL_GROUPS) {
      const order = g.tools.map((t) => TOOLS.indexOf(t));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      for (const t of g.tools) expect(toolGroup(t.id)).toBe(g.id);
    }
  });

  it('the groups and their labels, in palette order; none is empty', () => {
    expect(TOOL_GROUPS.map((g) => g.label)).toEqual([
      'Points',
      'Lines',
      'Circles',
      'Transform',
      'Marks',
      'Measure / Claim',
    ]);
    for (const g of TOOL_GROUPS) expect(g.tools.length).toBeGreaterThan(0);
    expect(Object.isFrozen(TOOL_GROUPS)).toBe(true);
  });
});

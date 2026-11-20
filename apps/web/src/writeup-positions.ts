import type { Token } from 'markdown-it';

/** markdown-it removes list/quote prefixes before inline parsing. Match each inline line
 * back to its physical line before exposing a clickable error range in the native field. */
export function locateFormulas(tokens: Token[], source: string): void {
  const rows = source.replace(/\r\n?/gu, '\n').split('\n');
  const starts: number[] = [];
  let offset = 0;
  for (const row of rows) {
    starts.push(offset);
    offset += row.length + 1;
  }
  for (const block of tokens) {
    if (!block.map) continue;
    const first = block.map[0];
    if (block.type === 'formula') {
      const end = block.map[1] - 1;
      block.meta = { from: starts[first], to: (starts[end] ?? 0) + (rows[end]?.length ?? 0) };
    }
    if (block.type !== 'inline' || !block.children?.some((t) => t.type === 'formula')) continue;
    const positions: { offset: number; physical: number }[] = [];
    let local = 0;
    for (const [i, part] of block.content.split('\n').entries()) {
      const row = first + i;
      const column = rows[row]?.indexOf(part) ?? -1;
      positions.push({ offset: local, physical: column < 0 ? -1 : (starts[row] ?? 0) + column });
      local += part.length + 1;
    }
    let index = 0;
    function absolute(at: number): number | undefined {
      while (index + 1 < positions.length && (positions[index + 1]?.offset ?? Infinity) <= at)
        index++;
      const line = positions[index];
      return line && line.physical >= 0 ? line.physical + at - line.offset : undefined;
    }
    for (const token of block.children) {
      const at = token.meta?.['start'];
      if (token.type !== 'formula' || typeof at !== 'number') continue;
      token.meta = {
        from: absolute(at),
        to: absolute(at + token.content.length + 2 * token.markup.length),
      };
    }
  }
}

import type { Token } from 'markdown-it';

/** Markdown-it normalizes line endings. CodeMirror and the file keep the original
 * offsets, including the extra character in each CRLF. */
export function sourceLines(source: string) {
  const rows = source.split(/\r\n?|\n/u);
  const starts = [0];
  for (const delimiter of source.matchAll(/\r\n?|\n/gu))
    starts.push(delimiter.index + delimiter[0].length);
  return { rows, starts };
}

/** Map Markdown-it's prefix-stripped inline content back into the stored text. */
export function locateFormulas(
  tokens: Token[],
  { rows, starts }: ReturnType<typeof sourceLines>,
): void {
  for (const block of tokens) {
    if (!block.map) continue;
    const first = block.map[0];
    if (block.type === 'formula') {
      const end = block.map[1] - 1;
      const opening = rows[first]?.lastIndexOf('$$') ?? -1;
      const closing = rows[end]?.lastIndexOf('$$') ?? -1;
      if (opening >= 0 && closing >= 0)
        block.meta = { from: (starts[first] ?? 0) + opening, to: (starts[end] ?? 0) + closing + 2 };
    }
    if (
      block.type !== 'inline' ||
      !block.children?.some((t) => typeof t.meta?.['start'] === 'number')
    )
      continue;
    const positions: { offset: number; physical: number }[] = [];
    let local = 0;
    for (const [i, part] of block.content.split('\n').entries()) {
      const row = first + i;
      const column = rows[row]?.lastIndexOf(part) ?? -1;
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
      if (typeof at !== 'number') continue;
      const end =
        token.type === 'formula'
          ? at + token.content.length + 2 * token.markup.length
          : token.meta?.['end'];
      if (typeof end !== 'number') continue;
      token.meta = {
        from: absolute(at),
        to: absolute(end),
      };
    }
  }
}

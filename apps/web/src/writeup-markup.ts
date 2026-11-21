import type { MarkdownIt, Token } from 'markdown-it';

import type { sourceLines } from './writeup-positions';

export interface WriteUpMark {
  readonly from: number;
  readonly to: number;
  readonly bullet?: boolean;
  readonly kind: 'syntax' | 'strong' | 'em' | 's' | 'code';
}

export interface WriteUpLine {
  readonly from: number;
  readonly kind: 'heading' | 'quote' | 'list' | 'code';
  readonly level?: number;
}

/** Keep the source offsets of the delimiters that Markdown-it actually pairs. This
 * uses the normal inline rules, including their handling of escaped and literal text. */
export function trackInlineMarkup(md: MarkdownIt): void {
  const rules = md.inline.ruler.getRules('');
  md.inline.ruler.before('text', 'writeup_offsets', (state, silent) => {
    const from = state.pos;
    const ch = state.src[from];
    if (silent || !ch || !'*_~`'.includes(ch)) return false;
    const before = state.tokens.length;
    if (!rules.some((rule) => rule(state, false))) return false;
    let pos = state.pos;
    for (let i = state.tokens.length - 1; i >= before && pos > from; i--) {
      const token = state.tokens[i];
      if (!token) break;
      if (token.type === 'code_inline') {
        token.meta = { start: from, end: pos };
        break;
      }
      if (token.type !== 'text' || !token.content.startsWith(ch)) break;
      pos -= token.content.length;
      if (pos >= from) token.meta = { start: pos, end: pos + token.content.length };
    }
    return true;
  });
}

function inlineMarks(tokens: readonly Token[], marks: WriteUpMark[]): void {
  const stack: WriteUpMark[] = [];
  for (const token of tokens) {
    let from = token.meta?.['from'],
      to = token.meta?.['to'];
    if (typeof from !== 'number' || typeof to !== 'number') continue;
    if (token.type === 'code_inline') {
      const width = token.markup.length;
      marks.push(
        { from, to, kind: 'code' },
        { from, to: from + width, kind: 'syntax' },
        { from: to - width, to, kind: 'syntax' },
      );
      continue;
    }
    const tag = token.tag;
    if (tag !== 'strong' && tag !== 'em' && tag !== 's') continue;
    if (tag === 'strong' && token.nesting === 1) from--;
    if (tag === 'strong' && token.nesting === -1) to++;
    marks.push({ from, to, kind: 'syntax' });
    if (token.nesting === 1) stack.push({ from, to, kind: tag });
    else {
      const open = stack.pop();
      if (open?.kind === tag) marks.push({ from: open.from, to, kind: tag });
    }
  }
}

function blockSyntax(token: Token, rows: string[], starts: number[], marks: WriteUpMark[]) {
  if (!token.map) return;
  const [first, end] = token.map;
  function mark(line: number, match: RegExpExecArray | null, bullet = false) {
    if (!match?.[1]) return;
    const from = (starts[line] ?? 0) + match.index + match[0].lastIndexOf(match[1]);
    marks.push({ from, to: from + match[1].length, kind: 'syntax', bullet });
  }
  if (token.type === 'list_item_open') {
    mark(first, /(?:^|[>\s])([-+*])(?=[ \t])/u.exec(rows[first] ?? ''), true);
  } else if (token.type === 'blockquote_open') {
    for (let i = first; i < end; i++) mark(i, /^\s*((?:> ?)+)/u.exec(rows[i] ?? ''));
  } else if (token.type === 'fence') {
    // The parser accepted the opening sequence. A close must use the same character
    // and at least as many repeats, including in lists or blockquotes.
    const fence = /(?:^|[>\s])((?:`{3,}|~{3,}).*)$/u;
    mark(first, fence.exec(rows[first] ?? ''));
    const close = fence.exec(rows[end - 1] ?? '');
    if (
      end - 1 > first &&
      close?.[1]?.trimEnd().startsWith(token.markup) &&
      /^(?:`+|~+)$/u.test(close[1].trimEnd())
    )
      mark(end - 1, close);
  }
}

/** Attach presentation to the parsed blocks. Every offset belongs to the original
 * source, including markers which are only shown on the line being edited. */
export function writeUpMarkup(
  tokens: readonly Token[],
  { rows, starts }: ReturnType<typeof sourceLines>,
) {
  const marks: WriteUpMark[] = [];
  const lines: WriteUpLine[] = [];
  for (const token of tokens) {
    if (token.children) inlineMarks(token.children, marks);
    if (!token.map) continue;
    blockSyntax(token, rows, starts, marks);
    const [first, end] = token.map;
    const from = starts[first] ?? 0;
    const row = rows[first] ?? '';
    if (token.type === 'heading_open') {
      const level = Number(token.tag.slice(1));
      for (let i = first; i < end; i++)
        lines.push({ from: starts[i] ?? from, kind: 'heading', level });
      if (token.markup.startsWith('#')) {
        const opening = /(?:^|[\s>])(#{1,6})(?:[ \t]+|$)/u.exec(row);
        if (opening) {
          const start = row.indexOf('#', opening.index);
          marks.push({
            from: from + start,
            to: from + opening.index + opening[0].length,
            kind: 'syntax',
          });
        }
        const closing = /[ \t]+#+[ \t]*$/u.exec(row);
        if (closing && closing.index > (opening?.index ?? 0))
          marks.push({ from: from + closing.index, to: from + row.length, kind: 'syntax' });
      } else {
        const last = end - 1;
        marks.push({
          from: starts[last] ?? from,
          to: (starts[last] ?? from) + (rows[last]?.length ?? 0),
          kind: 'syntax',
        });
      }
    } else if (
      token.type === 'fence' ||
      token.type === 'code_block' ||
      token.type === 'blockquote_open' ||
      token.type === 'list_item_open'
    ) {
      const kind =
        token.type === 'blockquote_open'
          ? 'quote'
          : token.type === 'list_item_open'
            ? 'list'
            : 'code';
      for (let i = first; i < end; i++) lines.push({ from: starts[i] ?? from, kind });
    }
  }
  return { marks, lines };
}

import MarkdownIt, { type StateInline, type Token } from 'markdown-it';
import katex from 'katex';
import { trackInlineMarkup, writeUpMarkup } from './writeup-markup';
import { locateFormulas, sourceLines } from './writeup-positions';

const MAX_SOURCE = 80_000;
const MAX_FORMULA = 4_000;
const MAX_FORMULAS = 200;
const MAX_OUTPUT = 2_000_000;

/** KaTeX is called only for complete delimiters. Markdown-it consumes escapes, backticks
 * and fences itself, so dollar signs inside code remain ordinary source text. */
function inlineMath(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '$') return false;
  const delimiter = state.src.startsWith('$$', state.pos) ? '$$' : '$';
  const start = state.pos + delimiter.length;
  for (let i = start; i < state.posMax; i++) {
    const char = state.src[i];
    if (char === '\n' && delimiter === '$') break;
    if (char === '\\') {
      i++;
      continue;
    }
    if (!state.src.startsWith(delimiter, i)) continue;
    if (i === start) break;
    if (!silent) {
      const token = state.push('formula', '', 0);
      token.content = state.src.slice(start, i);
      token.markup = delimiter;
      token.meta = { start: state.pos };
    }
    state.pos = i + delimiter.length;
    return true;
  }
  // Keep an incomplete opening pair together, instead of interpreting its second dollar.
  if (!silent) state.pending += delimiter;
  state.pos = start;
  return true;
}

function markdown() {
  const md = new MarkdownIt({ html: false, linkify: false, maxNesting: 32 });
  // Offline notes never fetch linked media or turn user HTML into active elements.
  md.disable(['image', 'link', 'autolink', 'reference']);
  md.inline.ruler.before('escape', 'formula', inlineMath);
  md.block.ruler.before('paragraph', 'display_formula', (state, start, end, silent) => {
    const line = (n: number) =>
      state.src.slice((state.bMarks[n] ?? 0) + (state.tShift[n] ?? 0), state.eMarks[n]).trim();
    if (line(start) !== '$$') return false;
    let close = start + 1;
    while (close < end && line(close) !== '$$') close++;
    if (close === end) return false;
    if (silent) return true;
    const token = state.push('formula', '', 0);
    token.markup = '$$';
    token.content = state.getLines(start + 1, close, state.blkIndent, false);
    token.map = [start, close + 1];
    state.line = close + 1;
    return true;
  });
  trackInlineMarkup(md);
  return md;
}

/** Ranges always refer to the Markdown, never the generated MathML. */
export interface WriteUpFormula {
  readonly from: number;
  readonly to: number;
  readonly display: boolean;
  readonly html: string;
  readonly error: string;
}

function typeset(token: Token): Pick<WriteUpFormula, 'html' | 'error'> {
  try {
    if (token.content.length > MAX_FORMULA) throw new Error('Formula too long');
    const html = katex.renderToString(token.content, {
      displayMode: token.markup === '$$',
      output: 'mathml',
      trust: false,
      throwOnError: true,
      strict: 'error',
      maxSize: 25,
      maxExpand: 200,
      macros: {},
    });
    return { html, error: '' };
  } catch (error) {
    return { html: '', error: error instanceof Error ? error.message : 'Invalid formula' };
  }
}

/** Keep only the current document's formula results. Typing prose around a proof
 * can move every equation without requiring KaTeX to typeset any of them again. */
export function createWriteUpFormatter() {
  const md = markdown();
  let previous = new Map<string, ReturnType<typeof typeset>>();
  return (source: string) => {
    if (source.length > MAX_SOURCE)
      throw new Error('This write-up exceeds the live formatting limit.');
    const lines = sourceLines(source);
    const tokens = md.parse(source, {});
    locateFormulas(tokens, lines);
    const next = new Map<string, ReturnType<typeof typeset>>();
    const formulas: WriteUpFormula[] = [];
    let size = 0;
    for (const block of tokens) {
      for (const token of block.children ?? [block]) {
        if (token.type !== 'formula') continue;
        if (formulas.length >= MAX_FORMULAS)
          throw new Error('Too many formulas to typeset at once.');
        const from = token.meta?.['from'],
          to = token.meta?.['to'];
        if (typeof from !== 'number' || typeof to !== 'number') continue;
        const key = token.markup + '\0' + token.content;
        const result = next.get(key) ?? previous.get(key) ?? typeset(token);
        size += result.html.length + result.error.length;
        if (size > MAX_OUTPUT) throw new Error('The typeset output is too large.');
        next.set(key, result);
        formulas.push({ from, to, display: token.markup === '$$', ...result });
      }
    }
    previous = next;
    return { ...writeUpMarkup(tokens, lines), formulas };
  };
}

export type WriteUpLayout = ReturnType<ReturnType<typeof createWriteUpFormatter>>;

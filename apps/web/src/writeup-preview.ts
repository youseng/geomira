import MarkdownIt, { type StateInline, type Token } from 'markdown-it';
import katex from 'katex';
import { locateFormulas } from './writeup-positions';

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
  return md;
}

export function renderWriteUp(source: string): string {
  if (source.length > MAX_SOURCE) throw new Error('This write-up exceeds the live preview limit.');
  const md = markdown();
  let count = 0;
  let mathSize = 0;
  const formula = (token: Token): string => {
    if (++count > MAX_FORMULAS) throw new Error('Too many formulas to preview at once.');
    try {
      if (token.content.length > MAX_FORMULA) throw new Error('Formula too long');
      const math = katex.renderToString(token.content, {
        displayMode: token.markup === '$$',
        output: 'mathml',
        trust: false,
        throwOnError: true,
        strict: 'error',
        maxSize: 25,
        maxExpand: 200,
        macros: {},
      });
      mathSize += math.length;
      return math;
    } catch (error) {
      const raw = md.utils.escapeHtml(token.markup + token.content + token.markup);
      const reason = md.utils.escapeHtml(
        error instanceof Error ? error.message : 'Invalid formula',
      );
      const from = token.meta?.['from'],
        to = token.meta?.['to'];
      const diagnostic =
        typeof from === 'number' && typeof to === 'number'
          ? `<button type="button" data-from="${String(from)}" data-to="${String(to)}">${reason}</button>`
          : `<small>${reason}</small>`;
      return `<span class="writeup-error"><code>${raw}</code> ${diagnostic}</span>`;
    }
  };
  md.renderer.rules['formula'] = (tokens, index) => {
    if (mathSize > MAX_OUTPUT) throw new Error('The typeset preview is too large.');
    const token = tokens[index];
    return token === undefined ? '' : formula(token);
  };
  const env = {};
  const tokens = md.parse(source, env);
  locateFormulas(tokens, source);
  const html = md.renderer.render(tokens, md.options, env);
  if (html.length > MAX_OUTPUT) throw new Error('The typeset preview is too large.');
  return html;
}

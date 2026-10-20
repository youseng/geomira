/**
 * From parsed lines to a Document (ADR-0009). Passes: directives (layers, views), names and
 * styles; then every line in order (definitions and triangles build objects; derived
 * layers follow); then claims and assumptions. Every statement with an error is left out
 * and reported; the rest is built, so the result is always a valid document (I1–I8).
 */
import { checkInvariants } from '@geomira/kernel/invariants';
import { DOCUMENT_VERSION, type CommentAnchor } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { Line, Statement } from './ast';
import { buildDeferred, type Deferred } from './build-claims';
import { collectNames, collectStyles, definition, triangle } from './build-defs';
import { directives } from './build-layers';
import { newState, type State } from './build-state';
import { attach, defer, finish, take } from './comments';
import { error, warning, type Diagnostic } from './diagnostic';

export interface Built {
  readonly doc: State['doc'];
  readonly diagnostics: readonly Diagnostic[];
}

export interface VersionCheck {
  /** Why the file's version cannot be read as current (a newer file, a missing migration). */
  readonly problem?: { readonly reason: string; readonly hint: string };
}

type Meta = Extract<Statement, { kind: 'title' | 'author' | 'viewport' | 'version' }>;

function metaLine(
  st: State,
  s: Meta,
  v: VersionCheck,
  seen: Set<string>,
): CommentAnchor | undefined {
  if (seen.has(s.kind)) {
    st.diags.push(error(s.span, `@${s.kind} is given twice`, 'keep one'));
    return undefined;
  }
  seen.add(s.kind);
  switch (s.kind) {
    case 'version':
      if (v.problem !== undefined) st.diags.push(error(s.span, v.problem.reason, v.problem.hint));
      else if (s.version !== DOCUMENT_VERSION)
        st.diags.push(
          error(
            s.span,
            `unknown version ${String(s.version)}`,
            `write @version ${String(DOCUMENT_VERSION)}`,
          ),
        );
      return { kind: 'header' };
    case 'title':
    case 'author':
      st.doc = { ...st.doc, meta: { ...st.doc.meta, [s.kind]: s.text } };
      return { kind: s.kind };
    case 'viewport': {
      const [cx = 0, cy = 0, zoom = 0] = s.values;
      if (!(zoom > 0)) {
        st.diags.push(error(s.span, 'the zoom must be positive', 'write @viewport 0 0 50'));
        return undefined;
      }
      st.doc = { ...st.doc, viewport: { cx, cy, zoom } };
      return { kind: 'viewport' };
    }
    default:
      return undefined;
  }
}

interface Pass {
  readonly anchors: ReadonlyMap<number, CommentAnchor>;
  readonly polys: ReadonlyMap<number, string>;
  readonly badStyles: ReadonlySet<number>;
  readonly deferred: Deferred[];
  readonly named: { name: string; lines: string[]; inline?: string }[];
  readonly seen: Set<string>;
  readonly version: VersionCheck;
}

/** One line of the main pass; returns its anchor (undefined: comments move on). */
function lineStep(st: State, l: Line, s: Statement, p: Pass): CommentAnchor | 'taken' | undefined {
  switch (s.kind) {
    case 'def': {
      const id = definition(st, s, l.line);
      return id === undefined ? undefined : { kind: 'object', id };
    }
    case 'triangle': {
      const r = triangle(st, s, l.line, p.polys.get(l.line) ?? 'tri');
      for (const c of r.conditions)
        p.deferred.push({ kind: 'assume', condition: c, attrs: [], line: l.line, lines: [] });
      return r.first === undefined ? undefined : { kind: 'object', id: r.first };
    }
    case 'claim':
    case 'assume': {
      const condition = s.kind === 'claim' ? s.claim : s.condition;
      const attrs = s.kind === 'claim' ? s.attrs : [];
      const base = { kind: s.kind, condition, attrs, line: l.line, lines: take(st.book) };
      p.deferred.push(l.comment === undefined ? base : { ...base, inline: l.comment });
      return 'taken';
    }
    case 'style':
    case 'label': {
      if (p.badStyles.has(l.line)) return undefined;
      const base = { name: s.target.name, lines: take(st.book) };
      p.named.push(l.comment === undefined ? base : { ...base, inline: l.comment });
      return 'taken';
    }
    case 'layer':
    case 'view':
      return p.anchors.get(l.line);
    case 'version':
    case 'title':
    case 'author':
    case 'viewport':
      return metaLine(st, s, p.version, p.seen);
    default:
      return undefined;
  }
}

/** Reports what was declared but never found its object. */
function leftovers(st: State): void {
  for (const [name, p] of st.styles) {
    if (p.used) continue;
    for (const span of p.spans)
      st.diags.push(error(span, `${name} is not defined`, 'style objects that exist'));
  }
  for (const r of st.rules) {
    if (r.state === 'waiting') {
      const line = st.failed.get(r.transform.name);
      st.diags.push(
        error(
          r.transform.span,
          line === undefined
            ? `the transformation ${r.transform.name} is not defined`
            : `${r.transform.name} is not defined: its line ${String(line)} has an error`,
          'define the transformation, e.g. T = reflect(line(B, C))',
        ),
      );
    }
    if (r.state !== 'active') continue;
    for (const n of r.exclude) {
      if (!st.ids.has(n.name))
        st.diags.push(error(n.span, `${n.name} is not defined`, 'exclude objects that exist'));
    }
  }
}

export function buildDocument(
  lines: readonly Line[],
  registry: Registry,
  version: VersionCheck,
): Built {
  const st = newState(registry);
  const anchors = directives(st, lines);
  const polys = collectNames(st, lines);
  const badStyles = collectStyles(st, lines);
  const pass: Pass = {
    anchors,
    polys,
    badStyles,
    deferred: [],
    named: [],
    seen: new Set(),
    version,
  };
  for (const l of lines) {
    const a = l.statement === undefined ? undefined : lineStep(st, l, l.statement, pass);
    if (a === 'taken') continue;
    if (a === undefined) defer(st.book, [], l.comment);
    else attach(st.book, a, take(st.book), l.comment);
  }
  if (!pass.seen.has('version')) {
    st.diags.push(
      warning(
        { line: 1, column: 1, endColumn: 2 },
        `no @version line: read as version ${String(DOCUMENT_VERSION)}`,
        `add @version ${String(DOCUMENT_VERSION)} as the first line`,
      ),
    );
  }
  buildDeferred(st, pass.deferred).forEach((a, i) => {
    const d = pass.deferred[i];
    if (d === undefined) return;
    if (a === undefined) defer(st.book, d.lines, d.inline);
    else attach(st.book, a, d.lines, d.inline);
  });
  for (const n of pass.named) {
    const id = st.ids.get(n.name);
    if (id === undefined) defer(st.book, n.lines, n.inline);
    else attach(st.book, { kind: 'object', id }, n.lines, n.inline);
  }
  leftovers(st);
  const comments = finish(st.book);
  if (comments.length > 0) st.doc = { ...st.doc, meta: { ...st.doc.meta, comments } };
  for (const v of checkInvariants(st.doc)) {
    st.diags.push(
      error(
        { line: 1, column: 1, endColumn: 2 },
        `internal: ${v.code}: ${v.message}`,
        'please report this text',
      ),
    );
  }
  return { doc: st.doc, diagnostics: st.diags };
}

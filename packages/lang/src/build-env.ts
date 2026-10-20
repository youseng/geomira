/**
 * The expression environment of the builder: name resolution with precise messages
 * (defined later, its line has an error, an image that does not exist, did you mean …),
 * and the default parameter of a parameterless `on(obj)` (ADR-0009): the parser reads the
 * object's value in the figure built so far and writes an explicit parameter, so the
 * document stores its free state (SPEC §5): a line gets t = 1/3, a circle with a known
 * point (u : v) = (2 : 1) (a 3-4-5 rotation of its anchor), a circle without one 90°.
 */
import { lit, type Expr } from '@geomira/kernel/expr';
import { assertNever } from '@geomira/num/assert';
import { FloatField } from '@geomira/num/float-field';
import { fromInteger, rational } from '@geomira/num/rational';
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import { error, type Span } from './diagnostic';
import type { ExprEnv } from './build-expr';
import type { State } from './build-state';
import { suggest } from './suggest';

function unresolved(st: State, name: string, span: Span): undefined {
  const failedLine = st.failed.get(name);
  const later = st.defLines.get(name);
  if (failedLine !== undefined) {
    st.diags.push(
      error(
        span,
        `${name} is not defined: its line ${String(failedLine)} has an error`,
        `fix line ${String(failedLine)} first`,
      ),
    );
  } else if (later === st.line) {
    st.diags.push(
      error(span, `${name} cannot be built from itself`, 'use other objects in its definition'),
    );
  } else if (later !== undefined) {
    st.diags.push(
      error(
        span,
        `${name} is defined later, on line ${String(later)}`,
        `move this line after line ${String(later)}`,
      ),
    );
  } else if (name.endsWith('*')) {
    const src = name.replace(/\*+$/u, '');
    st.diags.push(
      error(
        span,
        `there is no image ${name} here`,
        `${name} exists once a derived layer images ${src} (its transformation and ${src} defined above)`,
      ),
    );
  } else {
    const near = suggest(name, [...st.ids.keys(), ...st.defLines.keys()]);
    st.diags.push(
      error(
        span,
        `unknown name "${name}"${near === undefined ? '' : `: did you mean ${near}?`}`,
        near === undefined ? 'define it first' : `write ${near}`,
      ),
    );
  }
  return undefined;
}

/** The default parameters of on(obj) from the value of obj in the figure so far. */
function gliderDefault(st: State, obj: Expr): readonly Expr[] | string {
  const id = st.doc.nextId;
  const probe = { id, name: '#on', def: obj, style: {}, layers: ['main'] };
  const doc = { ...st.doc, nextId: id + 1, objects: [...st.doc.objects, probe] };
  const ctx = evalContextFor(doc);
  if (!ctx.ok) return `on(…) without a parameter: ${ctx.reason}`;
  const v = evaluate(doc, st.registry, FloatField, ctx.ctx).values.get(id);
  switch (v?.kind) {
    case 'line':
      return [lit(rational(1n, 3n))];
    case 'circle':
      return v.anchor === undefined
        ? [lit(fromInteger(90))]
        : [lit(fromInteger(2)), lit(fromInteger(1))];
    case 'undefined':
    case 'inexact':
      return `on(…) without a parameter needs the object's value to choose one, and it is ${v.kind} here (${v.reason})`;
    case 'point':
    case 'number':
    case 'polygon':
    case 'transform':
    case undefined:
      return 'on(…) takes a line or a circle';
    default:
      return assertNever(v, 'value');
  }
}

export function exprEnv(st: State): ExprEnv {
  return {
    registry: st.registry,
    resolve: (name, span) => {
      const id = st.ids.get(name);
      if (id === undefined) unresolved(st, name, span);
      return id;
    },
    gliderDefault: (obj) => gliderDefault(st, obj),
    isObjectName: (name) => st.ids.has(name) || st.defLines.has(name),
    diags: st.diags,
  };
}

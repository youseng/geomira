/**
 * A corpus claim with every argument an object of the figure (Run 17's screen and finder
 * decide claims about objects): each argument that is not a reference or a literal becomes
 * an object `x_<i>`; literals stay literals.
 */
import type { Document } from '@geomira/kernel/document';
import { addObject } from '@geomira/kernel/edit';
import { ref, type Expr } from '@geomira/kernel/expr';
import type { ScreenArg } from '../../src/screen';

export interface Objectified {
  readonly doc: Document;
  readonly kind: string;
  readonly args: readonly ScreenArg[];
  /** The claim's arguments as expressions over the new objects. */
  readonly exprs: readonly Expr[];
}

export function objectify(doc0: Document, claimId: number): Objectified {
  const claim = doc0.claims.find((c) => c.id === claimId);
  if (claim === undefined) throw new Error(`no claim #${String(claimId)}`);
  let doc = doc0;
  const args: ScreenArg[] = [];
  const exprs: Expr[] = [];
  claim.args.forEach((a, i) => {
    if (a.kind === 'lit') {
      args.push({ lit: a.value });
      exprs.push(a);
    } else if (a.kind === 'ref') {
      args.push({ id: a.id });
      exprs.push(a);
    } else {
      const id = doc.nextId;
      const r = addObject(doc, { name: `x_${String(i)}`, def: a });
      if (!r.ok) throw new Error(r.error);
      doc = r.doc;
      args.push({ id });
      exprs.push(ref(id));
    }
  });
  return { doc, kind: claim.kind, args, exprs };
}

/**
 * Test helpers of packages/discovery: the claims run's figure builder and corpora (reused, not
 * copied), a triangle figure without the corpus's spare points, and fact printing for messages.
 */
import type { Document } from '@geomira/kernel/document';
import { formatRational } from '@geomira/num/rational';
import { baseFigure } from '../../claims/test/helpers/corpus';
import type { Figure } from '../../claims/test/helpers/build';
import type { Fact } from '../src/types';

export { REGISTRY } from '../../claims/test/helpers/build';

/** The corpus's base figure without its spare free points D, E, F, G. */
export function triangle(): Figure {
  const f = baseFigure();
  f.doc = {
    ...f.doc,
    objects: f.doc.objects.filter((o) => !['D', 'E', 'F', 'G'].includes(o.name)),
  };
  return f;
}

/** "collinear(O, G_c, H)" with the document's names. */
export function show(doc: Document, f: Pick<Fact, 'kind' | 'args'>): string {
  const name = (id: number) => doc.objects.find((o) => o.id === id)?.name ?? `#${String(id)}`;
  return `${f.kind}(${f.args.map((a) => ('id' in a ? name(a.id) : formatRational(a.lit))).join(', ')})`;
}

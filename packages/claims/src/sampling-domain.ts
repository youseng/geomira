/** Validate all sampled inputs before drawing, including inputs unrelated to the claim. */
import { compare, sub, tryToNumber } from '@geomira/num/rational';
import type { Document } from '@geomira/kernel/document';
import { readFree, type FreeInput } from './free';

/** Invalid free domains are refused, never repaired or dropped from the construction. */
export function samplingProblem(doc: Document, inputs: readonly FreeInput[]): string | undefined {
  for (const input of inputs) {
    const values = readFree(doc, input);
    const name = doc.objects.find((o) => o.id === input.id)?.name ?? String(input.id);
    const prefix = `${name}: ${input.kind}`;
    if (values === undefined || values.some((v) => tryToNumber(v) === undefined))
      return `${prefix} is outside the supported numeric range; use finite representable inputs`;
    if (input.kind === 'radius') {
      const r = values[0];
      const x = r === undefined ? 0 : (tryToNumber(r) ?? 0);
      if (r === undefined || r.num <= 0n || !(x * x > 0) || !Number.isFinite(x * x))
        return `${prefix} must be positive and representable; correct the circle radius before sampling`;
    }
    if (input.kind === 'param') {
      const [min, max, value] = values;
      if (
        min === undefined ||
        max === undefined ||
        value === undefined ||
        compare(min, max) >= 0 ||
        !((tryToNumber(max) ?? 0) > (tryToNumber(min) ?? 0)) ||
        compare(value, min) < 0 ||
        compare(value, max) > 0 ||
        !((tryToNumber(sub(max, min)) ?? 0) > 0) ||
        tryToNumber(sub(max, min)) === undefined
      )
        return `${prefix} needs min < max and a value inside [min, max]; correct its range before sampling`;
    }
    if (input.kind === 'stereo' && values.every((v) => v.num === 0n))
      return `${prefix} needs a nonzero parameter pair before sampling`;
  }
  return undefined;
}

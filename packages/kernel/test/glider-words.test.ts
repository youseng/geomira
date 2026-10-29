/**
 * Run 16c audit (16b queue, ADR-0044): gliderPoint, gliderParameter and dragParameter take a
 * line, a circle or a conic (ADR-0042); a value of another kind is refused with all three named.
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { dragParameter, gliderParameter, gliderPoint } from '../src/glider';
import type { Value } from '../src/value';
const CTX = { scale: 10 };

const why = (v: object) => ('reason' in v ? v.reason : 'defined');

describe('the words of a glider on a value of the wrong kind', () => {
  const P: Value<number> = { kind: 'point', x: 1, y: 1 };
  const O = { x: 0, y: 0 };
  it('names the line, the circle and the conic', () => {
    const want = 'a glider needs a line, a circle or a conic, not point';
    expect(why(gliderPoint(FloatField, P, { form: 'line', t: 1 }, CTX))).toBe(want);
    expect(why(dragParameter(FloatField, P, O, 'line', CTX))).toBe(want);
    expect(why(gliderParameter(FloatField, P, O, 'stereo', CTX))).toBe(want);
  });
});

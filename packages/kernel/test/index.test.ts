import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import * as api from '../src/index';

describe('@geomira/kernel public surface', () => {
  it('exports exactly VERSION', () => {
    expect(Object.keys(api)).toEqual(['VERSION']);
  });

  it('VERSION matches package.json', () => {
    expect(api.VERSION).toBe(pkg.version);
  });
});
